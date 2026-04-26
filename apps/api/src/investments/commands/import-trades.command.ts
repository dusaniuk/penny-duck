import { Inject, BadRequestException, NotFoundException } from "@nestjs/common"
import { Command, CommandBus, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { and, eq, sql } from "drizzle-orm"
import type {
  ImportTradesResponse,
  ImportTradesRow,
  ImportTradesSummary,
} from "@workspace/api-contract"
import { type DbClient, accounts } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { parseIbkrCsv } from "../import/ibkr-csv-parser"
import type { ParsedEvent, ParsedImport } from "../import/types"
import { InstrumentService } from "../instrument.service"
import { TradeRepository } from "../trade.repository"
import { CreateTradeCommand } from "./create-trade.command"

export interface ImportTradesInput {
  organizationId: string
  accountId: string
  fileBuffer: Buffer
  dryRun: boolean
}

export class ImportTradesCommand extends Command<ImportTradesResponse> {
  constructor(public readonly input: ImportTradesInput) {
    super()
  }
}

const EXTERNAL_SOURCE = "ibkr_flex_query"

@CommandHandler(ImportTradesCommand)
export class ImportTradesHandler implements ICommandHandler<ImportTradesCommand> {
  constructor(
    @Inject(DB_CLIENT) private readonly db: DbClient,
    private readonly tradeRepo: TradeRepository,
    private readonly commandBus: CommandBus,
    private readonly instrumentService: InstrumentService
  ) {}

  async execute(cmd: ImportTradesCommand): Promise<ImportTradesResponse> {
    const { input } = cmd

    const [accountRow] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, input.accountId),
          eq(accounts.organizationId, input.organizationId)
        )
      )
      .limit(1)
    if (!accountRow) throw new NotFoundException("Account not found")
    if (accountRow.type !== "brokerage") {
      throw new BadRequestException("Selected account must be a brokerage")
    }

    let parsed: ParsedImport
    try {
      parsed = parseIbkrCsv(input.fileBuffer.toString("utf8"))
    } catch (err) {
      throw new BadRequestException(
        `Unrecognized CSV format — expected IBKR Activity Flex Query: ${(err as Error).message}`
      )
    }

    // Intra-batch dedup for trades: the user may upload overlapping files
    // (e.g., a full-year export plus a partial re-export). Keep only the first
    // occurrence of each externalId so the partial unique index on `trades`
    // doesn't trip on the second insert in the commit loop. Deposits don't
    // dedup — they bump initial_balance and re-import is user-beware.
    const seenEventIds = new Set<string>()
    parsed = {
      ...parsed,
      events: parsed.events.filter((ev) => {
        if (seenEventIds.has(ev.externalId)) return false
        seenEventIds.add(ev.externalId)
        return true
      }),
    }

    // If events come from multiple IBKR accounts, don't auto-bind the Penny Duck
    // account to any single ClientAccountID. Only auto-set when the batch is
    // unambiguous (all events share one ClientAccountID).
    const distinctIbkrAccounts = new Set(
      parsed.events
        .map((e) => e.externalMetadata.clientAccountId)
        .filter((v): v is string => v !== null && v !== "")
    )
    const singleIbkrAccount =
      distinctIbkrAccounts.size === 1
        ? (distinctIbkrAccounts.values().next().value ?? null)
        : null

    const externalIds = parsed.events.map((e) => e.externalId)
    const existing = await this.tradeRepo.findExistingExternalIds(
      input.accountId,
      EXTERNAL_SOURCE,
      externalIds
    )

    const rows = buildPreviewRows(parsed, existing, accountRow.currency)
    const summary = buildSummary(parsed, existing, rows)
    const parseErrors = parsed.errors.map((e) => ({ line: e.line, reason: e.reason }))

    if (input.dryRun) {
      return { summary, rows, parseErrors, committed: false, createdCount: 0 }
    }

    // Commit path
    if (summary.rowErrors > 0) {
      throw new BadRequestException(
        "Cannot import with row errors — fix the CSV and re-upload"
      )
    }

    const toCreate = parsed.events.filter((ev) => !existing.has(ev.externalId))

    // Pre-warm instruments: move the only realistic mid-loop failure
    // (Yahoo rate-limit on a new symbol) to a point where nothing has been written.
    const uniqueSymbols = Array.from(new Set(toCreate.map((ev) => ev.symbol)))
    for (const symbol of uniqueSymbols) {
      try {
        await this.instrumentService.ensureBySymbol(symbol)
      } catch (err) {
        throw new BadRequestException(
          `Could not resolve symbol ${symbol}: ${(err as Error).message}`
        )
      }
    }

    let createdCount = 0
    for (const ev of toCreate) {
      await this.commandBus.execute(
        new CreateTradeCommand(toCreateTradeInput(ev, input))
      )
      createdCount++
    }

    // Deposits/withdrawals shift the brokerage account's "starting state" —
    // we fold them straight into initial_balance instead of writing them as
    // discrete transactions. Re-importing the same CSV will double-bump; the
    // user can correct initial_balance manually if needed.
    const depositsTotal = parsed.deposits.reduce((s, d) => s + d.amount, 0)
    if (depositsTotal !== 0) {
      const depositsTotalCents = Math.round(depositsTotal * 100)
      await this.db
        .update(accounts)
        .set({
          initialBalance: sql`${accounts.initialBalance} + ${depositsTotalCents}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, input.accountId))
    }

    if (
      singleIbkrAccount &&
      accountRow.externalAccountId !== singleIbkrAccount
    ) {
      await this.db
        .update(accounts)
        .set({ externalAccountId: singleIbkrAccount, updatedAt: new Date() })
        .where(eq(accounts.id, input.accountId))
    }

    return { summary, rows, parseErrors, committed: true, createdCount }
  }
}

function toCreateTradeInput(ev: ParsedEvent, input: ImportTradesInput) {
  if (ev.kind === "dividend") {
    return {
      organizationId: input.organizationId,
      accountId: input.accountId,
      symbol: ev.symbol,
      type: "dividend" as const,
      amount: ev.amount,
      withheldTax: ev.withheldTax,
      date: ev.date,
      externalSource: ev.externalSource,
      externalId: ev.externalId,
      externalMetadata: ev.externalMetadata as unknown as Record<string, unknown>,
    }
  }
  return {
    organizationId: input.organizationId,
    accountId: input.accountId,
    symbol: ev.symbol,
    type: ev.kind,
    quantity: ev.quantity,
    price: ev.price,
    fees: ev.fees,
    date: ev.date,
    externalSource: ev.externalSource,
    externalId: ev.externalId,
    externalMetadata: ev.externalMetadata as unknown as Record<string, unknown>,
  }
}

function buildPreviewRows(
  parsed: ParsedImport,
  existing: Set<string>,
  accountCurrency: string
): ImportTradesRow[] {
  return parsed.events.map((ev): ImportTradesRow => {
    let status: "new" | "duplicate" | "error" = "new"
    let errorMessage: string | null = null
    if (existing.has(ev.externalId)) status = "duplicate"
    if (ev.currency !== accountCurrency) {
      status = "error"
      errorMessage = `Row currency ${ev.currency} does not match account currency ${accountCurrency}`
    }
    return {
      kind: ev.kind,
      symbol: ev.symbol,
      date: ev.date.toISOString(),
      quantity: ev.kind === "dividend" ? null : ev.quantity,
      price: ev.kind === "dividend" ? null : ev.price,
      amount: ev.kind === "dividend" ? ev.amount : ev.quantity * ev.price,
      withheldTax: ev.kind === "dividend" ? ev.withheldTax : null,
      fees: ev.kind === "dividend" ? 0 : ev.fees,
      externalId: ev.externalId,
      status,
      errorMessage,
    }
  })
}

function buildSummary(
  parsed: ParsedImport,
  existing: Set<string>,
  rows: ImportTradesRow[]
): ImportTradesSummary {
  const trades = parsed.events.filter((e) => e.kind !== "dividend")
  const dividends = parsed.events.filter((e) => e.kind === "dividend")
  return {
    clientAccountId: parsed.clientAccountId,
    tradesFound: trades.length,
    tradesToCreate: trades.filter((t) => !existing.has(t.externalId)).length,
    tradesSkippedAsDuplicate: trades.filter((t) => existing.has(t.externalId)).length,
    dividendsFound: dividends.length,
    dividendsToCreate: dividends.filter((d) => !existing.has(d.externalId)).length,
    dividendsSkippedAsDuplicate: dividends.filter((d) => existing.has(d.externalId)).length,
    depositsFound: parsed.deposits.length,
    depositsTotalAmount: parsed.deposits.reduce((s, d) => s + d.amount, 0),
    rowErrors: parsed.errors.length + rows.filter((r) => r.status === "error").length,
  }
}

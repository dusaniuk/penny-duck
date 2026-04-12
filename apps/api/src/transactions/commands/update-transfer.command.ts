import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import {
  toResponse,
  validateExchangeRate,
} from "../helpers/transaction.helpers"

interface UpdateTransferFields {
  amount?: number
  date?: Date
  note?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  madeById?: string
}

export class UpdateTransferCommand extends Command<[Transaction, Transaction]> {
  constructor(
    public readonly transferId: string,
    public readonly organizationId: string,
    public readonly fields: UpdateTransferFields
  ) {
    super()
  }
}

@CommandHandler(UpdateTransferCommand)
export class UpdateTransferHandler implements ICommandHandler<UpdateTransferCommand> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(
    cmd: UpdateTransferCommand
  ): Promise<[Transaction, Transaction]> {
    const pair = await this.transactionRepo.findByTransferId(cmd.transferId, cmd.organizationId)
    if (pair.length !== 2) throw new NotFoundException("Transaction not found")

    const outgoing = pair.find((t) => t.amount < 0)!
    const incoming = pair.find((t) => t.amount > 0)!

    const { fields } = cmd

    const outgoingUpdate: Record<string, unknown> = {}
    const incomingUpdate: Record<string, unknown> = {}

    if (fields.note !== undefined) {
      outgoingUpdate.note = fields.note
      incomingUpdate.note = fields.note
    }
    if (fields.date !== undefined) {
      outgoingUpdate.date = fields.date
      incomingUpdate.date = fields.date
    }
    if (fields.madeById !== undefined) {
      const isMember = await this.transactionRepo.isMemberOfOrg(
        fields.madeById,
        cmd.organizationId
      )
      if (!isMember)
        throw new BadRequestException("User is not a member of this organization")
      outgoingUpdate.madeById = fields.madeById
      incomingUpdate.madeById = fields.madeById
    }

    const hasNewExchangeRate =
      fields.originalAmount != null &&
      fields.originalCurrency != null &&
      fields.exchangeRate != null

    if (fields.amount !== undefined) {
      if (fields.amount <= 0)
        throw new BadRequestException("Amount must be greater than 0")
      outgoingUpdate.amount = -fields.amount
      if (hasNewExchangeRate) {
        incomingUpdate.amount = fields.originalAmount!
      } else {
        incomingUpdate.amount = fields.amount
      }
    }

    if (
      fields.originalAmount !== undefined &&
      fields.originalCurrency !== undefined &&
      fields.exchangeRate !== undefined
    ) {
      if (
        fields.originalAmount === null ||
        fields.originalCurrency === null ||
        fields.exchangeRate === null
      ) {
        outgoingUpdate.originalAmount = null
        outgoingUpdate.originalCurrency = null
        outgoingUpdate.exchangeRate = null
      } else {
        validateExchangeRate(
          fields.originalAmount,
          fields.originalCurrency,
          fields.exchangeRate
        )
        outgoingUpdate.originalAmount = fields.originalAmount
        outgoingUpdate.originalCurrency = fields.originalCurrency
        outgoingUpdate.exchangeRate = fields.exchangeRate
        if (fields.amount === undefined) {
          incomingUpdate.amount = fields.originalAmount
        }
      }
    }

    const [outRow, inRow] = await this.transactionRepo.updateTransferPair(
      outgoing.id,
      outgoingUpdate,
      incoming.id,
      incomingUpdate,
      cmd.organizationId
    )

    return [toResponse(outRow), toResponse(inRow)]
  }
}

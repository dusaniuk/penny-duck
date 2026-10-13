import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { organizationMembers, walletInbox } from "@workspace/db"
import type { InboxItem } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { db } from "@/db"
import { createAccount } from "@/modules/accounts/service"
import { auth } from "@/modules/auth/auth"
import { signupUser, truncateAll, type TestUser } from "@/test/setup"

let user: TestUser
let apiKey: string
let accountId: string

async function createKeyFor(u: TestUser): Promise<string> {
  const created = await auth.api.createApiKey({
    body: { name: "Phone" },
    headers: new Headers({ cookie: u.cookie }),
  })
  return created.key
}

function ingest(body: unknown, key: string | null = apiKey) {
  return honoApp.request("/inbox/wallet", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "x-api-key": key } : {}),
    },
    body: JSON.stringify(body),
  })
}

const tap = {
  card: "Mono Black",
  merchant: "Silpo",
  description: "SILPO KYIV",
  amount: 123.45,
  currency: "UAH",
  occurredAt: "2026-10-13T10:15:00+03:00",
}

const tapWithoutCurrency: Partial<typeof tap> = { ...tap }
delete tapWithoutCurrency.currency

beforeEach(async () => {
  await truncateAll()
  user = await signupUser()
  apiKey = await createKeyFor(user)
  const account = await createAccount({
    organizationId: user.organizationId,
    userId: user.userId,
    name: "Mono",
    type: "bank",
    currency: "UAH",
    cardLabel: "Mono Black",
  })
  accountId = account.id
})

describe("POST /inbox/wallet", () => {
  it("stores a pending row matched to the labelled account", async () => {
    const res = await ingest(tap)
    expect(res.status).toBe(201)
    const item = (await res.json()) as InboxItem
    expect(item.status).toBe("pending")
    expect(item.accountId).toBe(accountId)
    expect(item.amount).toBe(123.45)
    expect(item.currency).toBe("UAH")
    expect(item.merchant).toBe("Silpo")
    expect(item.description).toBe("SILPO KYIV")
    expect(new Date(item.occurredAt).toISOString()).toBe(
      "2026-10-13T07:15:00.000Z"
    )
    expect(item.transactionId).toBeNull()
  })

  it("matches the card label case- and whitespace-insensitively", async () => {
    const res = await ingest({ ...tap, card: "  mono black " })
    expect(res.status).toBe(201)
    expect(((await res.json()) as InboxItem).accountId).toBe(accountId)
  })

  it("picks the oldest account when two share a label", async () => {
    await createAccount({
      organizationId: user.organizationId,
      userId: user.userId,
      name: "Mono Twin",
      type: "bank",
      currency: "UAH",
      cardLabel: "Mono Black",
    })
    const res = await ingest(tap)
    expect(((await res.json()) as InboxItem).accountId).toBe(accountId)
  })

  it("keeps the row with no account when the card is unknown", async () => {
    const res = await ingest({ ...tap, card: "Unknown Card" })
    expect(res.status).toBe(201)
    expect(((await res.json()) as InboxItem).accountId).toBeNull()
  })

  it("returns the existing row on a duplicate delivery", async () => {
    const first = (await (await ingest(tap)).json()) as InboxItem
    const res = await ingest(tap)
    expect(res.status).toBe(200)
    expect(((await res.json()) as InboxItem).id).toBe(first.id)
    expect(await db.select().from(walletInbox)).toHaveLength(1)
  })

  it("returns a dismissed row on a duplicate delivery instead of a new one", async () => {
    const first = (await (await ingest(tap)).json()) as InboxItem
    await db
      .update(walletInbox)
      .set({ status: "dismissed" })
      .where(eq(walletInbox.id, first.id))
    const res = await ingest(tap)
    expect(res.status).toBe(200)
    const item = (await res.json()) as InboxItem
    expect(item.id).toBe(first.id)
    expect(item.status).toBe("dismissed")
  })

  it("defaults occurredAt to now and uppercases the currency", async () => {
    const before = Date.now()
    const withoutDate: Partial<typeof tap> = { ...tap }
    delete withoutDate.occurredAt
    const res = await ingest({ ...withoutDate, currency: "uah" })
    const item = (await res.json()) as InboxItem
    expect(new Date(item.occurredAt).getTime()).toBeGreaterThanOrEqual(before)
    expect(item.currency).toBe("UAH")
  })

  it("stores blank merchant and description as null", async () => {
    const res = await ingest({ ...tap, merchant: "", description: "   " })
    expect(res.status).toBe(201)
    const item = (await res.json()) as InboxItem
    expect(item.merchant).toBeNull()
    expect(item.description).toBeNull()
  })

  it("rounds amounts to cents", async () => {
    const res = await ingest({ ...tap, amount: 12.345 })
    expect(((await res.json()) as InboxItem).amount).toBe(12.35)
  })

  it("takes the currency from the matched account when none is sent", async () => {
    const res = await ingest(tapWithoutCurrency)
    expect(res.status).toBe(201)
    const item = (await res.json()) as InboxItem
    expect(item.accountId).toBe(accountId)
    expect(item.currency).toBe("UAH")
  })

  it("stores no currency when the card is unknown and none is sent", async () => {
    const res = await ingest({ ...tapWithoutCurrency, card: "Unknown Card" })
    expect(res.status).toBe(201)
    const item = (await res.json()) as InboxItem
    expect(item.accountId).toBeNull()
    expect(item.currency).toBeNull()
  })

  it("dedupes rows that have no currency", async () => {
    const body = { ...tapWithoutCurrency, card: "Unknown Card" }
    const first = (await (await ingest(body)).json()) as InboxItem
    const res = await ingest(body)
    expect(res.status).toBe(200)
    expect(((await res.json()) as InboxItem).id).toBe(first.id)
  })

  it("parses locale-formatted amount strings", async () => {
    const cases: Array<[string, number]> = [
      ["$1,234.56", 1234.56],
      ["6,75 €", 6.75],
      ["1.234,56", 1234.56],
      ["6.750", 6750],
      ["12", 12],
      ["0.5", 0.5],
    ]
    for (const [text, expected] of cases) {
      const res = await ingest({
        ...tap,
        amount: text,
        occurredAt: `2026-10-13T10:${String(cases.findIndex(([t]) => t === text)).padStart(2, "0")}:00+03:00`,
      })
      expect(res.status).toBe(201)
      expect(((await res.json()) as InboxItem).amount).toBe(expected)
    }
  })

  it("rejects amount strings that are not a positive number", async () => {
    expect((await ingest({ ...tap, amount: "abc" })).status).toBe(400)
    expect((await ingest({ ...tap, amount: "-5.00" })).status).toBe(400)
    expect((await ingest({ ...tap, amount: "" })).status).toBe(400)
    expect(await db.select().from(walletInbox)).toHaveLength(0)
  })

  it("rejects an invalid body", async () => {
    expect((await ingest({ ...tap, amount: 0 })).status).toBe(400)
    expect((await ingest({ ...tap, amount: -5 })).status).toBe(400)
    expect((await ingest({ ...tap, amount: 1_000_001 })).status).toBe(400)
    expect((await ingest({ ...tap, currency: "UAHH" })).status).toBe(400)
    expect((await ingest({ merchant: "x" })).status).toBe(400)
    expect((await ingest({ ...tap, occurredAt: "yesterday" })).status).toBe(400)
  })

  it("rejects a missing, unknown or deleted key", async () => {
    expect((await ingest(tap, null)).status).toBe(401)
    expect((await ingest(tap, "pd_nope")).status).toBe(401)

    const created = await auth.api.createApiKey({
      body: { name: "Old" },
      headers: new Headers({ cookie: user.cookie }),
    })
    await auth.api.deleteApiKey({
      body: { keyId: created.id },
      headers: new Headers({ cookie: user.cookie }),
    })
    expect((await ingest(tap, created.key)).status).toBe(401)
    expect(await db.select().from(walletInbox)).toHaveLength(0)
  })

  it("rejects a key without the inbox permission", async () => {
    const created = await auth.api.createApiKey({
      body: {
        name: "Other",
        userId: user.userId,
        permissions: { users: ["read"] },
      },
    })
    expect((await ingest(tap, created.key)).status).toBe(401)
  })

  it("returns 429 once the key's rate limit is exhausted", async () => {
    const created = await auth.api.createApiKey({
      body: {
        name: "Throttled",
        userId: user.userId,
        rateLimitEnabled: true,
        rateLimitMax: 1,
        rateLimitTimeWindow: 60_000,
      },
    })
    expect((await ingest(tap, created.key)).status).toBe(201)
    const res = await ingest(
      { ...tap, occurredAt: "2026-10-13T11:00:00+03:00" },
      created.key
    )
    expect(res.status).toBe(429)
    expect(await db.select().from(walletInbox)).toHaveLength(1)
  })

  it("rejects a key whose owner has no organization", async () => {
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.userId, user.userId))
    expect((await ingest(tap)).status).toBe(401)
    expect(await db.select().from(walletInbox)).toHaveLength(0)
  })

  it("does not require a session cookie", async () => {
    const res = await honoApp.request("/inbox/wallet", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(tap),
    })
    expect(res.status).toBe(201)
  })
})

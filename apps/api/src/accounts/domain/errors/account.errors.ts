export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found")
    this.name = "AccountNotFoundError"
  }
}

export class AccountHasTransactionsError extends Error {
  constructor(public readonly count: number) {
    super(
      `Account has ${count} transaction${count !== 1 ? "s" : ""} and cannot be deleted`
    )
    this.name = "AccountHasTransactionsError"
  }
}

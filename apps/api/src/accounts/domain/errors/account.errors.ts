export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found")
    this.name = "AccountNotFoundError"
  }
}

export class InvalidDeleteModeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidDeleteModeError"
  }
}

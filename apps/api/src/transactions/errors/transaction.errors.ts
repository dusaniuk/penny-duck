export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found")
    this.name = "TransactionNotFoundError"
  }
}

export class InvalidTransferError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidTransferError"
  }
}

export class InvalidSettlementError extends Error {
  constructor() {
    super("Can only settle shared transactions")
    this.name = "InvalidSettlementError"
  }
}

export class TransferOperationError extends Error {
  constructor() {
    super("Use the transfer endpoint to modify transfer transactions")
    this.name = "TransferOperationError"
  }
}

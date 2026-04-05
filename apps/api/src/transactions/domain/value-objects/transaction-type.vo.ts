const VALID_TYPES = ["expense", "income", "transfer"] as const
export type TransactionTypeValue = (typeof VALID_TYPES)[number]

export class TransactionType {
  private constructor(private readonly _value: TransactionTypeValue) {}

  static create(raw: string): TransactionType {
    if (!VALID_TYPES.includes(raw as TransactionTypeValue))
      throw new Error(
        `Invalid transaction type: ${raw}. Must be one of: ${VALID_TYPES.join(", ")}`
      )
    return new TransactionType(raw as TransactionTypeValue)
  }

  get value(): TransactionTypeValue {
    return this._value
  }

  get isTransfer(): boolean {
    return this._value === "transfer"
  }

  get isExpense(): boolean {
    return this._value === "expense"
  }

  get isIncome(): boolean {
    return this._value === "income"
  }
}

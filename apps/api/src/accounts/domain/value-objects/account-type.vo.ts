const VALID_TYPES = ["bank", "cash"] as const
export type AccountTypeValue = (typeof VALID_TYPES)[number]

export class AccountType {
  private constructor(private readonly _value: AccountTypeValue) {}

  static create(raw: string): AccountType {
    if (!VALID_TYPES.includes(raw as AccountTypeValue))
      throw new Error(
        `Invalid account type: ${raw}. Must be one of: ${VALID_TYPES.join(", ")}`
      )
    return new AccountType(raw as AccountTypeValue)
  }

  get value(): AccountTypeValue {
    return this._value
  }
}

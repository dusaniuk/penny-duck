import { isValidCurrencyCode } from "@workspace/shared/currencies"

export class Currency {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Currency {
    const trimmed = raw.trim()
    if (trimmed.length === 0) throw new Error("Currency code cannot be empty")
    const upper = trimmed.toUpperCase()
    if (upper.length !== 3)
      throw new Error("Currency code must be 3 characters")
    if (!isValidCurrencyCode(upper))
      throw new Error(`Invalid currency code: ${upper}`)
    return new Currency(upper)
  }

  get value(): string {
    return this._value
  }
}

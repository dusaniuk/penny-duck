import { isValidCurrencyCode } from "@workspace/shared/currencies"

export class ExchangeRate {
  private constructor(
    private readonly _originalAmount: number,
    private readonly _originalCurrency: string,
    private readonly _rate: number
  ) {}

  static create(
    originalAmount: number,
    originalCurrency: string,
    rate: number
  ): ExchangeRate {
    if (originalAmount <= 0)
      throw new Error("Original amount must be greater than 0")
    const upper = originalCurrency.trim().toUpperCase()
    if (upper.length !== 3 || !isValidCurrencyCode(upper))
      throw new Error(`Invalid currency code: ${originalCurrency}`)
    if (rate <= 0) throw new Error("Exchange rate must be greater than 0")
    return new ExchangeRate(originalAmount, upper, rate)
  }

  get originalAmount(): number {
    return this._originalAmount
  }

  get originalCurrency(): string {
    return this._originalCurrency
  }

  get rate(): number {
    return this._rate
  }
}

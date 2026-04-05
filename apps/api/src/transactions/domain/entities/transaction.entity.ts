import { ExchangeRate } from "../value-objects/exchange-rate.vo"
import { TransactionType } from "../value-objects/transaction-type.vo"

interface CreateTransactionInput {
  userId: string
  accountId: string
  type: string
  amount: number
  categoryId: string | null
  date: Date
  note?: string | null
  myShare?: number | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

interface CreateTransferSideInput {
  userId: string
  accountId: string
  amount: number
  date: Date
  note?: string | null
  transferId: string
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

interface TransactionData {
  id: string
  userId: string
  accountId: string
  type: string
  amount: number
  categoryId: string | null
  note: string | null
  date: Date
  myShare: number | null
  settled: boolean
  originalAmount: number | null
  originalCurrency: string | null
  exchangeRate: number | null
  transferId: string | null
  createdAt: Date
  updatedAt: Date
}

export class Transaction {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _accountId: string,
    private _type: TransactionType,
    private _amount: number,
    private _categoryId: string | null,
    private _note: string | null,
    private _date: Date,
    private _myShare: number | null,
    private _settled: boolean,
    private _exchangeRate: ExchangeRate | null,
    private _transferId: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(input: CreateTransactionInput): Transaction {
    const type = TransactionType.create(input.type)

    if (input.amount <= 0) throw new Error("Amount must be greater than 0")

    if (!type.isTransfer && !input.categoryId)
      throw new Error(
        "Category is required for expense and income transactions"
      )

    Transaction.validateMyShare(input.myShare ?? null, input.amount)

    const exchangeRate = Transaction.buildExchangeRate(
      input.originalAmount ?? null,
      input.originalCurrency ?? null,
      input.exchangeRate ?? null
    )

    const settled = input.myShare != null ? false : true

    return new Transaction(
      "",
      input.userId,
      input.accountId,
      type,
      input.amount,
      input.categoryId ?? null,
      input.note ?? null,
      input.date,
      input.myShare ?? null,
      settled,
      exchangeRate,
      null,
      new Date(),
      new Date()
    )
  }

  static createTransferSide(input: CreateTransferSideInput): Transaction {
    if (input.amount <= 0) throw new Error("Amount must be greater than 0")

    const exchangeRate = Transaction.buildExchangeRate(
      input.originalAmount ?? null,
      input.originalCurrency ?? null,
      input.exchangeRate ?? null
    )

    return new Transaction(
      "",
      input.userId,
      input.accountId,
      TransactionType.create("transfer"),
      input.amount,
      null,
      input.note ?? null,
      input.date,
      null,
      true,
      exchangeRate,
      input.transferId,
      new Date(),
      new Date()
    )
  }

  static fromPersistence(data: TransactionData): Transaction {
    const exchangeRate =
      data.originalAmount != null &&
      data.originalCurrency != null &&
      data.exchangeRate != null
        ? ExchangeRate.create(
            data.originalAmount,
            data.originalCurrency,
            data.exchangeRate
          )
        : null

    return new Transaction(
      data.id,
      data.userId,
      data.accountId,
      TransactionType.create(data.type),
      data.amount,
      data.categoryId,
      data.note,
      data.date,
      data.myShare,
      data.settled,
      exchangeRate,
      data.transferId,
      data.createdAt,
      data.updatedAt
    )
  }

  private static validateMyShare(
    myShare: number | null,
    amount: number
  ): void {
    if (myShare == null) return
    if (myShare <= 0) throw new Error("My share must be greater than 0")
    if (myShare >= amount)
      throw new Error("My share must be less than the total amount")
  }

  private static buildExchangeRate(
    originalAmount: number | null,
    originalCurrency: string | null,
    exchangeRate: number | null
  ): ExchangeRate | null {
    const fields = [originalAmount, originalCurrency, exchangeRate]
    const provided = fields.filter((f) => f != null).length
    if (provided === 0) return null
    if (provided !== 3)
      throw new Error(
        "Exchange rate fields must all be provided or all omitted"
      )
    return ExchangeRate.create(
      originalAmount!,
      originalCurrency!,
      exchangeRate!
    )
  }

  markAsSettled(): void {
    this._settled = true
    this._updatedAt = new Date()
  }

  updateAmount(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be greater than 0")
    this._amount = amount
    this._updatedAt = new Date()
  }

  updateNote(note: string | null): void {
    this._note = note
    this._updatedAt = new Date()
  }

  updateDate(date: Date): void {
    this._date = date
    this._updatedAt = new Date()
  }

  updateCategory(categoryId: string | null): void {
    if (!this._type.isTransfer && !categoryId)
      throw new Error(
        "Category is required for expense and income transactions"
      )
    this._categoryId = categoryId
    this._updatedAt = new Date()
  }

  updateMyShare(myShare: number): void {
    Transaction.validateMyShare(myShare, this._amount)
    this._myShare = myShare
    this._settled = false
    this._updatedAt = new Date()
  }

  clearMyShare(): void {
    this._myShare = null
    this._settled = true
    this._updatedAt = new Date()
  }

  updateExchangeRate(
    originalAmount: number,
    originalCurrency: string,
    rate: number
  ): void {
    this._exchangeRate = ExchangeRate.create(
      originalAmount,
      originalCurrency,
      rate
    )
    this._updatedAt = new Date()
  }

  clearExchangeRate(): void {
    this._exchangeRate = null
    this._updatedAt = new Date()
  }

  get id(): string {
    return this._id
  }
  get userId(): string {
    return this._userId
  }
  get accountId(): string {
    return this._accountId
  }
  get type(): string {
    return this._type.value
  }
  get amount(): number {
    return this._amount
  }
  get categoryId(): string | null {
    return this._categoryId
  }
  get note(): string | null {
    return this._note
  }
  get date(): Date {
    return this._date
  }
  get myShare(): number | null {
    return this._myShare
  }
  get settled(): boolean {
    return this._settled
  }
  get exchangeRate(): ExchangeRate | null {
    return this._exchangeRate
  }
  get transferId(): string | null {
    return this._transferId
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
  get isShared(): boolean {
    return this._myShare != null
  }
  get isTransfer(): boolean {
    return this._type.isTransfer
  }
  get isExpense(): boolean {
    return this._type.isExpense
  }
  get isIncome(): boolean {
    return this._type.isIncome
  }
}

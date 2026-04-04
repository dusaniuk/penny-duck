import { AccountType } from "../value-objects/account-type.vo"
import { Currency } from "../value-objects/currency.vo"

interface AccountData {
  id: string
  userId: string
  name: string
  type: string
  currency: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

export class Account {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private _name: string,
    private _type: AccountType,
    private readonly _currency: Currency,
    private _balance: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(
    userId: string,
    name: string,
    type: string,
    currency: string,
    balance: number = 0
  ): Account {
    return new Account(
      "",
      userId,
      name,
      AccountType.create(type),
      Currency.create(currency),
      balance,
      new Date(),
      new Date()
    )
  }

  static fromPersistence(data: AccountData): Account {
    return new Account(
      data.id,
      data.userId,
      data.name,
      AccountType.create(data.type),
      Currency.create(data.currency),
      data.balance,
      data.createdAt,
      data.updatedAt
    )
  }

  updateName(name: string): void {
    this._name = name
    this._updatedAt = new Date()
  }

  updateType(type: string): void {
    this._type = AccountType.create(type)
    this._updatedAt = new Date()
  }

  adjustBalance(amount: number): void {
    this._balance += amount
    this._updatedAt = new Date()
  }

  get id(): string {
    return this._id
  }

  get userId(): string {
    return this._userId
  }

  get name(): string {
    return this._name
  }

  get type(): string {
    return this._type.value
  }

  get currency(): string {
    return this._currency.value
  }

  get balance(): number {
    return this._balance
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }
}

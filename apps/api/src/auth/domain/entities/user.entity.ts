import { Password } from "../value-objects/password.vo"

interface UserData {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _email: string,
    private readonly _name: string,
    private readonly _passwordHash: string,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {}

  static async register(
    name: string,
    rawEmail: string,
    rawPassword: string
  ): Promise<User> {
    const password = Password.create(rawPassword)
    const hash = await password.hash()

    return new User(
      "", // ID assigned by database
      rawEmail.trim().toLowerCase(),
      name,
      hash,
      new Date(),
      new Date()
    )
  }

  static fromPersistence(data: UserData): User {
    return new User(
      data.id,
      data.email,
      data.name,
      data.passwordHash,
      data.createdAt,
      data.updatedAt
    )
  }

  async verifyPassword(raw: string): Promise<boolean> {
    return Password.verify(raw, this._passwordHash)
  }

  get id(): string {
    return this._id
  }
  get email(): string {
    return this._email
  }
  get name(): string {
    return this._name
  }
  get passwordHash(): string {
    return this._passwordHash
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}

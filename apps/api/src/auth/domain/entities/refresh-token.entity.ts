import { randomBytes } from "node:crypto"
import * as bcrypt from "bcrypt"
import { TokenFamily } from "../value-objects/token-family.vo"

const SALT_ROUNDS = 12

interface RefreshTokenData {
  id: string
  userId: string
  tokenHash: string
  familyId: string
  revoked: boolean
  expiresAt: Date
  createdAt: Date
}

export class RefreshToken {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _tokenHash: string,
    private readonly _familyId: string,
    private _revoked: boolean,
    private readonly _expiresAt: Date,
    private readonly _createdAt: Date
  ) {}

  static async issue(
    userId: string,
    family: TokenFamily,
    expirationDays: number
  ): Promise<{ token: RefreshToken; rawValue: string }> {
    const rawValue = randomBytes(48).toString("base64url")
    const tokenHash = await bcrypt.hash(rawValue, SALT_ROUNDS)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expirationDays)

    const token = new RefreshToken(
      "",
      userId,
      tokenHash,
      family.value,
      false,
      expiresAt,
      new Date()
    )

    return { token, rawValue }
  }

  static fromPersistence(data: RefreshTokenData): RefreshToken {
    return new RefreshToken(
      data.id,
      data.userId,
      data.tokenHash,
      data.familyId,
      data.revoked,
      data.expiresAt,
      data.createdAt
    )
  }

  async verifyToken(rawValue: string): Promise<boolean> {
    return bcrypt.compare(rawValue, this._tokenHash)
  }

  revoke(): void {
    this._revoked = true
  }

  isExpired(): boolean {
    return new Date() > this._expiresAt
  }

  get id(): string {
    return this._id
  }
  get userId(): string {
    return this._userId
  }
  get tokenHash(): string {
    return this._tokenHash
  }
  get familyId(): string {
    return this._familyId
  }
  get revoked(): boolean {
    return this._revoked
  }
  get expiresAt(): Date {
    return this._expiresAt
  }
  get createdAt(): Date {
    return this._createdAt
  }
}

import * as bcrypt from "bcrypt"

const SALT_ROUNDS = 12

export class Password {
  private constructor(private readonly _raw: string) {}

  static create(raw: string): Password {
    if (raw.length < 8) {
      throw new Error("Password must be at least 8 characters")
    }
    if (raw.length > 128) {
      throw new Error("Password must be at most 128 characters")
    }
    return new Password(raw)
  }

  async hash(): Promise<string> {
    return bcrypt.hash(this._raw, SALT_ROUNDS)
  }

  static async verify(raw: string, hash: string): Promise<boolean> {
    return bcrypt.compare(raw, hash)
  }
}

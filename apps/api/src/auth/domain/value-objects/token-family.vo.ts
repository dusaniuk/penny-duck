import { randomUUID } from "node:crypto"

export class TokenFamily {
  private constructor(private readonly _value: string) {}

  static create(): TokenFamily {
    return new TokenFamily(randomUUID())
  }

  static fromExisting(id: string): TokenFamily {
    return new TokenFamily(id)
  }

  get value(): string {
    return this._value
  }
}

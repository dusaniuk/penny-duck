export class Email {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Email {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      throw new Error("Email cannot be empty")
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      throw new Error("Invalid email format")
    }

    return new Email(trimmed.toLowerCase())
  }

  get value(): string {
    return this._value
  }

  equals(other: Email): boolean {
    return this._value === other._value
  }
}

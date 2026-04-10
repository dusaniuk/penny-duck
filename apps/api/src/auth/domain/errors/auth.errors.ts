export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password")
    this.name = "InvalidCredentialsError"
  }
}

export class TokenReuseDetectedError extends Error {
  constructor(public readonly familyId: string) {
    super("Session invalidated")
    this.name = "TokenReuseDetectedError"
  }
}

export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired")
    this.name = "TokenExpiredError"
  }
}

export class InvalidTokenError extends Error {
  constructor() {
    super("Invalid token")
    this.name = "InvalidTokenError"
  }
}

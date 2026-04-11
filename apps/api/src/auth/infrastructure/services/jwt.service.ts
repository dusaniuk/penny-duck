import { Injectable } from "@nestjs/common"
import { JwtService as NestJwtService } from "@nestjs/jwt"

export interface AccessTokenPayload {
  sub: string
  email: string
  organizationId: string
}

@Injectable()
export class JwtService {
  constructor(private readonly jwt: NestJwtService) {}

  sign(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload)
  }

  verify(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token)
  }
}

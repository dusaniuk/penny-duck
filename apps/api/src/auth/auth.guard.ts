import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Request } from "express"
import { env } from "@workspace/env/api"
import {
  verifyAccessToken,
  type AccessTokenPayload,
} from "./core/jwt"
import { ACCESS_TOKEN_COOKIE } from "./core/cookies"

type AuthenticatedRequest = Request & { user?: AccessTokenPayload }

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE]

    if (!token) throw new UnauthorizedException()

    const payload = verifyAccessToken(token, env.JWT_SECRET)
    if (!payload) throw new UnauthorizedException()

    request.user = payload
    return true
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Request } from "express"
import { JwtService } from "./jwt.service"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const token = request.cookies?.access_token

    if (!token) throw new UnauthorizedException()

    try {
      const payload = this.jwtService.verify(token)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(request as any)["user"] = payload
      return true
    } catch {
      throw new UnauthorizedException()
    }
  }
}

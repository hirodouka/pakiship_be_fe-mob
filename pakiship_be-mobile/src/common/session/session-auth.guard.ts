import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { parseCookieHeader, readSessionToken, SESSION_COOKIE } from "./session.util";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const cookies = parseCookieHeader(request.headers.cookie);
    const session = readSessionToken(cookies[SESSION_COOKIE]);

    if (!session) {
      throw new UnauthorizedException("You must be logged in to access this resource.");
    }

    request.user = session;
    return true;
  }
}

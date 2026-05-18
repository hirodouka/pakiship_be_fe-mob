import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "../common/session/session-auth.guard";
import {
  createSessionToken,
  getSessionCookieOptions,
  parseCookieHeader,
  readSessionToken,
  SESSION_COOKIE,
} from "../common/session/session.util";
import type { SessionPayload, UserRole } from "../common/session/session.types";

function getSessionUser(request: Request) {
  return (request as Request & { user: SessionPayload }).user;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const role = body.role as UserRole;
    const emailOrMobile = String(body.emailOrMobile ?? "");
    const identifier = String(body.identifier ?? emailOrMobile);
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      throw new BadRequestException("Identifier (or email/mobile) and password are required.");
    }

    const result = await this.authService.signIn(identifier, password, role);
    const requiresTwoFactor = "requiresTwoFactor" in result && result.requiresTwoFactor;

    if (!requiresTwoFactor) {
      response.cookie(
        SESSION_COOKIE,
        createSessionToken(result.session),
        getSessionCookieOptions(),
      );
    }

    return {
      user: result.user,
      redirectPath: result.redirectPath,
      requiresTwoFactor,
      challengeToken:
        requiresTwoFactor && "challengeToken" in result ? result.challengeToken : undefined,
    };
  }

  @Post("login/verify-2fa")
  async verifyTwoFactor(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const challengeToken = String(body.challengeToken ?? "");
    const code = String(body.code ?? "");

    if (!challengeToken || !code) {
      throw new BadRequestException("Challenge token and verification code are required.");
    }

    const result = await this.authService.verifyTwoFactorLogin(challengeToken, code);
    response.cookie(
      SESSION_COOKIE,
      createSessionToken(result.session),
      getSessionCookieOptions(),
    );

    return {
      user: result.user,
      redirectPath: result.redirectPath,
    };
  }

  @Post("signup")
  async signup(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (body.mobile && !body.phone) body.phone = body.mobile;
    if (body.street && !body.address) body.address = body.street;

    const requiredFields = [
      "fullName",
      "email",
      "phone",
      "dob",
      "password",
      "role",
      "address",
      "city",
      "province",
    ] as const;

    for (const field of requiredFields) {
      if (!body[field]) {
        throw new BadRequestException(`Missing required field: ${field}`);
      }
    }

    const result = await this.authService.createUser({
      fullName: String(body.fullName),
      email: String(body.email),
      phone: String(body.phone),
      dob: String(body.dob),
      password: String(body.password),
      role: body.role as UserRole,
      address: String(body.address),
      city: String(body.city),
      province: String(body.province),
      documents: Array.isArray(body.documents)
        ? body.documents.map((item) => String(item))
        : [],
    });

    response.cookie(
      SESSION_COOKIE,
      createSessionToken(result.session),
      getSessionCookieOptions(),
    );

    return {
      user: result.user,
      redirectPath: result.redirectPath,
    };
  }

  @Post("forgot-password")
  async forgotPassword(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
  ) {
    const role = body.role as UserRole;
    const email = String(body.email ?? "");
    const identifier = String(body.identifier ?? email);

    if (!identifier) {
      throw new BadRequestException("Identifier or email is required.");
    }

    const originHeader = request.headers.origin;
    const forwardedProto = request.headers["x-forwarded-proto"];
    const forwardedHost = request.headers["x-forwarded-host"];
    const fallbackOrigin = process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim();
    const derivedOrigin =
      originHeader ||
      (forwardedProto && forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : undefined) ||
      fallbackOrigin ||
      "http://localhost:3000";

    return this.authService.sendPasswordReset(role, identifier, derivedOrigin);
  }

  @Post("reset-password/otp")
  async resetPasswordWithOtp(@Body() body: Record<string, unknown>) {
    const identifier = String(body.identifier ?? body.email ?? "");
    const code = String(body.code ?? "");
    const newPassword = String(body.newPassword ?? "");
    const otpId = body.otpId ? String(body.otpId) : undefined;

    if (!identifier) {
      throw new BadRequestException("Identifier or email is required.");
    }

    return this.authService.resetPasswordWithOtp({
      identifier,
      code,
      newPassword,
      otpId,
    });
  }

  @Post("change-password")
  @UseGuards(SessionAuthGuard)
  changePassword(@Req() request: Request, @Body() body: Record<string, unknown>) {
    return this.authService.changePassword(
      getSessionUser(request),
      String(body.currentPassword ?? ""),
      String(body.newPassword ?? ""),
    );
  }

  @Post("two-factor/setup")
  @UseGuards(SessionAuthGuard)
  setupTwoFactor(@Req() request: Request) {
    return this.authService.setupTwoFactor(getSessionUser(request));
  }

  @Post("two-factor/enable")
  @UseGuards(SessionAuthGuard)
  enableTwoFactor(@Req() request: Request, @Body() body: Record<string, unknown>) {
    return this.authService.enableTwoFactor(
      getSessionUser(request),
      String(body.code ?? ""),
    );
  }

  @Post("two-factor/disable")
  @UseGuards(SessionAuthGuard)
  disableTwoFactor(@Req() request: Request, @Body() body: Record<string, unknown>) {
    return this.authService.disableTwoFactor(
      getSessionUser(request),
      String(body.code ?? ""),
    );
  }

  @Get("session")
  getSession(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookies = parseCookieHeader(request.headers.cookie);
    const session = readSessionToken(cookies[SESSION_COOKIE]);

    if (!session) {
      response.status(401);
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: session,
    };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(SESSION_COOKIE, getSessionCookieOptions());
    return { message: "Logged out successfully" };
  }
}

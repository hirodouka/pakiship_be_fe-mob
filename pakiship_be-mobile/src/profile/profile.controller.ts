import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionAuthGuard } from "../common/session/session-auth.guard";
import type { SessionPayload } from "../common/session/session.types";
import { ProfileService } from "./profile.service";

function getSessionUser(request: Request) {
  return (request as Request & { user: SessionPayload }).user;
}

@Controller("profile")
@UseGuards(SessionAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get("me")
  getMyProfile(@Req() request: Request) {
    return this.profileService.getMyProfile(getSessionUser(request));
  }

  @Patch("me")
  updateMyProfile(
    @Req() request: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.profileService.updateMyProfile(getSessionUser(request), body);
  }
}

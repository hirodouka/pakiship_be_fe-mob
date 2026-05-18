import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionAuthGuard } from "../common/session/session-auth.guard";
import type { SessionPayload } from "../common/session/session.types";
import { ParcelDraftsService } from "./parcel-drafts.service";

function getSessionUser(request: Request) {
  return (request as Request & { user: SessionPayload }).user;
}

@Controller("pakiship/mobile/parcels")
@UseGuards(SessionAuthGuard)
export class ParcelMobileController {
  constructor(private readonly parcelDraftsService: ParcelDraftsService) {}

  @Post()
  createParcel(@Req() request: Request, @Body() body: Record<string, unknown>) {
    return this.parcelDraftsService.completeBooking(getSessionUser(request), body.draftId as string, body);
  }

  @Get()
  listParcels(
    @Req() request: Request,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.parcelDraftsService.getHistory(getSessionUser(request));
  }

  @Get(":id")
  getParcelDetail(@Req() request: Request, @Param("id") id: string) {
    return this.parcelDraftsService.getTrackingDetails(id);
  }

  @Patch(":id/cancel")
  cancelParcel(@Req() request: Request, @Param("id") id: string) {
    return this.parcelDraftsService.cancelBooking(getSessionUser(request), id);
  }
}

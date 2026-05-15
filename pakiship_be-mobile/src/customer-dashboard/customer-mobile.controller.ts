import { FileInterceptor } from "@nestjs/platform-express";
import {
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionAuthGuard } from "../common/session/session-auth.guard";
import type { SessionPayload } from "../common/session/session.types";
import { ParcelDraftsService } from "../parcel-drafts/parcel-drafts.service";
import { CustomerProfileService } from "../customer-profile/customer-profile.service";

function getSessionUser(request: Request) {
  return (request as Request & { user: SessionPayload }).user;
}

@Controller("pakiship/mobile/customer")
@UseGuards(SessionAuthGuard)
export class CustomerMobileController {
  constructor(
    private readonly parcelDraftsService: ParcelDraftsService,
    private readonly customerProfileService: CustomerProfileService,
  ) {}

  @Get("profile")
  getProfile(@Req() request: Request) {
    return this.customerProfileService.getCustomerProfile(getSessionUser(request));
  }

  @Post("profile/upload-avatar")
  @UseInterceptors(FileInterceptor("file"))
  uploadAvatar(
    @Req() request: Request,
    @UploadedFile() file?: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.customerProfileService.uploadProfilePicture(getSessionUser(request), file);
  }

  @Get("active-deliveries")
  getActiveDeliveries(@Req() request: Request) {
    return this.parcelDraftsService.getHistory(getSessionUser(request));
  }
}

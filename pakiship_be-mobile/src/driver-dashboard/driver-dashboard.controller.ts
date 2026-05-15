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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { SessionAuthGuard } from "../common/session/session-auth.guard";
import type { SessionPayload } from "../common/session/session.types";
import { DriverDashboardService } from "./driver-dashboard.service";

function getSessionUser(request: Request) {
  return (request as Request & { user: SessionPayload }).user;
}

@Controller("pakiship/mobile/driver")
@UseGuards(SessionAuthGuard)
export class DriverDashboardController {
  constructor(private readonly driverDashboardService: DriverDashboardService) {}

  @Get("profile")
  getProfile(@Req() request: Request) {
    return this.driverDashboardService.getProfile(getSessionUser(request));
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
    return this.driverDashboardService.uploadProfilePicture(getSessionUser(request), file);
  }

  @Patch("profile")
  updateProfile(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const user = getSessionUser(request);
    console.log(`[DriverController] Updating profile for driver ${user.userId}`, body);
    return this.driverDashboardService.updateProfile(user, body);
  }

  @Get("earnings")
  getEarnings(@Req() request: Request, @Query("period") period?: string) {
    return this.driverDashboardService.getEarnings(getSessionUser(request), period || "today");
  }

  @Get("jobs")
  getDashboard(@Req() request: Request) {
    const user = getSessionUser(request);
    console.log(`[DriverController] Fetching dashboard for driver ${user.userId}`);
    // Current dashboard includes jobs, but spec might separate them. 
    // For now, we return the dashboard as the 'jobs' feed.
    return this.driverDashboardService.getDashboard(user);
  }

  @Get("jobs/:jobId")
  getJobDetail(@Req() request: Request, @Param("jobId") jobId: string) {
    return this.driverDashboardService.getJobDetail(getSessionUser(request), jobId);
  }

  @Patch("online-status")
  updatePresence(@Req() request: Request, @Body() body: Record<string, unknown>) {
    if (typeof body.isOnline !== "boolean") {
      throw new BadRequestException("The online status must be provided.");
    }

    return this.driverDashboardService.updatePresence(
      getSessionUser(request),
      body.isOnline,
    );
  }

  @Post("jobs/:jobId/accept")
  acceptJob(@Req() request: Request, @Param("jobId") jobId: string) {
    return this.driverDashboardService.acceptJob(getSessionUser(request), jobId);
  }

  @Post("jobs/:jobId/reject")
  rejectJob(@Req() request: Request, @Param("jobId") jobId: string, @Body() body: Record<string, unknown>) {
    return this.driverDashboardService.rejectJob(getSessionUser(request), jobId, body.reason as string);
  }

  @Get("jobs/:jobId/distance")
  getJobDistance(
    @Req() request: Request,
    @Param("jobId") jobId: string,
    @Query("lat") lat: string,
    @Query("lng") lng: string,
  ) {
    if (!lat || !lng) {
      throw new BadRequestException("Driver coordinates are required.");
    }
    return this.driverDashboardService.getJobDistance(
      getSessionUser(request),
      jobId,
      `${lat},${lng}`,
    );
  }

  @Patch("jobs/:id/status")
  updateParcelStatus(
    @Req() request: Request,
    @Param("id") jobId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parcelStatus = String(body.parcelStatus ?? "");
    return this.driverDashboardService.updateParcelStatus(
      getSessionUser(request),
      jobId,
      parcelStatus,
    );
  }

  @Patch("location")
  updateLocation(
    @Req() request: Request,
    @Body() body: { lat: number; lng: number }
  ) {
    if (!body.lat || !body.lng) {
      throw new BadRequestException("Latitude and longitude are required.");
    }
    return this.driverDashboardService.updateLocation(
      getSessionUser(request),
      body.lat,
      body.lng
    );
  }
}

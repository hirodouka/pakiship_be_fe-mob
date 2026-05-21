import { Controller, Get, Param } from "@nestjs/common";
import { ParcelDraftsService } from "./parcel-drafts.service";

@Controller("parcel-drafts/track")
export class TrackingController {
  constructor(private readonly parcelDraftsService: ParcelDraftsService) {}

  @Get(":trackingNumber")
  getTrackingDetails(@Param("trackingNumber") trackingNumber: string) {
    return this.parcelDraftsService.getTrackingDetails(trackingNumber);
  }
}

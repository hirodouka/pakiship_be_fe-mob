import { Module, forwardRef } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { CustomerNotificationsModule } from "../customer-notifications/customer-notifications.module";
import { ParcelDraftsController } from "./parcel-drafts.controller";
import { ParcelMobileController } from "./parcel-mobile.controller";
import { TrackingController } from "./tracking.controller";
import { ParcelDraftsService } from "./parcel-drafts.service";
import { ParcelDraftsRepository } from "./parcel-drafts.repository";
import { DriverDashboardModule } from "../driver-dashboard/driver-dashboard.module";
import { GoogleMapsModule } from "../google-maps/google-maps.module";
import { DropOffPointsModule } from "../drop-off-points/drop-off-points.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [
    SupabaseModule,
    CustomerNotificationsModule,
    forwardRef(() => DriverDashboardModule),
    GoogleMapsModule,
    DropOffPointsModule,
    PaymentModule,
  ],
  controllers: [ParcelDraftsController, ParcelMobileController, TrackingController],
  providers: [ParcelDraftsService, ParcelDraftsRepository],
  exports: [ParcelDraftsService, ParcelDraftsRepository],
})
export class ParcelDraftsModule {}

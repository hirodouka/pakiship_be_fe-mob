import { Module } from "@nestjs/common";
import { CustomerNotificationsModule } from "../customer-notifications/customer-notifications.module";
import { ParcelDraftsRepository } from "../parcel-drafts/parcel-drafts.repository";
import { SupabaseModule } from "../supabase/supabase.module";
import { OperatorDashboardController } from "./operator-dashboard.controller";
import { OperatorMobileController } from "./operator-mobile.controller";
import { OperatorDashboardService } from "./operator-dashboard.service";
import { ParcelDraftsModule } from "../parcel-drafts/parcel-drafts.module";

@Module({
  imports: [SupabaseModule, CustomerNotificationsModule, ParcelDraftsModule],
  controllers: [OperatorDashboardController, OperatorMobileController],
  providers: [OperatorDashboardService],
})
export class OperatorDashboardModule {}

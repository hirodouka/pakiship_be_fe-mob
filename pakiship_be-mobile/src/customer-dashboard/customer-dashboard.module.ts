import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { ParcelDraftsModule } from "../parcel-drafts/parcel-drafts.module";
import { CustomerDashboardController } from "./customer-dashboard.controller";
import { CustomerMobileController } from "./customer-mobile.controller";
import { CustomerDashboardService } from "./customer-dashboard.service";
import { CustomerNotificationsModule } from "../customer-notifications/customer-notifications.module";
import { CustomerProfileModule } from "../customer-profile/customer-profile.module";

@Module({
  imports: [SupabaseModule, ParcelDraftsModule, CustomerNotificationsModule, CustomerProfileModule],
  controllers: [CustomerDashboardController, CustomerMobileController],
  providers: [CustomerDashboardService],
})
export class CustomerDashboardModule {}

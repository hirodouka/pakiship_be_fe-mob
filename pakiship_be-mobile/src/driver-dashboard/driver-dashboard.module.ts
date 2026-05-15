import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { DriverDashboardController } from "./driver-dashboard.controller";
import { InternalDriverController } from "./internal-driver.controller";
import { DriverDashboardService } from "./driver-dashboard.service";

import { GoogleMapsModule } from "../google-maps/google-maps.module";

@Module({
  imports: [SupabaseModule, GoogleMapsModule],
  controllers: [DriverDashboardController, InternalDriverController],
  providers: [DriverDashboardService],
  exports: [DriverDashboardService],
})
export class DriverDashboardModule {}

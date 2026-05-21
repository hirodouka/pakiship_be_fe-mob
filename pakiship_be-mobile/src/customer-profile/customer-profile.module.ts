import { Module } from "@nestjs/common";
import { CustomerNotificationsModule } from "../customer-notifications/customer-notifications.module";
import { CustomerProfileController } from "./customer-profile.controller";
import { CustomerProfileService } from "./customer-profile.service";
import { GoogleMapsModule } from "../google-maps/google-maps.module";

@Module({
  imports: [CustomerNotificationsModule, GoogleMapsModule],
  controllers: [CustomerProfileController],
  providers: [CustomerProfileService],
  exports: [CustomerProfileService],
})
export class CustomerProfileModule {}

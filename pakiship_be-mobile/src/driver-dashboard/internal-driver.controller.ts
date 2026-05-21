import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { DriverDashboardService } from "./driver-dashboard.service";

@Controller("internal/driver")
export class InternalDriverController {
  constructor(private readonly driverDashboardService: DriverDashboardService) {}

  @Get(":driverId/summary")
  async getDriverSummary(@Param("driverId") driverId: string) {
    const summary = await this.driverDashboardService.getInternalSummary(driverId);
    if (!summary) {
      throw new NotFoundException("Driver not found");
    }
    return summary;
  }
}

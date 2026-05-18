import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/shared-services/schema.prisma",
  datasource: {
    url:
      process.env.SHARED_SERVICES_DATABASE_URL ??
      "postgresql://shared_services_app:password@localhost:5432/postgres",
  },
});

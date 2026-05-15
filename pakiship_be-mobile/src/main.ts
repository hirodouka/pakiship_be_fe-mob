import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  console.log('--- BACKEND STARTING (v2: forcing IPv4) ---');
  const app = await NestFactory.create(AppModule);
  const frontendOrigin =
    process.env.FRONTEND_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  app.enableCors({
    origin: "*",
    credentials: true,
  });

  app.use((req, res, next) => {
    console.log(`[Inbound Request] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });

  app.setGlobalPrefix("api");

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

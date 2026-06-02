import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { Prisma } from "@prisma/client";
import Fastify from "fastify";
import { env } from "./config/env.js";
import monitoringPlugin from "./plugins/monitoring.js";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import dataRoutes from "./routes/data.js";
import monitoringRoutes from "./routes/monitoring.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "SYS:standard",
                ignore: "pid,hostname"
              }
            }
          : undefined
    }
  });

  app.decorateRequest("startTime", 0);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      reply.code(400).send({ message: "Database request failed", code: error.code });
      return;
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      reply.code(400).send({ message: "Invalid database payload" });
      return;
    }

    reply.code(500).send({ message: "Internal server error" });
  });

  app.register(cors, {
    origin: [env.APP_ORIGIN],
    credentials: true
  });

  app.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });

  app.decorate("authorize", (roles) => async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: "Unauthorized" });
      return;
    }

    if (roles?.length && !roles.includes(request.user.role)) {
      reply.code(403).send({ message: "Forbidden" });
    }
  });

  app.register(monitoringPlugin);

  app.get("/api/health", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "initiare_erp-api",
      timestamp: new Date().toISOString()
    };
  });

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(dashboardRoutes, { prefix: "/api" });
  app.register(dataRoutes, { prefix: "/api" });
  app.register(monitoringRoutes, { prefix: "/api/monitoring" });

  return app;
}

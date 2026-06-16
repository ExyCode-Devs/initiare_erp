import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { Prisma } from "@prisma/client";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import monitoringPlugin from "./plugins/monitoring.js";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import aiEventRoutes from "./routes/ai-events.js";
import automationRoutes from "./routes/automation.js";
import advancedOpsRoutes from "./routes/advanced-ops.js";
import asaasRoutes from "./routes/asaas.js";
import changelogRoutes from "./routes/changelog.js";
import dashboardRoutes from "./routes/dashboard.js";
import dataRoutes from "./routes/data.js";
import financialDraftRoutes from "./routes/financial-drafts.js";
import inboxRoutes from "./routes/inbox.js";
import inboxWebhookRoutes from "./routes/inbox-webhooks.js";
import internalExtractionRoutes from "./routes/internal-extraction.js";
import legalEntityRoutes from "./routes/legal-entities.js";
import mailboxRoutes from "./routes/mailboxes.js";
import monitoringRoutes from "./routes/monitoring.js";
import omieRoutes from "./routes/omie.js";

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
  app.decorateRequest("rawBody", undefined);

  app.addContentTypeParser(/^application\/([\w.+-]+\+)?json$/, { parseAs: "string" }, (request, body, done) => {
    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    request.rawBody = rawBody;

    try {
      done(null, rawBody.trim().length ? JSON.parse(rawBody) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

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

    if (error instanceof ZodError) {
      reply.code(400).send({
        message: "Invalid request payload",
        issues: error.issues
      });
      return;
    }

    reply.code(500).send({ message: "Internal server error" });
  });

  app.register(cors, {
    origin: [env.APP_ORIGIN],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
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
      return;
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
  app.register(aiEventRoutes, { prefix: "/api" });
  app.register(inboxWebhookRoutes, { prefix: "/api" });
  app.register(internalExtractionRoutes, { prefix: "/api" });
  app.register(dashboardRoutes, { prefix: "/api" });
  app.register(dataRoutes, { prefix: "/api" });
  app.register(legalEntityRoutes, { prefix: "/api" });
  app.register(mailboxRoutes, { prefix: "/api" });
  app.register(inboxRoutes, { prefix: "/api" });
  app.register(financialDraftRoutes, { prefix: "/api" });
  app.register(omieRoutes, { prefix: "/api" });
  app.register(asaasRoutes, { prefix: "/api" });
  app.register(automationRoutes, { prefix: "/api" });
  app.register(advancedOpsRoutes, { prefix: "/api" });
  app.register(changelogRoutes, { prefix: "/api" });
  app.register(monitoringRoutes, { prefix: "/api/monitoring" });

  return app;
}

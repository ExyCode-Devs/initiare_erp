import "@fastify/jwt";
import "fastify";
import type { Registry } from "prom-client";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: "ADMIN" | "ANALYST" | "VIEWER";
      activeCompanyId: string;
      companyId: string;
      email: string;
      name: string;
      tokenType?: "user" | "portal";
      clientId?: string;
      businessClientId?: string;
      portalAccessId?: string;
    };
    user: {
      sub: string;
      role: "ADMIN" | "ANALYST" | "VIEWER";
      activeCompanyId: string;
      companyId: string;
      email: string;
      name: string;
      tokenType?: "user" | "portal";
      clientId?: string;
      businessClientId?: string;
      portalAccessId?: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    startTime?: number;
    rawBody?: string;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      roles?: Array<"ADMIN" | "ANALYST" | "VIEWER">
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    metricsRegistry: Registry;
  }
}

import "@fastify/jwt";
import "fastify";
import type { Registry } from "prom-client";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: "ADMIN" | "ANALYST" | "VIEWER";
      companyId: string;
      email: string;
      name: string;
    };
    user: {
      sub: string;
      role: "ADMIN" | "ANALYST" | "VIEWER";
      companyId: string;
      email: string;
      name: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    startTime?: number;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      roles?: Array<"ADMIN" | "ANALYST" | "VIEWER">
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    metricsRegistry: Registry;
  }
}

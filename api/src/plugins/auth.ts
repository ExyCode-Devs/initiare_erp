import type { FastifyPluginAsync } from "fastify";

const authPlugin: FastifyPluginAsync = async (app) => {
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
};

export default authPlugin;

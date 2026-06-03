import type { FastifyPluginAsync } from "fastify";

const goneMessage = "Legacy inbox ingestion disabled. Review AI drafts from Active Actions events instead.";

const inboxRoutes: FastifyPluginAsync = async (app) => {
  app.all("/inbox/emails", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });

  app.all("/inbox/emails/:id", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });

  app.all("/attachments/:id/download", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });
};

export default inboxRoutes;

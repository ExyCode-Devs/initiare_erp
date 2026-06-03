import type { FastifyPluginAsync } from "fastify";

const goneMessage = "Legacy mailbox ingestion disabled. Active Actions owns external event delivery now.";

const mailboxRoutes: FastifyPluginAsync = async (app) => {
  app.all("/mailboxes", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });

  app.all("/mailboxes/:id", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });

  app.all("/mailboxes/:id/test", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });

  app.all("/mailboxes/:id/sync", async (_request, reply) => {
    reply.code(410);
    return { message: goneMessage };
  });
};

export default mailboxRoutes;

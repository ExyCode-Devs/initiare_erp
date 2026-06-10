import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { encryptMailboxSecret } from "../lib/mailbox-crypto.js";
import { testMailboxConnection, processMailboxAccount } from "../lib/inbox-processing.js";
import { prisma } from "../lib/prisma.js";

const mailboxPayloadSchema = z.object({
  name: z.string().trim().min(2),
  host: z.string().trim().min(3),
  port: z.coerce.number().int().positive(),
  tls: z.boolean().default(true),
  username: z.string().trim().min(3),
  password: z.string().min(8),
  fromFilter: z.string().trim().nullable().optional(),
  active: z.boolean().default(true)
});

function mapMailbox(mailbox: {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  username: string;
  fromFilter: string | null;
  active: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}) {
  return {
    id: mailbox.id,
    name: mailbox.name,
    host: mailbox.host,
    port: mailbox.port,
    tls: mailbox.tls,
    username: mailbox.username,
    fromFilter: mailbox.fromFilter,
    active: mailbox.active,
    lastSyncAt: mailbox.lastSyncAt?.toISOString() ?? null,
    lastError: mailbox.lastError,
    createdAt: mailbox.createdAt.toISOString()
  };
}

const mailboxRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/mailboxes", async (request) => {
    const items = await prisma.mailboxAccount.findMany({
      where: {
        companyId: request.user.companyId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      items: items.map(mapMailbox)
    };
  });

  app.post(
    "/mailboxes",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const payload = mailboxPayloadSchema.parse(request.body);

      const mailbox = await prisma.mailboxAccount.create({
        data: {
          companyId: request.user.companyId,
          name: payload.name,
          host: payload.host,
          port: payload.port,
          tls: payload.tls,
          username: payload.username,
          passwordCipher: encryptMailboxSecret(payload.password),
          fromFilter: payload.fromFilter?.trim() || null,
          active: payload.active
        }
      });

      return mapMailbox(mailbox);
    }
  );

  app.post(
    "/mailboxes/:id/test",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await testMailboxConnection(params.id, request.user.companyId);

      return {
        ok: true,
        mailboxId: params.id
      };
    }
  );

  app.post(
    "/mailboxes/:id/sync",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const result = await processMailboxAccount(params.id, request.user.companyId);

      return {
        ok: true,
        mailboxId: params.id,
        ...result
      };
    }
  );
};

export default mailboxRoutes;

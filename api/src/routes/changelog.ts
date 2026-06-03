import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";

const changelogCategorySchema = z.enum([
  "NOVA_FUNCIONALIDADE",
  "MELHORIA",
  "CORRECAO",
  "INTEGRACAO",
  "IA",
  "DASHBOARD",
]);

const changelogStatusSchema = z.enum(["RASCUNHO", "PUBLICADO"]);

const changelogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/changelog", async (request) => {
    const items = await prisma.changelogEntry.findMany({
      where: {
        companyId: request.user.companyId,
        status: "PUBLICADO",
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        reads: {
          where: {
            userId: request.user.sub,
          },
          take: 1,
        },
      },
      orderBy: [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        version: item.version,
        category: item.category,
        status: item.status,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        author: item.author,
        unread: item.reads.length === 0 || item.reads[0]?.readAt == null,
      })),
    };
  });

  app.post("/changelog/:id/mark-seen", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const entry = await prisma.changelogEntry.findFirstOrThrow({
      where: {
        id: params.id,
        companyId: request.user.companyId,
        status: "PUBLICADO",
      },
    });

    const read = await prisma.changelogRead.upsert({
      where: {
        entryId_userId: {
          entryId: entry.id,
          userId: request.user.sub,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        companyId: request.user.companyId,
        entryId: entry.id,
        userId: request.user.sub,
        readAt: new Date(),
      },
    });

    return {
      id: read.id,
      readAt: read.readAt?.toISOString() ?? null,
    };
  });

  app.register(async (adminApp) => {
    adminApp.addHook("preHandler", adminApp.authorize(["ADMIN"]));

    adminApp.get("/admin/changelog", async (request) => {
      const items = await prisma.changelogEntry.findMany({
        where: {
          companyId: request.user.companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return { items };
    });

    adminApp.post("/admin/changelog", async (request) => {
      const payload = z
        .object({
          title: z.string().min(2),
          description: z.string().min(2),
          version: z.string().min(1),
          category: changelogCategorySchema,
          status: changelogStatusSchema.default("RASCUNHO"),
          imageUrl: z.string().url().optional().nullable(),
        })
        .parse(request.body);

      const item = await prisma.changelogEntry.create({
        data: {
          companyId: request.user.companyId,
          authorId: request.user.sub,
          title: payload.title,
          description: payload.description,
          version: payload.version,
          category: payload.category,
          status: payload.status,
          imageUrl: payload.imageUrl ?? null,
          publishedAt: payload.status === "PUBLICADO" ? new Date() : null,
        },
      });

      await writeAuditLog({
        companyId: request.user.companyId,
        userId: request.user.sub,
        action: "changelog.created",
        resource: "changelog-entry",
        details: {
          entryId: item.id,
          status: item.status,
        },
      });

      return item;
    });

    adminApp.patch("/admin/changelog/:id", async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z
        .object({
          title: z.string().min(2).optional(),
          description: z.string().min(2).optional(),
          version: z.string().min(1).optional(),
          category: changelogCategorySchema.optional(),
          status: changelogStatusSchema.optional(),
          imageUrl: z.string().url().nullable().optional(),
        })
        .parse(request.body);

      const existing = await prisma.changelogEntry.findFirstOrThrow({
        where: {
          id: params.id,
          companyId: request.user.companyId,
        },
      });

      const item = await prisma.changelogEntry.update({
        where: {
          id: existing.id,
        },
        data: {
          title: payload.title,
          description: payload.description,
          version: payload.version,
          category: payload.category,
          status: payload.status,
          imageUrl: payload.imageUrl,
          publishedAt: payload.status === "PUBLICADO" ? new Date() : undefined,
        },
      });

      await writeAuditLog({
        companyId: request.user.companyId,
        userId: request.user.sub,
        action: "changelog.updated",
        resource: "changelog-entry",
        details: {
          entryId: item.id,
          status: item.status,
        },
      });

      return item;
    });

    adminApp.post("/admin/changelog/:id/publish", async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const existing = await prisma.changelogEntry.findFirstOrThrow({
        where: {
          id: params.id,
          companyId: request.user.companyId,
        },
      });

      const item = await prisma.changelogEntry.update({
        where: {
          id: existing.id,
        },
        data: {
          status: "PUBLICADO",
          publishedAt: new Date(),
        },
      });

      await writeAuditLog({
        companyId: request.user.companyId,
        userId: request.user.sub,
        action: "changelog.published",
        resource: "changelog-entry",
        details: {
          entryId: item.id,
        },
      });

      return item;
    });
  });
};

export default changelogRoutes;

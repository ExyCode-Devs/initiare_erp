import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listLegalEntities } from "../lib/legal-entities.js";
import { prisma } from "../lib/prisma.js";
import { toNullablePrismaJson } from "../lib/prisma-json.js";

const payloadSchema = z.object({
  legalName: z.string().min(2),
  tradeName: z.string().trim().nullable().optional(),
  cnpj: z.string().min(3),
  active: z.boolean().default(true),
  defaultRecipientEmails: z.array(z.string().email()).optional().default([]),
  defaultMailboxIds: z.array(z.string().min(1)).optional().default([]),
  notes: z.string().trim().nullable().optional()
});

function formatEntity(entity: {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  active: boolean;
  isDefault: boolean;
  defaultRecipientEmails: unknown;
  defaultMailboxIds: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entity.id,
    legalName: entity.legalName,
    tradeName: entity.tradeName,
    cnpj: entity.cnpj,
    active: entity.active,
    isDefault: entity.isDefault,
    defaultRecipientEmails: Array.isArray(entity.defaultRecipientEmails) ? entity.defaultRecipientEmails : [],
    defaultMailboxIds: Array.isArray(entity.defaultMailboxIds) ? entity.defaultMailboxIds : [],
    notes: entity.notes,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString()
  };
}

const legalEntityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/settings/legal-entities", async (request) => {
    const entities = await listLegalEntities(request.user.companyId);
    return {
      items: entities.map(formatEntity)
    };
  });

  app.post(
    "/settings/legal-entities",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const payload = payloadSchema.parse(request.body);
      const entity = await prisma.legalEntity.create({
        data: {
          companyId: request.user.companyId,
          legalName: payload.legalName.trim(),
          tradeName: payload.tradeName?.trim() || null,
          cnpj: payload.cnpj,
          active: payload.active,
          defaultRecipientEmails: toNullablePrismaJson(payload.defaultRecipientEmails),
          defaultMailboxIds: toNullablePrismaJson(payload.defaultMailboxIds),
          notes: payload.notes?.trim() || null
        }
      });

      return formatEntity(entity);
    }
  );

  app.patch(
    "/settings/legal-entities/:id",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = payloadSchema.partial().parse(request.body ?? {});
      await prisma.legalEntity.findFirstOrThrow({
        where: {
          id: params.id,
          companyId: request.user.companyId
        }
      });

      const entity = await prisma.legalEntity.update({
        where: { id: params.id },
        data: {
          legalName: payload.legalName?.trim(),
          tradeName: payload.tradeName === undefined ? undefined : payload.tradeName?.trim() || null,
          cnpj: payload.cnpj,
          active: payload.active,
          defaultRecipientEmails:
            payload.defaultRecipientEmails === undefined
              ? undefined
              : toNullablePrismaJson(payload.defaultRecipientEmails),
          defaultMailboxIds:
            payload.defaultMailboxIds === undefined ? undefined : toNullablePrismaJson(payload.defaultMailboxIds),
          notes: payload.notes === undefined ? undefined : payload.notes?.trim() || null
        }
      });

      return formatEntity(entity);
    }
  );

  app.delete(
    "/settings/legal-entities/:id",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const entity = await prisma.legalEntity.findFirstOrThrow({
        where: {
          id: params.id,
          companyId: request.user.companyId
        }
      });

      if (entity.isDefault) {
        throw new Error("Default legal entity cannot be deleted");
      }

      await prisma.legalEntity.delete({
        where: { id: entity.id }
      });

      return { ok: true };
    }
  );
};

export default legalEntityRoutes;

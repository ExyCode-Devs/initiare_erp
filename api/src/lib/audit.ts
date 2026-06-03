import { toPrismaJson } from "./prisma-json.js";
import { prisma } from "./prisma.js";

type AuditInput = {
  action: string;
  resource: string;
  companyId: string;
  userId?: string | null;
  details: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      resource: input.resource,
      companyId: input.companyId,
      userId: input.userId ?? null,
      details: toPrismaJson(input.details)
    }
  });
}

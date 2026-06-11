import { ErpOperationStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson } from "./prisma-json.js";

export async function recordOmieRequestLog(input: {
  companyId: string;
  connectionId: string;
  method: string;
  endpoint: string;
  requestBody?: unknown;
  responseBody?: unknown;
  httpStatus?: number | null;
  operationStatus: ErpOperationStatus;
  friendlyError?: string | null;
  technicalError?: string | null;
  draftId?: string | null;
  triggeredByUserId?: string | null;
}) {
  return prisma.erpRequestLog.create({
    data: {
      companyId: input.companyId,
      connectionId: input.connectionId,
      method: input.method,
      endpoint: input.endpoint,
      requestBody: toNullablePrismaJson(input.requestBody ?? null),
      responseBody: toNullablePrismaJson(input.responseBody ?? null),
      httpStatus: input.httpStatus ?? null,
      operationStatus: input.operationStatus,
      friendlyError: input.friendlyError ?? null,
      technicalError: input.technicalError ?? null,
      draftId: input.draftId ?? null,
      triggeredByUserId: input.triggeredByUserId ?? null
    }
  });
}

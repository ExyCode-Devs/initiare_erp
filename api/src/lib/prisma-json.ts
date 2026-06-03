import { Prisma } from "@prisma/client";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

export function toNullablePrismaJson(value: unknown) {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return toPrismaJson(value);
}

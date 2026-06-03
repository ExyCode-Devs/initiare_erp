import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

function baseRoot() {
  return path.resolve(env.INGESTION_STORAGE_ROOT);
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

export function resolveStoredFilePath(relativePath: string) {
  return path.resolve(baseRoot(), relativePath);
}

export async function persistStoredFile(relativeDir: string, fileName: string, content: Buffer) {
  const normalizedDir = relativeDir
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) => safeSegment(segment))
    .join("/");
  const safeName = safeSegment(fileName);
  const relativePath = `${normalizedDir}/${safeName}`;
  const absolutePath = resolveStoredFilePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);

  return {
    absolutePath,
    relativePath
  };
}

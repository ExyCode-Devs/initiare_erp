import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function verifyActiveSignature(input: { rawBody: string; signature: string; timestamp: string }) {
  const expected = createHmac("sha256", env.ACTIVE_ACTIONS_HMAC_SECRET)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");

  const left = Buffer.from(input.signature, "hex");
  const right = Buffer.from(expected, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function isFreshActiveTimestamp(timestamp: string) {
  const receivedAt = Number(new Date(timestamp));
  if (Number.isNaN(receivedAt)) {
    return false;
  }

  return Math.abs(Date.now() - receivedAt) <= env.ACTIVE_ACTIONS_MAX_SKEW_MS;
}

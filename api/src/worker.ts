import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { processActiveMailboxes } from "./lib/inbox-processing.js";

let isRunning = false;
let timer: NodeJS.Timeout | null = null;

async function runCycle() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  try {
    await processActiveMailboxes();
  } catch (error) {
    console.error("[worker] cycle failed", error);
  } finally {
    isRunning = false;
  }
}

async function start() {
  console.log(`[worker] starting mailbox poller every ${env.WORKER_POLL_INTERVAL_MS}ms`);
  await runCycle();
  timer = setInterval(() => {
    void runCycle();
  }, env.WORKER_POLL_INTERVAL_MS);
}

async function shutdown() {
  if (timer) {
    clearInterval(timer);
  }

  await prisma.$disconnect();
}

void start();

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

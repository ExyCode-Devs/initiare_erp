import { PrismaClient } from "@prisma/client";
import { provisionDemoData } from "./demo-seed.js";
import { provisionLocalBaseline, resetLocalData } from "./local-baseline.js";

const prisma = new PrismaClient();

async function main() {
  const shouldReset = process.env.SEED_RESET === "true";
  const existingCompanies = await prisma.company.count();

  if (existingCompanies > 0 && !shouldReset) {
    console.log("Seed skipped: existing data found.");
    return;
  }

  if (shouldReset) {
    await resetLocalData(prisma);
  }

  await provisionLocalBaseline(prisma);
  await provisionDemoData(prisma);
  console.log("Seed complete for local baseline.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

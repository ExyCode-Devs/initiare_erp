import { PrismaClient } from "@prisma/client";
import { provisionLocalBaseline } from "./local-baseline.js";

const prisma = new PrismaClient();

async function main() {
  const existingCompanies = await prisma.company.count();
  if (existingCompanies > 0) {
    console.log("Bootstrap skipped: existing company data found.");
    return;
  }

  await provisionLocalBaseline(prisma);
  console.log("Bootstrap complete for local baseline.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

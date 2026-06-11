import { PrismaClient } from "@prisma/client";
import { provisionLocalBaseline } from "./local-baseline.js";
import { reconcileCompanyClientDocuments } from "../src/lib/client-identity.js";

const prisma = new PrismaClient();

async function main() {
  const existingCompanies = await prisma.company.count();
  if (existingCompanies > 0) {
    const companies = await prisma.company.findMany({
      select: { id: true }
    });
    for (const company of companies) {
      await reconcileCompanyClientDocuments(prisma, company.id);
    }
    console.log("Bootstrap skipped: existing company data found. Client identity reconciliation complete.");
    return;
  }

  await provisionLocalBaseline(prisma);
  const companies = await prisma.company.findMany({
    select: { id: true }
  });
  for (const company of companies) {
    await reconcileCompanyClientDocuments(prisma, company.id);
  }
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

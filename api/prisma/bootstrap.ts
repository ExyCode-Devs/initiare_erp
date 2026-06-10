import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

function toSlug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "initiare-erp"
  );
}

async function main() {
  const existingCompanies = await prisma.company.count();
  if (existingCompanies > 0) {
    console.log("Bootstrap skipped: existing company data found.");
    return;
  }

  const company = await prisma.company.create({
    data: {
      name: env.SEED_COMPANY_NAME,
      slug: toSlug(env.SEED_COMPANY_NAME),
      domain: env.SEED_COMPANY_DOMAIN,
      operationalSavings: new Prisma.Decimal(0)
    }
  });

  await prisma.user.create({
    data: {
      name: "Initiare Admin",
      email: env.SEED_ADMIN_EMAIL,
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      role: "ADMIN",
      memberships: {
        create: {
          companyId: company.id,
          role: "ADMIN",
          isDefault: true
        }
      }
    }
  });

  console.log(`Bootstrap complete for ${company.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

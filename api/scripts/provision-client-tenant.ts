import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";
import { saveAsaasConnection } from "../src/lib/asaas-connections.js";
import { saveOmieConnection } from "../src/lib/omie-connections.js";

const prisma = new PrismaClient();

type LegalEntityInput = {
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  active?: boolean;
  isDefault?: boolean;
  notes?: string | null;
};

type BusinessClientInput = {
  name: string;
  externalCode?: string | null;
  legalEntityCnpjs?: string[];
};

type OmieConnectionInput = {
  cnpj: string;
  environment: "HOMOLOG" | "PRODUCTION";
  appKey: string;
  appSecret: string;
  baseUrl?: string | null;
  enabled?: boolean;
};

type AsaasConnectionInput = {
  cnpj: string;
  environment: "SANDBOX" | "PRODUCTION";
  apiKey: string;
  webhookAuthToken?: string | null;
  baseUrl?: string | null;
  enabled?: boolean;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }

  return value;
}

function parseJsonEnv<T>(name: string, fallback: T): T {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function toSlug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "tenant"
  );
}

async function main() {
  const companyName = required("TENANT_COMPANY_NAME");
  const companyDomain = required("TENANT_COMPANY_DOMAIN");
  const adminEmail = required("TENANT_ADMIN_EMAIL").toLowerCase();
  const adminPassword = required("TENANT_ADMIN_PASSWORD");
  const adminName = process.env.TENANT_ADMIN_NAME?.trim() || "Admin";
  const slug = process.env.TENANT_COMPANY_SLUG?.trim() || toSlug(companyName);
  const legalEntities = parseJsonEnv<LegalEntityInput[]>("TENANT_LEGAL_ENTITIES_JSON", []);
  const businessClients = parseJsonEnv<BusinessClientInput[]>("TENANT_BUSINESS_CLIENTS_JSON", []);
  const omieConnections = parseJsonEnv<OmieConnectionInput[]>("TENANT_OMIE_CONNECTIONS_JSON", []);
  const asaasConnections = parseJsonEnv<AsaasConnectionInput[]>("TENANT_ASAAS_CONNECTIONS_JSON", []);

  const company = await prisma.company.upsert({
    where: { slug },
    update: {
      name: companyName,
      domain: companyDomain
    },
    create: {
      name: companyName,
      slug,
      domain: companyDomain,
      operationalSavings: new Prisma.Decimal(0)
    }
  });

  const adminPasswordHash = await hashPassword(adminPassword);
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin && existingAdmin.companyId !== company.id) {
    throw new Error(`User ${adminEmail} already belongs to another company`);
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      companyId: company.id
    },
    create: {
      name: adminName,
      email: adminEmail,
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      companyId: company.id
    }
  });

  const legalEntityMap = new Map<string, Awaited<ReturnType<typeof prisma.legalEntity.upsert>>>();
  for (const item of legalEntities) {
    const entity = await prisma.legalEntity.upsert({
      where: {
        companyId_cnpj: {
          companyId: company.id,
          cnpj: item.cnpj
        }
      },
      update: {
        legalName: item.legalName,
        tradeName: item.tradeName?.trim() || null,
        active: item.active ?? true,
        notes: item.notes?.trim() || null
      },
      create: {
        companyId: company.id,
        legalName: item.legalName,
        tradeName: item.tradeName?.trim() || null,
        cnpj: item.cnpj,
        active: item.active ?? true,
        isDefault: item.isDefault ?? false,
        notes: item.notes?.trim() || null
      }
    });

    legalEntityMap.set(item.cnpj, entity);
  }

  const defaultEntity = legalEntities.find((item) => item.isDefault) ?? legalEntities[0];
  if (defaultEntity) {
    await prisma.legalEntity.updateMany({
      where: { companyId: company.id },
      data: { isDefault: false }
    });

    await prisma.legalEntity.update({
      where: { id: legalEntityMap.get(defaultEntity.cnpj)!.id },
      data: { isDefault: true }
    });
  }

  for (const item of businessClients) {
    const businessClient = await prisma.businessClient.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: item.name
        }
      },
      update: {
        externalCode: item.externalCode?.trim() || null,
        active: true
      },
      create: {
        companyId: company.id,
        name: item.name,
        externalCode: item.externalCode?.trim() || null,
        active: true
      }
    });

    if (item.legalEntityCnpjs?.length) {
      await prisma.businessClientLegalEntity.deleteMany({
        where: {
          companyId: company.id,
          businessClientId: businessClient.id
        }
      });

      await prisma.businessClientLegalEntity.createMany({
        data: item.legalEntityCnpjs.map((cnpj, index) => {
          const entity = legalEntityMap.get(cnpj);
          if (!entity) {
            throw new Error(`Business client ${item.name} references unknown legal entity CNPJ ${cnpj}`);
          }

          return {
            companyId: company.id,
            businessClientId: businessClient.id,
            legalEntityId: entity.id,
            priority: index
          };
        })
      });
    }
  }

  for (const item of omieConnections) {
    const entity = legalEntityMap.get(item.cnpj);
    if (!entity) {
      throw new Error(`OMIE connection references unknown legal entity CNPJ ${item.cnpj}`);
    }

    await saveOmieConnection({
      companyId: company.id,
      legalEntityId: entity.id,
      environment: item.environment,
      appKey: item.appKey,
      appSecret: item.appSecret,
      baseUrl: item.baseUrl ?? null,
      enabled: item.enabled ?? true
    });
  }

  for (const item of asaasConnections) {
    const entity = legalEntityMap.get(item.cnpj);
    if (!entity) {
      throw new Error(`ASAAS connection references unknown legal entity CNPJ ${item.cnpj}`);
    }

    await saveAsaasConnection({
      companyId: company.id,
      legalEntityId: entity.id,
      environment: item.environment,
      apiKey: item.apiKey,
      webhookAuthToken: item.webhookAuthToken ?? null,
      baseUrl: item.baseUrl ?? null,
      enabled: item.enabled ?? true
    });
  }

  console.log(
    JSON.stringify(
      {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          domain: company.domain
        },
        admin: {
          id: admin.id,
          email: admin.email
        },
        legalEntities: [...legalEntityMap.values()].map((item) => ({
          id: item.id,
          legalName: item.legalName,
          tradeName: item.tradeName,
          cnpj: item.cnpj
        })),
        omieConnections: omieConnections.length,
        asaasConnections: asaasConnections.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

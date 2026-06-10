import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/auth.js";

type LocalLegalEntity = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  isDefault?: boolean;
};

type LocalCompany = {
  name: string;
  slug: string;
  domain: string;
  legalEntities: LocalLegalEntity[];
};

const LOCAL_COMPANIES: LocalCompany[] = [
  {
    name: "Initiare ERP",
    slug: "initiare-erp",
    domain: "localhost:8080",
    legalEntities: [
      {
        legalName: "Initiare ERP",
        tradeName: "Initiare ERP",
        cnpj: "PENDING-CNPJ-INITIARE",
        isDefault: true
      }
    ]
  },
  {
    name: "Acerta Pre Vestibulares",
    slug: "acerta-pre-vestibulares",
    domain: "acerta.local",
    legalEntities: [
      {
        legalName: "Acerta Pre Vestibulares",
        tradeName: "Acerta",
        cnpj: "PENDING-CNPJ-ACERTA",
        isDefault: true
      },
      {
        legalName: "Empresa PVA",
        tradeName: "PVA",
        cnpj: "PENDING-CNPJ-PVA"
      },
      {
        legalName: "Empresa CDA",
        tradeName: "CDA",
        cnpj: "PENDING-CNPJ-CDA"
      }
    ]
  },
  {
    name: "Botuverá Locações",
    slug: "botuvera-locacoes",
    domain: "botuvera.local",
    legalEntities: [
      {
        legalName: "Botuverá Locações",
        tradeName: "Botuverá",
        cnpj: "PENDING-CNPJ-BOTUVERA",
        isDefault: true
      }
    ]
  },
  {
    name: "Guarani Divinópolis",
    slug: "guarani-divinopolis",
    domain: "guarani.local",
    legalEntities: [
      {
        legalName: "Guarani Divinópolis",
        tradeName: "Guarani",
        cnpj: "PENDING-CNPJ-GUARANI",
        isDefault: true
      }
    ]
  }
];

export async function resetLocalData(prisma: PrismaClient) {
  await prisma.erpWebhookEvent.deleteMany();
  await prisma.erpRequestLog.deleteMany();
  await prisma.erpSyncRecord.deleteMany();
  await prisma.erpConnection.deleteMany();
  await prisma.portalAccess.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.businessClientLegalEntity.deleteMany();
  await prisma.businessClient.deleteMany();
  await prisma.changelogRead.deleteMany();
  await prisma.changelogEntry.deleteMany();
  await prisma.financialDraftReview.deleteMany();
  await prisma.financialDraft.deleteMany();
  await prisma.aiGatewayRun.deleteMany();
  await prisma.aiEventSource.deleteMany();
  await prisma.n8nExtractionRun.deleteMany();
  await prisma.emailAttachment.deleteMany();
  await prisma.inboundEmail.deleteMany();
  await prisma.processingJobRun.deleteMany();
  await prisma.mailboxAccount.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.dreEntry.deleteMany();
  await prisma.performancePoint.deleteMany();
  await prisma.dailyReconciliationPoint.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.cashflowPoint.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.report.deleteMany();
  await prisma.flow.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.aiLog.deleteMany();
  await prisma.exceptionItem.deleteMany();
  await prisma.reconciliationItem.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.accountReceivable.deleteMany();
  await prisma.accountPayable.deleteMany();
  await prisma.client.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

export async function provisionLocalBaseline(prisma: PrismaClient) {
  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: {
      name: "Delson",
      role: UserRole.ADMIN,
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD)
    },
    create: {
      name: "Delson",
      email: env.SEED_ADMIN_EMAIL,
      role: UserRole.ADMIN,
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD)
    }
  });

  for (const item of LOCAL_COMPANIES) {
    const company = await prisma.company.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        domain: item.domain,
        companiesCount: 1,
        aiCycleLabel: "aguardando-primeira-execucao",
        aiUptime: 0,
        latencyMs: 0,
        integrationsHealthy: 0,
        integrationsTotal: 0,
        timeSavedHours: 0,
        monthlyOperations: 0,
        operationalSavings: new Prisma.Decimal(0)
      },
      create: {
        name: item.name,
        slug: item.slug,
        domain: item.domain,
        companiesCount: 1,
        aiCycleLabel: "aguardando-primeira-execucao",
        aiUptime: 0,
        latencyMs: 0,
        integrationsHealthy: 0,
        integrationsTotal: 0,
        timeSavedHours: 0,
        monthlyOperations: 0,
        operationalSavings: new Prisma.Decimal(0)
      }
    });

    await prisma.userCompanyMembership.upsert({
      where: {
        userId_companyId: {
          userId: admin.id,
          companyId: company.id
        }
      },
      update: {
        role: UserRole.ADMIN,
        isDefault: item.slug === "initiare-erp"
      },
      create: {
        userId: admin.id,
        companyId: company.id,
        role: UserRole.ADMIN,
        isDefault: item.slug === "initiare-erp"
      }
    });

    for (const legalEntity of item.legalEntities) {
      await prisma.legalEntity.upsert({
        where: {
          companyId_cnpj: {
            companyId: company.id,
            cnpj: legalEntity.cnpj
          }
        },
        update: {
          legalName: legalEntity.legalName,
          tradeName: legalEntity.tradeName,
          active: true,
          isDefault: legalEntity.isDefault ?? false
        },
        create: {
          companyId: company.id,
          legalName: legalEntity.legalName,
          tradeName: legalEntity.tradeName,
          cnpj: legalEntity.cnpj,
          active: true,
          isDefault: legalEntity.isDefault ?? false
        }
      });
    }

    await prisma.legalEntity.updateMany({
      where: {
        companyId: company.id,
        cnpj: {
          notIn: item.legalEntities.map((legalEntity) => legalEntity.cnpj)
        }
      },
      data: {
        active: false,
        isDefault: false
      }
    });
  }

  await prisma.userCompanyMembership.deleteMany({
    where: {
      user: {
        email: {
          not: env.SEED_ADMIN_EMAIL
        }
      }
    }
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        not: env.SEED_ADMIN_EMAIL
      }
    }
  });
}

import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/auth.js";
import { encryptAsaasSecret } from "../src/lib/asaas-crypto.js";
import { encryptMailboxSecret } from "../src/lib/mailbox-crypto.js";
import { encryptOmieSecret } from "../src/lib/omie-crypto.js";
import { persistStoredFile } from "../src/lib/storage.js";

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

function buildSimplePdf(lines: string[]) {
  const safeLines = lines.map((line) =>
    line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
  );
  const stream = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...safeLines.flatMap((line, index) =>
      index === 0 ? [`(${line}) Tj`] : ["0 -18 Td", `(${line}) Tj`],
    ),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

async function storeSeedFile(relativeDir: string, fileName: string, content: Buffer) {
  const { relativePath } = await persistStoredFile(relativeDir, fileName, content);
  return relativePath;
}

async function main() {
  const shouldReset = process.env.SEED_RESET === "true";
  const existingCompanies = await prisma.company.count();

  if (existingCompanies > 0 && !shouldReset) {
    console.log("Seed skipped: existing data found.");
    return;
  }

  if (shouldReset) {
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

  const company = await prisma.company.create({
    data: {
      name: env.SEED_COMPANY_NAME,
      slug: toSlug(env.SEED_COMPANY_NAME),
      domain: env.SEED_COMPANY_DOMAIN,
      companiesCount: 3,
      operationalSavings: 42800,
    },
  });

  const defaultLegalEntity = await prisma.legalEntity.create({
    data: {
      companyId: company.id,
      legalName: env.SEED_COMPANY_NAME,
      tradeName: env.SEED_COMPANY_NAME,
      cnpj: "12345678000195",
      isDefault: true,
      notes: "Seed default legal entity",
      defaultRecipientEmails: ["financeiro@initiare.com.br"],
      defaultMailboxIds: ["mailbox-financeiro-principal"]
    }
  });

  const consultingLegalEntity = await prisma.legalEntity.create({
    data: {
      companyId: company.id,
      legalName: "Initiare Consultoria LTDA",
      tradeName: "Initiare Consultoria",
      cnpj: "98765432000110",
      notes: "Seed second legal entity for multi-CNPJ allocation",
      defaultRecipientEmails: ["consultoria@initiare.com.br"],
      defaultMailboxIds: ["mailbox-consultoria"]
    }
  });

  const adminPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const analystPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const viewerPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const emailDomain = env.SEED_COMPANY_DOMAIN.replace(/^https?:\/\//, "").replace(/:\d+$/, "");

  const user = await prisma.user.create({
    data: {
      name: "Rafael Almeida",
      email: env.SEED_ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      memberships: {
        create: {
          companyId: company.id,
          role: "ADMIN",
          isDefault: true
        }
      }
    },
  });

  const analyst = await prisma.user.create({
    data: {
      name: "Carla Nogueira",
      email: `analyst@${emailDomain}`,
      passwordHash: analystPasswordHash,
      role: "ANALYST",
      memberships: {
        create: {
          companyId: company.id,
          role: "ANALYST"
        }
      }
    },
  });

  const viewer = await prisma.user.create({
    data: {
      name: "Marcos Dias",
      email: `viewer@${emailDomain}`,
      passwordHash: viewerPasswordHash,
      role: "VIEWER",
      memberships: {
        create: {
          companyId: company.id,
          role: "VIEWER"
        }
      }
    },
  });

  const clients = await Promise.all(
    [
      {
        name: "Acme Industries",
        segment: "Industria",
        annualRevenue: 184000,
        status: "Ativo",
        sinceYear: 2023,
      },
      {
        name: "Globex Corp",
        segment: "Tecnologia",
        annualRevenue: 122400,
        status: "Ativo",
        sinceYear: 2024,
      },
      {
        name: "Initech BR",
        segment: "Software",
        annualRevenue: 98000,
        status: "Ativo",
        sinceYear: 2022,
      },
      {
        name: "Soylent Co",
        segment: "FoodTech",
        annualRevenue: 54000,
        status: "Ativo",
        sinceYear: 2025,
      },
      {
        name: "Massive Dynamic",
        segment: "Engenharia",
        annualRevenue: 412000,
        status: "Ativo",
        sinceYear: 2021,
      },
      {
        name: "Hooli",
        segment: "Tecnologia",
        annualRevenue: 28000,
        status: "Pausado",
        sinceYear: 2024,
      },
    ].map((item) =>
      prisma.client.create({
        data: {
          companyId: company.id,
          name: item.name,
          segment: item.segment,
          annualRevenue: item.annualRevenue,
          status: item.status,
          sinceYear: item.sinceYear,
        },
      }),
    ),
  );

  const suppliers = await Promise.all(
    [
      {
        name: "Amazon Web Services",
        cnpj: "15.436.940/0001-03",
        category: "Infraestrutura",
        yearlySpend: 184200,
        lastTransaction: "ontem",
      },
      {
        name: "Google Workspace",
        cnpj: "06.990.590/0001-23",
        category: "Software",
        yearlySpend: 11800,
        lastTransaction: "ha 3 dias",
      },
      {
        name: "Stripe Payments",
        cnpj: null,
        category: "Financeiro",
        yearlySpend: 42100,
        lastTransaction: "hoje",
      },
      {
        name: "Energisa",
        cnpj: "08.324.196/0001-81",
        category: "Utilidades",
        yearlySpend: 50500,
        lastTransaction: "ha 2 dias",
      },
      {
        name: "RD Station",
        cnpj: "12.345.678/0001-90",
        category: "Marketing",
        yearlySpend: 34680,
        lastTransaction: "ha 1 semana",
      },
      {
        name: "Notion Labs",
        cnpj: null,
        category: "Software",
        yearlySpend: 1240,
        lastTransaction: "hoje",
      },
      {
        name: "Cloudflare Inc",
        cnpj: null,
        category: "Infraestrutura",
        yearlySpend: 1450,
        lastTransaction: "ha 2 dias",
      },
      {
        name: "Mendes & Cia LTDA",
        cnpj: "12.345.678/0001-90",
        category: "Operacao",
        yearlySpend: 8900,
        lastTransaction: "ha 4 min",
      },
    ].map((item) =>
      prisma.supplier.create({
        data: {
          companyId: company.id,
          name: item.name,
          cnpj: item.cnpj,
          category: item.category,
          yearlySpend: item.yearlySpend,
          lastTransaction: item.lastTransaction,
        },
      }),
    ),
  );

  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier]));
  const clientByName = new Map(clients.map((client) => [client.name, client]));

  const businessClients = await Promise.all([
    prisma.businessClient.create({
      data: {
        companyId: company.id,
        clientId: clientByName.get("Acme Industries")?.id,
        name: "Acme Holdings",
        externalCode: "BC-ACME"
      }
    }),
    prisma.businessClient.create({
      data: {
        companyId: company.id,
        clientId: clientByName.get("Globex Corp")?.id,
        name: "Globex Shared Services",
        externalCode: "BC-GLOBEX"
      }
    })
  ]);

  const businessClientByName = new Map(businessClients.map((item) => [item.name, item]));

  await prisma.businessClientLegalEntity.createMany({
    data: [
      {
        companyId: company.id,
        businessClientId: businessClientByName.get("Acme Holdings")!.id,
        legalEntityId: defaultLegalEntity.id,
        priority: 0,
        percentage: 70,
        monthlyCap: 25000
      },
      {
        companyId: company.id,
        businessClientId: businessClientByName.get("Acme Holdings")!.id,
        legalEntityId: consultingLegalEntity.id,
        priority: 1,
        percentage: 30,
        monthlyCap: 12000
      },
      {
        companyId: company.id,
        businessClientId: businessClientByName.get("Globex Shared Services")!.id,
        legalEntityId: consultingLegalEntity.id,
        priority: 0,
        percentage: 100,
        monthlyCap: 20000
      }
    ]
  });

  await prisma.allocationRule.createMany({
    data: [
      {
        companyId: company.id,
        businessClientId: businessClientByName.get("Acme Holdings")!.id,
        strategy: "PERCENTAGE",
        percentageMap: [
          { legalEntityId: defaultLegalEntity.id, percentage: 70 },
          { legalEntityId: consultingLegalEntity.id, percentage: 30 }
        ],
        monthlyCapMap: [
          { legalEntityId: defaultLegalEntity.id, cap: 25000, used: 0 },
          { legalEntityId: consultingLegalEntity.id, cap: 12000, used: 0 }
        ]
      },
      {
        companyId: company.id,
        businessClientId: businessClientByName.get("Globex Shared Services")!.id,
        strategy: "MANUAL",
        legalEntityId: consultingLegalEntity.id
      }
    ]
  });

  await prisma.portalAccess.create({
    data: {
      companyId: company.id,
      businessClientId: businessClientByName.get("Acme Holdings")!.id,
      label: "Seed portal access",
      tokenHash: "seed-portal-access-acme",
      expiresAt: new Date("2026-12-31T23:59:59Z")
    }
  });

  await prisma.accountPayable.createMany({
    data: [
      [
        "Amazon Web Services",
        18420.5,
        "2026-05-28",
        "Infraestrutura",
        "PROCESSADO",
        0.99,
        "DDA",
        "IA",
      ],
      ["Notion Labs", 1240, "2026-05-30", "Software", "EM_REVISAO", 0.82, "Email", "IA"],
      ["Mendes & Cia LTDA", 8900, "2026-06-02", "A classificar", "EXCECAO", 0.41, "DDA", "Rafael"],
      ["Google Workspace", 980, "2026-05-29", "Software", "PROCESSADO", 0.97, "Email", "IA"],
      ["Energisa", 4210.45, "2026-05-27", "Utilidades", "PENDENTE", 0.93, "DDA", "IA"],
      ["RD Station", 2890, "2026-06-01", "Marketing", "PROCESSADO", 0.95, "Email", "IA"],
      ["Cloudflare Inc", 1450, "2026-05-31", "Infraestrutura", "CONCILIADO", 0.98, "API", "IA"],
      ["Linear Software", 320, "2026-06-03", "Software", "PROCESSADO", 0.99, "Email", "IA"],
    ].map(([supplierName, amount, dueDate, category, status, confidence, source, assignee]) => ({
      companyId: company.id,
      supplierId: supplierByName.get(String(supplierName))?.id,
      amount: Number(amount),
      dueDate: new Date(String(dueDate)),
      category: String(category),
      status: status as never,
      confidence: Number(confidence),
      source: String(source),
      assignee: String(assignee),
    })),
  });

  await prisma.accountReceivable.createMany({
    data: [
      ["Stripe Payments", 32100, "2026-05-26", "CONCILIADO", "API", "PIX"],
      ["Acme Industries", 18400, "2026-05-28", "PENDENTE", "Fatura", "Boleto"],
      ["Globex Corp", 24200, "2026-05-30", "EM_REVISAO", "Fatura", "TED"],
      ["Initech BR", 9800, "2026-06-02", "PENDENTE", "Recorrencia", "PIX"],
      ["Massive Dynamic", 41200, "2026-06-04", "PENDENTE", "Fatura", "Boleto"],
      ["Soylent Co", 5400, "2026-06-05", "CONCILIADO", "API", "PIX"],
    ].map(([clientName, amount, dueDate, status, source, channel]) => ({
      companyId: company.id,
      clientId: clientByName.get(String(clientName))?.id,
      amount: Number(amount),
      dueDate: new Date(String(dueDate)),
      status: status as never,
      source: String(source),
      channel: String(channel),
    })),
  });

  await prisma.operation.createMany({
    data: [
      [
        "OP-29481",
        "Amazon Web Services",
        18420.5,
        "2026-05-28",
        "Infraestrutura",
        "PROCESSADO",
        "DDA",
        0.99,
        "IA",
        "OUT",
      ],
      [
        "OP-29480",
        "Notion Labs",
        1240,
        "2026-05-30",
        "Software",
        "EM_REVISAO",
        "Email",
        0.82,
        "IA",
        "OUT",
      ],
      [
        "OP-29479",
        "Mendes & Cia LTDA",
        8900,
        "2026-06-02",
        "A classificar",
        "EXCECAO",
        "DDA",
        0.41,
        "Rafael",
        "OUT",
      ],
      [
        "OP-29478",
        "Stripe Payments",
        32100,
        "2026-05-26",
        "Receita",
        "CONCILIADO",
        "API",
        0.99,
        "IA",
        "IN",
      ],
      [
        "OP-29477",
        "Google Workspace",
        980,
        "2026-05-29",
        "Software",
        "PROCESSADO",
        "Email",
        0.97,
        "IA",
        "OUT",
      ],
      [
        "OP-29476",
        "Energisa",
        4210.45,
        "2026-05-27",
        "Utilidades",
        "PENDENTE",
        "DDA",
        0.93,
        "IA",
        "OUT",
      ],
      [
        "OP-29475",
        "RD Station",
        2890,
        "2026-06-01",
        "Marketing",
        "PROCESSADO",
        "Email",
        0.95,
        "IA",
        "OUT",
      ],
      [
        "OP-29474",
        "Cloudflare Inc",
        1450,
        "2026-05-31",
        "Infraestrutura",
        "CONCILIADO",
        "API",
        0.98,
        "IA",
        "OUT",
      ],
      [
        "OP-29473",
        "Mendes & Cia LTDA",
        612.8,
        "2026-05-25",
        "A classificar",
        "EXCECAO",
        "Manual",
        0.38,
        "Carla",
        "OUT",
      ],
      [
        "OP-29472",
        "Google Workspace",
        320,
        "2026-06-03",
        "Software",
        "PROCESSADO",
        "Email",
        0.99,
        "IA",
        "OUT",
      ],
    ].map(
      ([
        reference,
        supplierName,
        amount,
        dueDate,
        category,
        status,
        source,
        confidence,
        assignee,
        direction,
      ]) => ({
        companyId: company.id,
        supplierId: supplierByName.get(String(supplierName))?.id,
        reference: String(reference),
        amount: Number(amount),
        dueDate: new Date(String(dueDate)),
        category: String(category),
        status: status as never,
        source: String(source),
        confidence: Number(confidence),
        assignee: String(assignee),
        direction: String(direction),
      }),
    ),
  });

  await prisma.reconciliationItem.createMany({
    data: [
      [
        "CC-001",
        "2026-05-24",
        "PIX RECEB STRIPE BR",
        32100,
        "2026-05-24",
        "Stripe Payments · jan/26",
        32100,
        1,
      ],
      [
        "CC-002",
        "2026-05-24",
        "DEB AWS BILLING",
        -18420.5,
        "2026-05-24",
        "AWS · Infra mensal",
        -18420.5,
        0.99,
      ],
      ["CC-003", "2026-05-23", "TED ENVIADA MENDES", -8900, null, "Sem correspondencia", 0, 0],
      [
        "CC-004",
        "2026-05-23",
        "PIX RECEB CLIENTE 042",
        4500,
        "2026-05-23",
        "Fatura 042 · Cliente Acme",
        4500,
        1,
      ],
      [
        "CC-005",
        "2026-05-22",
        "DEB CLOUDFLARE",
        -1450,
        "2026-05-22",
        "Cloudflare · Infra",
        -1452.5,
        0.92,
      ],
    ].map(
      ([
        code,
        bankDate,
        bankDescription,
        bankValue,
        bookDate,
        bookDescription,
        bookValue,
        matchScore,
      ]) => ({
        companyId: company.id,
        code: String(code),
        bankDate: new Date(String(bankDate)),
        bankDescription: String(bankDescription),
        bankValue: Number(bankValue),
        bookDate: bookDate ? new Date(String(bookDate)) : null,
        bookDescription: String(bookDescription),
        bookValue: Number(bookValue),
        matchScore: Number(matchScore),
      }),
    ),
  });

  await prisma.exceptionItem.createMany({
    data: [
      [
        "EX-1042",
        "Fornecedor nao encontrado",
        "DDA Itau · boleto R$ 8.900,00 · Mendes & Cia LTDA",
        "Criar fornecedor Mendes & Cia LTDA (CNPJ 12.345.678/0001-90)",
        0.68,
        "ALTA",
        "ha 4 min",
        [
          { t: "14:25:03", text: "Entrada DDA Itau recebida" },
          { t: "14:25:04", text: "IA tentou match com cadastro de fornecedores" },
          { t: "14:25:04", text: "Match nao encontrado · escalado como excecao" },
          { t: "14:25:05", text: "Sugestao gerada · aguardando humano" },
        ],
      ],
      [
        "EX-1041",
        "Valor divergente do historico",
        "AWS · cobranca 38% acima da media mensal",
        "Validar com responsavel de infraestrutura antes de aprovar",
        0.74,
        "MEDIA",
        "ha 12 min",
        [
          { t: "14:12:11", text: "Cobranca AWS recebida" },
          { t: "14:12:12", text: "IA encontrou desvio do historico" },
        ],
      ],
      [
        "EX-1040",
        "Categoria ambigua",
        "Lancamento Notion pode ser Software ou Marketing",
        "Classificar como Software · 82% de confianca",
        0.82,
        "BAIXA",
        "ha 22 min",
        [
          { t: "13:58:41", text: "Email de cobranca recebido" },
          { t: "13:58:42", text: "Duas categorias ficaram proximas" },
        ],
      ],
    ].map(([code, title, description, suggestion, confidence, severity, timeLabel, timeline]) => ({
      companyId: company.id,
      code: String(code),
      title: String(title),
      description: String(description),
      suggestion: String(suggestion),
      confidence: Number(confidence),
      severity: severity as never,
      timeLabel: String(timeLabel),
      timeline,
    })),
  });

  await prisma.aiLog.createMany({
    data: [
      [
        "2026-05-24T14:32:18Z",
        "PIX RECEB R$ 12.400,00 REF NF8821",
        "Pagamento PIX R$ 12.400 conciliado com NF 8821",
        0.99,
        "OK",
        { entity: "payment" },
        "Match exato identificado com historico bancario",
      ],
      [
        "2026-05-24T14:31:55Z",
        "INVOICE aws-billing@amazon.com $3.421,12",
        "Fornecedor AWS classificado em Infraestrutura",
        0.99,
        "OK",
        { entity: "supplier" },
        "Padrao recorrente acima do threshold",
      ],
      [
        "2026-05-24T14:29:42Z",
        "BOLETO Notion Labs R$ 1.240,00",
        "Solicitar revisao humana",
        0.82,
        "WARN",
        { entity: "supplier" },
        "Categoria ficou abaixo do threshold automatico",
      ],
      [
        "2026-05-24T14:27:11Z",
        "DDA Itau 14 titulos",
        "Programar pagamentos",
        0.97,
        "OK",
        { entity: "dda" },
        "Lote validado com score alto",
      ],
      [
        "2026-05-24T14:25:03Z",
        "BOLETO Mendes & Cia R$ 8.900",
        "Abrir excecao · fornecedor inexistente",
        0.41,
        "ERR",
        { entity: "supplier" },
        "Nao foi encontrado fornecedor compatível",
      ],
      [
        "2026-05-24T14:22:48Z",
        "Omie sync · 12 lancamentos",
        "Importar e auto-classificar",
        0.94,
        "OK",
        { entity: "erp_sync" },
        "Registros importados com sucesso",
      ],
      [
        "2026-05-24T14:20:31Z",
        "Analise fluxo de caixa D+30",
        "Sugerir antecipacao",
        0.88,
        "OK",
        { entity: "cashflow" },
        "Previsao de caixa com ganho em juros",
      ],
      [
        "2026-05-24T14:18:14Z",
        "NF 8819 vs NF 8820",
        "Abrir excecao · duplicidade",
        0.91,
        "WARN",
        { entity: "invoice" },
        "Padrao duplicado identificado",
      ],
    ].map(([occurredAt, input, action, confidence, status, parsedPayload, justification]) => ({
      companyId: company.id,
      occurredAt: new Date(String(occurredAt)),
      input: String(input),
      action: String(action),
      confidence: Number(confidence),
      status: status as never,
      parsedPayload,
      justification: String(justification),
    })),
  });

  await prisma.automation.createMany({
    data: [
      [
        "Conciliacao automatica",
        "Match entre extrato bancario e lancamentos",
        1842,
        99.1,
        "ACTIVE",
      ],
      ["Leitura de e-mails", "Captura de invoices, boletos e NFs", 624, 96.4, "ACTIVE"],
      ["Processamento DDA", "Importacao automatica de boletos bancarios", 318, 98.7, "ACTIVE"],
      ["Classificacao financeira", "Categorizacao por centro de custo e DRE", 2104, 94.8, "ACTIVE"],
      ["Deteccao de anomalias", "Alertas sobre desvios de padrao historico", 76, 91.2, "ACTIVE"],
      ["Cobranca inteligente", "Regua de cobranca adaptativa por cliente", 412, 88.5, "PAUSED"],
    ].map(([title, description, runs, accuracy, status]) => ({
      companyId: company.id,
      title: String(title),
      description: String(description),
      runs: Number(runs),
      accuracy: Number(accuracy),
      status: status as never,
    })),
  });

  await prisma.flow.createMany({
    data: [
      [
        "Captura -> Classificacao -> Pagamento",
        "Email/DDA -> IA Classifier -> Aprovacao -> Pagamento programado",
        1842,
        "ACTIVE",
        ["Email", "IA", "Aprovar", "Pagar"],
      ],
      [
        "Recebimento -> Conciliacao -> Lancamento",
        "PIX/TED -> Match IA -> Lancamento contabil -> Notificacao cliente",
        1218,
        "ACTIVE",
        ["Banco", "Match", "Lancar", "Notificar"],
      ],
      [
        "Cobranca inteligente",
        "Vencimento -> Regua adaptativa -> Cobranca automatizada",
        412,
        "ACTIVE",
        ["Trigger", "IA Regua", "Enviar"],
      ],
      [
        "Reconciliacao de NFs",
        "NF emitida -> Match com lancamento -> SPED ready",
        624,
        "PAUSED",
        ["NF", "Match", "Validar"],
      ],
    ].map(([name, description, runs, status, steps]) => ({
      companyId: company.id,
      name: String(name),
      description: String(description),
      runs: Number(runs),
      status: status as never,
      steps,
    })),
  });

  await prisma.report.createMany({
    data: [
      ["DRE Mensal", "Demonstrativo de Resultado consolidado", "atualizado hoje"],
      ["Fluxo de Caixa Projetado", "Previsao de 12 meses com IA", "atualizado ha 1h"],
      ["Despesas por Categoria", "Distribuicao mensal e tendencias", "atualizado hoje"],
      ["Conciliacao Bancaria", "Status e divergencias do periodo", "atualizado ha 2h"],
      ["Contas a Pagar/Receber", "Aging completo da carteira", "atualizado hoje"],
      ["Performance IA", "Metricas operacionais dos modelos", "atualizado ha 5min"],
    ].map(([name, description, updatedLabel]) => ({
      companyId: company.id,
      name: String(name),
      description: String(description),
      updatedLabel: String(updatedLabel),
    })),
  });

  await prisma.integration.createMany({
    data: [
      ["Itau Open Finance", "DDA · extratos · TED/PIX", "CONNECTED"],
      ["Bradesco", "Extratos · DDA", "CONNECTED"],
      ["Stripe", "Pagamentos online", "CONNECTED"],
      ["Omie", "ERP financeiro", "CONNECTED"],
      ["Gmail / IMAP", "Captura de invoices", "CONNECTED"],
      ["OpenAI", "Modelo de linguagem", "CONNECTED"],
      ["N8N", "Orquestracao de fluxos e extracao estruturada", "CONNECTED"],
      ["Slack", "Notificacoes em tempo real", "AVAILABLE"],
    ].map(([name, description, status]) => ({
      companyId: company.id,
      name: String(name),
      description: String(description),
      status: status as never,
    })),
  });

  await prisma.erpConnection.createMany({
    data: [
      {
        companyId: company.id,
        legalEntityId: defaultLegalEntity.id,
        provider: "OMIE",
        environment: "HOMOLOG",
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: true,
        appKeyCipher: encryptOmieSecret("omie-homolog-app-key"),
        appSecretCipher: encryptOmieSecret("omie-homolog-app-secret"),
        lastHealthcheckStatus: "UNKNOWN"
      },
      {
        companyId: company.id,
        legalEntityId: defaultLegalEntity.id,
        provider: "OMIE",
        environment: "PRODUCTION",
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: false,
        appKeyCipher: encryptOmieSecret("omie-prod-app-key"),
        appSecretCipher: encryptOmieSecret("omie-prod-app-secret"),
        lastHealthcheckStatus: "UNKNOWN"
      },
      {
        companyId: company.id,
        legalEntityId: defaultLegalEntity.id,
        provider: "ASAAS",
        environment: "SANDBOX",
        baseUrl: "https://api-sandbox.asaas.com/v3",
        enabled: true,
        appKeyCipher: encryptAsaasSecret("$aact_hmlg_example"),
        webhookAuthTokenCipher: encryptAsaasSecret("whsec_sandbox_example_12345678901234567890"),
        lastHealthcheckStatus: "UNKNOWN"
      },
      {
        companyId: company.id,
        legalEntityId: defaultLegalEntity.id,
        provider: "ASAAS",
        environment: "PRODUCTION",
        baseUrl: "https://api.asaas.com/v3",
        enabled: false,
        appKeyCipher: encryptAsaasSecret("$aact_prod_example"),
        webhookAuthTokenCipher: encryptAsaasSecret("whsec_prod_example_1234567890123456789012"),
        lastHealthcheckStatus: "UNKNOWN"
      }
    ]
  });

  await prisma.cashflowPoint.createMany({
    data: [
      ["Jan", 420, 310],
      ["Fev", 480, 340],
      ["Mar", 520, 360],
      ["Abr", 610, 410],
      ["Mai", 580, 430],
      ["Jun", 720, 480],
      ["Jul", 690, 470],
      ["Ago", 810, 520],
      ["Set", 880, 540],
      ["Out", 920, 580],
      ["Nov", 980, 610],
      ["Dez", 1120, 670],
    ].map(([month, entrada, saida], index) => ({
      companyId: company.id,
      monthKey: index + 1,
      month: String(month),
      entrada: Number(entrada),
      saida: Number(saida),
    })),
  });

  await prisma.expenseCategory.createMany({
    data: [
      ["Folha", 38],
      ["Infra", 22],
      ["Marketing", 14],
      ["Software", 12],
      ["Operacao", 9],
      ["Outros", 5],
    ].map(([name, value]) => ({
      companyId: company.id,
      name: String(name),
      value: Number(value),
    })),
  });

  await prisma.dailyReconciliationPoint.createMany({
    data: Array.from({ length: 14 }, (_, index) => ({
      companyId: company.id,
      day: index + 1,
      auto: 70 + ((index * 7) % 18),
      manual: 8 + (index % 5),
    })),
  });

  await prisma.performancePoint.createMany({
    data: Array.from({ length: 30 }, (_, index) => ({
      companyId: company.id,
      day: index + 1,
      accuracy: 92 + (index % 6) * 0.8,
      ops: 80 + ((index * 11) % 37),
    })),
  });

  await prisma.dreEntry.createMany({
    data: [
      ["Receita bruta", 1240000, "in", false, false],
      ["Deducoes", -84000, "out", false, false],
      ["Receita liquida", 1156000, "in", true, false],
      ["Custo de servicos", -342000, "out", false, false],
      ["Lucro bruto", 814000, "in", true, false],
      ["Despesas operacionais", -421000, "out", false, false],
      ["EBITDA", 393000, "in", true, false],
      ["Impostos", -82000, "out", false, false],
      ["Lucro liquido", 311000, "in", true, true],
    ].map(([label, value, type, bold, highlight]) => ({
      companyId: company.id,
      label: String(label),
      value: Number(value),
      type: String(type),
      bold: Boolean(bold),
      highlight: Boolean(highlight),
    })),
  });

  await prisma.insight.createMany({
    data: [
      [
        "ai",
        "Antecipacao inteligente",
        "Receba R$ 184k antes - economia projetada de R$ 4.120 em juros.",
      ],
      [
        "warning",
        "Concentracao de despesas",
        "62% dos gastos em 4 fornecedores - risco de dependencia.",
      ],
      ["success", "Eficiencia operacional", "Custo por transacao caiu 23% nos ultimos 90 dias."],
    ].map(([tone, title, description]) => ({
      companyId: company.id,
      tone: String(tone),
      title: String(title),
      description: String(description),
    })),
  });

  const mailboxes = await Promise.all([
    prisma.mailboxAccount.create({
      data: {
        companyId: company.id,
        name: "Financeiro principal",
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        username: "financeiro@exycode.com.br",
        passwordCipher: encryptMailboxSecret("seed-imap-password"),
        fromFilter: "@amazon.com",
        active: true,
        lastSyncAt: new Date("2026-06-02T12:10:00Z"),
      },
    }),
    prisma.mailboxAccount.create({
      data: {
        companyId: company.id,
        name: "Cobranca clientes",
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        username: "cobranca@exycode.com.br",
        passwordCipher: encryptMailboxSecret("seed-imap-password"),
        active: false,
        lastError: "Mailbox paused for homologation",
      },
    }),
  ]);

  const awsPdfPath = await storeSeedFile(
    `${company.slug}/financeiro-principal/2026-06-02`,
    "aws-fatura-maio-2026.pdf",
    buildSimplePdf([
      "AWS Billing Statement",
      "Fornecedor: Amazon Web Services",
      "Valor: R$ 18.420,50",
      "Vencimento: 2026-05-28",
    ]),
  );
  const notionPdfPath = await storeSeedFile(
    `${company.slug}/financeiro-principal/2026-06-02`,
    "notion-fatura-junho-2026.pdf",
    buildSimplePdf([
      "Notion Labs Invoice",
      "Valor: R$ 1.240,00",
      "Vencimento: 2026-05-30",
      "Categoria sugerida: Software",
    ]),
  );
  const receivableTxtPath = await storeSeedFile(
    `${company.slug}/cobranca-clientes/2026-06-02`,
    "acme-cobranca-042.txt",
    Buffer.from("Cliente Acme Industries\nValor: R$ 18.400,00\nVencimento: 2026-05-28\n", "utf8"),
  );
  const erroPdfPath = await storeSeedFile(
    `${company.slug}/financeiro-principal/2026-06-02`,
    "mendes-cobranca.pdf",
    buildSimplePdf([
      "Mendes & Cia",
      "Documento sem dados suficientes",
      "Extracao pendente de revisao",
    ]),
  );

  const inboundAws = await prisma.inboundEmail.create({
    data: {
      companyId: company.id,
      mailboxId: mailboxes[0].id,
      externalMessageId: "<aws-maio-2026@amazon.com>",
      dedupeHash: "seed-aws-maio-2026",
      sender: "aws-billing@amazon.com",
      toRecipients: ["financeiro@exycode.com.br"],
      subject: "AWS invoice for May 2026",
      bodyText: "Segue invoice AWS referente ao consumo de maio.",
      bodyHtml: "<p>Segue invoice AWS referente ao consumo de maio.</p>",
      rawHeaders: { from: "aws-billing@amazon.com", messageId: "<aws-maio-2026@amazon.com>" },
      originalEmlPath: await storeSeedFile(
        `${company.slug}/financeiro-principal/2026-06-02`,
        "aws-maio-2026.eml",
        Buffer.from(
          "From: aws-billing@amazon.com\nSubject: AWS invoice for May 2026\n\nSegue invoice AWS referente ao consumo de maio.",
          "utf8",
        ),
      ),
      receivedAt: new Date("2026-06-02T11:42:00Z"),
      status: "APROVADO",
    },
  });

  const inboundNotion = await prisma.inboundEmail.create({
    data: {
      companyId: company.id,
      mailboxId: mailboxes[0].id,
      externalMessageId: "<notion-junho-2026@notion.so>",
      dedupeHash: "seed-notion-junho-2026",
      sender: "billing@mail.notion.so",
      toRecipients: ["financeiro@exycode.com.br"],
      subject: "Invoice Notion Labs June/2026",
      bodyText: "Invoice mensal. Categoria possivel: software ou produtividade.",
      bodyHtml: "<p>Invoice mensal. Categoria possivel: software ou produtividade.</p>",
      rawHeaders: { from: "billing@mail.notion.so", messageId: "<notion-junho-2026@notion.so>" },
      originalEmlPath: await storeSeedFile(
        `${company.slug}/financeiro-principal/2026-06-02`,
        "notion-junho-2026.eml",
        Buffer.from(
          "From: billing@mail.notion.so\nSubject: Invoice Notion Labs June/2026\n\nInvoice mensal.",
          "utf8",
        ),
      ),
      receivedAt: new Date("2026-06-02T12:04:00Z"),
      status: "AGUARDANDO_VALIDACAO",
    },
  });

  const inboundAcme = await prisma.inboundEmail.create({
    data: {
      companyId: company.id,
      mailboxId: mailboxes[1].id,
      externalMessageId: "<acme-042@acme.com>",
      dedupeHash: "seed-acme-042",
      sender: "finance@acmeindustries.com",
      toRecipients: ["cobranca@exycode.com.br"],
      subject: "Fatura 042 em aberto",
      bodyText: "Confirmamos recebimento da cobranca. Valor confere parcialmente.",
      rawHeaders: { from: "finance@acmeindustries.com", messageId: "<acme-042@acme.com>" },
      originalEmlPath: await storeSeedFile(
        `${company.slug}/cobranca-clientes/2026-06-02`,
        "acme-042.eml",
        Buffer.from(
          "From: finance@acmeindustries.com\nSubject: Fatura 042 em aberto\n\nConfirmamos recebimento da cobranca.",
          "utf8",
        ),
      ),
      receivedAt: new Date("2026-06-02T10:38:00Z"),
      status: "REJEITADO",
    },
  });

  const inboundError = await prisma.inboundEmail.create({
    data: {
      companyId: company.id,
      mailboxId: mailboxes[0].id,
      externalMessageId: "<mendes-erro@fornecedor.com>",
      dedupeHash: "seed-mendes-erro",
      sender: "cobranca@mendes.com.br",
      toRecipients: ["financeiro@exycode.com.br"],
      subject: "Documento ilegivel",
      bodyText: "Arquivo com dados incompletos para processamento.",
      rawHeaders: { from: "cobranca@mendes.com.br", messageId: "<mendes-erro@fornecedor.com>" },
      originalEmlPath: await storeSeedFile(
        `${company.slug}/financeiro-principal/2026-06-02`,
        "mendes-erro.eml",
        Buffer.from(
          "From: cobranca@mendes.com.br\nSubject: Documento ilegivel\n\nArquivo com dados incompletos.",
          "utf8",
        ),
      ),
      receivedAt: new Date("2026-06-02T12:18:00Z"),
      status: "ERRO",
      processingError: "n8n returned invalid JSON",
    },
  });

  const attachmentAws = await prisma.emailAttachment.create({
    data: {
      companyId: company.id,
      emailId: inboundAws.id,
      originalName: "aws-fatura-maio-2026.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storagePath: awsPdfPath,
      checksum: "seed-checksum-aws",
      extractedText: "Amazon Web Services. Valor R$ 18.420,50. Vencimento 2026-05-28.",
      extractionMeta: {
        parser: "pdf-text",
        pages: 1,
      },
      status: "EXTRAIDO",
    },
  });

  const attachmentNotion = await prisma.emailAttachment.create({
    data: {
      companyId: company.id,
      emailId: inboundNotion.id,
      originalName: "notion-fatura-junho-2026.pdf",
      mimeType: "application/pdf",
      sizeBytes: 980,
      storagePath: notionPdfPath,
      checksum: "seed-checksum-notion",
      extractedText: "Notion Labs. Valor R$ 1.240,00. Vencimento 2026-05-30.",
      extractionMeta: {
        parser: "pdf-text",
        pages: 1,
      },
      status: "EXTRAIDO",
    },
  });

  const attachmentAcme = await prisma.emailAttachment.create({
    data: {
      companyId: company.id,
      emailId: inboundAcme.id,
      originalName: "acme-cobranca-042.txt",
      mimeType: "text/plain",
      sizeBytes: 120,
      storagePath: receivableTxtPath,
      checksum: "seed-checksum-acme",
      extractedText: "Cliente Acme Industries. Valor R$ 18.400,00. Vencimento 2026-05-28.",
      extractionMeta: {
        parser: "plain-text",
      },
      status: "EXTRAIDO",
    },
  });

  await prisma.emailAttachment.create({
    data: {
      companyId: company.id,
      emailId: inboundError.id,
      originalName: "mendes-cobranca.pdf",
      mimeType: "application/pdf",
      sizeBytes: 770,
      storagePath: erroPdfPath,
      checksum: "seed-checksum-erro",
      extractedText: null,
      extractionMeta: {
        parser: "pdf-text",
      },
      status: "ERRO",
      processingError: "Parsed text insufficient for extraction",
    },
  });

  const extractionAws = await prisma.n8nExtractionRun.create({
    data: {
      companyId: company.id,
      emailId: inboundAws.id,
      provider: "n8n",
      workflowId: "wf-financial-extraction-v1",
      requestPayload: {
        company: { id: company.id, name: company.name, domain: company.domain },
        email: {
          id: inboundAws.id,
          sender: inboundAws.sender,
          recipients: ["financeiro@exycode.com.br"],
          subject: inboundAws.subject,
          bodyText: inboundAws.bodyText,
          receivedAt: inboundAws.receivedAt.toISOString(),
        },
        attachments: [
          {
            id: attachmentAws.id,
            filename: attachmentAws.originalName,
            mimeType: attachmentAws.mimeType,
            extractedText: attachmentAws.extractedText,
          },
        ],
        context: {
          knownSuppliers: Array.from(supplierByName.keys()),
          knownClients: Array.from(clientByName.keys()),
          knownCategories: ["Infraestrutura", "Software", "Marketing", "Utilidades"],
        },
      },
      rawResponse: JSON.stringify({
        type: "conta_pagar",
        partyName: "Amazon Web Services",
        amount: 18420.5,
        dueDate: "2026-05-28",
        description: "Fatura AWS maio/2026",
        suggestedCategory: "Infraestrutura",
        paymentMethod: "Boleto",
        evidence: ["Valor encontrado no PDF", "Fornecedor conhecido"],
        providerMeta: { workflowId: "wf-financial-extraction-v1" },
      }),
      parsedResponse: {
        type: "conta_pagar",
        partyName: "Amazon Web Services",
        amount: 18420.5,
        dueDate: "2026-05-28",
        description: "Fatura AWS maio/2026",
        suggestedCategory: "Infraestrutura",
        paymentMethod: "Boleto",
        evidence: ["Valor encontrado no PDF", "Fornecedor conhecido"],
        providerMeta: { workflowId: "wf-financial-extraction-v1" },
      },
      status: "SUCESSO",
      durationMs: 842,
      completedAt: new Date("2026-06-02T11:42:01Z"),
    },
  });

  const extractionNotion = await prisma.n8nExtractionRun.create({
    data: {
      companyId: company.id,
      emailId: inboundNotion.id,
      provider: "n8n",
      workflowId: "wf-financial-extraction-v1",
      requestPayload: {
        company: { id: company.id, name: company.name, domain: company.domain },
        email: {
          id: inboundNotion.id,
          sender: inboundNotion.sender,
          recipients: ["financeiro@exycode.com.br"],
          subject: inboundNotion.subject,
          bodyText: inboundNotion.bodyText,
          receivedAt: inboundNotion.receivedAt.toISOString(),
        },
        attachments: [
          {
            id: attachmentNotion.id,
            filename: attachmentNotion.originalName,
            mimeType: attachmentNotion.mimeType,
            extractedText: attachmentNotion.extractedText,
          },
        ],
        context: {
          knownSuppliers: Array.from(supplierByName.keys()),
          knownClients: Array.from(clientByName.keys()),
          knownCategories: ["Infraestrutura", "Software", "Marketing", "Utilidades"],
        },
      },
      rawResponse: JSON.stringify({
        type: "conta_pagar",
        partyName: "Notion Labs",
        amount: 1240,
        dueDate: "2026-05-30",
        description: "Assinatura Notion junho/2026",
        suggestedCategory: "Software",
        paymentMethod: "Cartao corporativo",
        notes: "Categoria ainda ambigua",
        evidence: ["Valor identificado no PDF", "Remetente conhecido"],
      }),
      parsedResponse: {
        type: "conta_pagar",
        partyName: "Notion Labs",
        amount: 1240,
        dueDate: "2026-05-30",
        description: "Assinatura Notion junho/2026",
        suggestedCategory: "Software",
        paymentMethod: "Cartao corporativo",
        notes: "Categoria ainda ambigua",
        evidence: ["Valor identificado no PDF", "Remetente conhecido"],
      },
      status: "SUCESSO",
      durationMs: 1150,
      completedAt: new Date("2026-06-02T12:04:01Z"),
    },
  });

  const extractionAcme = await prisma.n8nExtractionRun.create({
    data: {
      companyId: company.id,
      emailId: inboundAcme.id,
      provider: "n8n",
      workflowId: "wf-financial-extraction-v1",
      requestPayload: {
        company: { id: company.id, name: company.name, domain: company.domain },
        email: {
          id: inboundAcme.id,
          sender: inboundAcme.sender,
          recipients: ["cobranca@exycode.com.br"],
          subject: inboundAcme.subject,
          bodyText: inboundAcme.bodyText,
          receivedAt: inboundAcme.receivedAt.toISOString(),
        },
        attachments: [
          {
            id: attachmentAcme.id,
            filename: attachmentAcme.originalName,
            mimeType: attachmentAcme.mimeType,
            extractedText: attachmentAcme.extractedText,
          },
        ],
        context: {
          knownSuppliers: Array.from(supplierByName.keys()),
          knownClients: Array.from(clientByName.keys()),
          knownCategories: ["Receita", "Servicos", "Mensalidade"],
        },
      },
      rawResponse: JSON.stringify({
        type: "conta_receber",
        partyName: "Acme Industries",
        amount: 18400,
        dueDate: "2026-05-28",
        description: "Fatura 042 cliente Acme",
        suggestedCategory: "Receita recorrente",
        paymentMethod: "Boleto",
      }),
      parsedResponse: {
        type: "conta_receber",
        partyName: "Acme Industries",
        amount: 18400,
        dueDate: "2026-05-28",
        description: "Fatura 042 cliente Acme",
        suggestedCategory: "Receita recorrente",
        paymentMethod: "Boleto",
      },
      status: "SUCESSO",
      durationMs: 932,
      completedAt: new Date("2026-06-02T10:38:01Z"),
    },
  });

  await prisma.n8nExtractionRun.create({
    data: {
      companyId: company.id,
      emailId: inboundError.id,
      provider: "n8n",
      workflowId: "wf-financial-extraction-v1",
      requestPayload: {
        company: { id: company.id, name: company.name, domain: company.domain },
        email: {
          id: inboundError.id,
          sender: inboundError.sender,
          recipients: ["financeiro@exycode.com.br"],
          subject: inboundError.subject,
          bodyText: inboundError.bodyText,
          receivedAt: inboundError.receivedAt.toISOString(),
        },
        attachments: [],
        context: {
          knownSuppliers: Array.from(supplierByName.keys()),
          knownClients: Array.from(clientByName.keys()),
          knownCategories: ["Infraestrutura", "Software", "Marketing", "Utilidades"],
        },
      },
      rawResponse: '{"message":"invalid-json"',
      parsedResponse: Prisma.JsonNull,
      status: "ERRO",
      errorMessage: "n8n returned invalid JSON",
      durationMs: 30000,
      completedAt: new Date("2026-06-02T12:18:30Z"),
    },
  });

  const approvedPayable = await prisma.accountPayable.findFirstOrThrow({
    where: {
      companyId: company.id,
      supplierId: supplierByName.get("Amazon Web Services")?.id,
    },
    orderBy: {
      dueDate: "asc",
    },
  });
  const approvedReceivable = await prisma.accountReceivable.findFirstOrThrow({
    where: {
      companyId: company.id,
      clientId: clientByName.get("Acme Industries")?.id,
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  const draftAws = await prisma.financialDraft.create({
    data: {
      companyId: company.id,
      sourceEmailId: inboundAws.id,
      extractionRunId: extractionAws.id,
      direction: "CONTA_PAGAR",
      partyName: "Amazon Web Services",
      cpfCnpj: "15.436.940/0001-03",
      amount: 18420.5,
      dueDate: new Date("2026-05-28"),
      competence: "2026-05",
      description: "Fatura AWS maio/2026",
      suggestedCategory: "Infraestrutura",
      finalCategory: "Infraestrutura",
      paymentMethod: "Boleto",
      bankData: { bank: "Itau", barcode: "34191.79001 01043.510047 91020.150008 5 90930001842050" },
      notes: "Aprovado automaticamente no seed",
      evidence: ["Fornecedor conhecido", "Documento e valor consistentes"],
      rawPayload: {
        type: "conta_pagar",
        partyName: "Amazon Web Services",
        amount: 18420.5,
        dueDate: "2026-05-28",
      },
      confidenceScore: 96,
      confidenceBand: "ALTA",
      status: "APROVADO",
      reviewedAt: new Date("2026-06-02T11:44:00Z"),
      resultingResourceType: "account-payable",
      resultingResourceId: approvedPayable.id,
    },
  });

  const draftNotion = await prisma.financialDraft.create({
    data: {
      companyId: company.id,
      sourceEmailId: inboundNotion.id,
      extractionRunId: extractionNotion.id,
      direction: "CONTA_PAGAR",
      partyName: "Notion Labs",
      amount: 1240,
      dueDate: new Date("2026-05-30"),
      competence: "2026-06",
      description: "Assinatura Notion junho/2026",
      suggestedCategory: "Software",
      finalCategory: null,
      paymentMethod: "Cartao corporativo",
      bankData: Prisma.JsonNull,
      notes: "Aguardando confirmacao de centro de custo",
      evidence: ["Email recorrente", "Valor dentro do historico"],
      rawPayload: {
        type: "conta_pagar",
        partyName: "Notion Labs",
        amount: 1240,
        dueDate: "2026-05-30",
      },
      confidenceScore: 62,
      confidenceBand: "BAIXA",
      status: "PENDENTE_REVISAO",
    },
  });

  const draftAcme = await prisma.financialDraft.create({
    data: {
      companyId: company.id,
      sourceEmailId: inboundAcme.id,
      extractionRunId: extractionAcme.id,
      direction: "CONTA_RECEBER",
      partyName: "Acme Industries",
      amount: 18400,
      dueDate: new Date("2026-05-28"),
      competence: "2026-05",
      description: "Fatura 042 cliente Acme",
      suggestedCategory: "Receita recorrente",
      paymentMethod: "Boleto",
      notes: "Cliente contestou parte do valor",
      evidence: ["Cliente identificado", "Valor parcial encontrado no anexo"],
      rawPayload: {
        type: "conta_receber",
        partyName: "Acme Industries",
        amount: 18400,
        dueDate: "2026-05-28",
      },
      confidenceScore: 58,
      confidenceBand: "MEDIA",
      status: "REJEITADO",
      rejectionReason: "Cliente contestou cobranca, exigir segunda validacao.",
      reviewedAt: new Date("2026-06-02T10:45:00Z"),
      resultingResourceType: "account-receivable",
      resultingResourceId: approvedReceivable.id,
    },
  });

  const activeActionsPayableSource = await prisma.aiEventSource.create({
    data: {
      companyId: company.id,
      eventId: "aa-payable-2026-06-03-001",
      originType: "ACTIVE_ACTIONS",
      channel: "gmail",
      sender: "billing@cloudplus.example",
      subject: "CloudPlus invoice June 2026",
      summary: "CloudPlus sent June infrastructure invoice with boleto due on 2026-06-12.",
      attachmentsMeta: [
        {
          filename: "cloudplus-junho-2026.pdf",
          mimeType: "application/pdf",
        },
      ],
      rawPayload: {
        eventId: "aa-payable-2026-06-03-001",
        source: {
          channel: "gmail",
          sender: "billing@cloudplus.example",
        },
      },
      receivedAt: new Date("2026-06-03T09:00:00Z"),
      status: "PROCESSED",
    },
  });

  const activeActionsPayableRun = await prisma.aiGatewayRun.create({
    data: {
      companyId: company.id,
      eventSourceId: activeActionsPayableSource.id,
      provider: "active-actions-gateway",
      requestPayload: {
        source: {
          channel: "gmail",
          sender: "billing@cloudplus.example",
        },
      },
      rawResponse: '{"normalized":true,"provider":"active-actions-gateway"}',
      parsedResponse: {
        direction: "CONTA_PAGAR",
        partyName: "CloudPlus Infra",
      },
      status: "SUCESSO",
      durationMs: 4200,
      completedAt: new Date("2026-06-03T09:00:04Z"),
    },
  });

  const draftActivePayable = await prisma.financialDraft.create({
    data: {
      companyId: company.id,
      sourceEventId: activeActionsPayableSource.id,
      aiRunId: activeActionsPayableRun.id,
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus Infra",
      cpfCnpj: "11.222.333/0001-44",
      amount: 5420.75,
      dueDate: new Date("2026-06-12"),
      competence: "2026-06",
      description: "Infraestrutura cloud junho/2026",
      suggestedCategory: "Infraestrutura",
      finalCategory: "Infraestrutura",
      paymentMethod: "Boleto",
      bankData: {
        bank: "Itau",
        barcode: "34191.79001 01043.510047 91020.150008 5 90930000542075",
      },
      notes: "Novo evento aguardando aprovacao.",
      evidence: ["Evento normalizado", "Fornecedor recorrente"],
      rawPayload: {
        provider: "active-actions-gateway",
        eventId: "aa-payable-2026-06-03-001",
      },
      confidenceScore: 88,
      confidenceBand: "ALTA",
      status: "PENDENTE_REVISAO",
      sourceLabel: "Active Actions",
    },
  });

  const activeActionsReceivableSource = await prisma.aiEventSource.create({
    data: {
      companyId: company.id,
      eventId: "aa-receivable-2026-06-03-001",
      originType: "ACTIVE_ACTIONS",
      channel: "webhook",
      sender: "receivables@acme.example",
      subject: "Acme cobrança junho",
      summary: "Receivable event for Acme renewal due on 2026-06-18.",
      attachmentsMeta: [
        {
          filename: "acme-renewal.json",
          mimeType: "application/json",
        },
      ],
      rawPayload: {
        eventId: "aa-receivable-2026-06-03-001",
        source: {
          channel: "webhook",
          sender: "receivables@acme.example",
        },
      },
      receivedAt: new Date("2026-06-03T09:10:00Z"),
      status: "PROCESSED",
    },
  });

  const activeActionsReceivableRun = await prisma.aiGatewayRun.create({
    data: {
      companyId: company.id,
      eventSourceId: activeActionsReceivableSource.id,
      provider: "active-actions-gateway",
      requestPayload: {
        source: {
          channel: "webhook",
          sender: "receivables@acme.example",
        },
      },
      rawResponse: '{"normalized":true,"provider":"active-actions-gateway"}',
      parsedResponse: {
        direction: "CONTA_RECEBER",
        partyName: "Globex Corp",
      },
      status: "SUCESSO",
      durationMs: 3100,
      completedAt: new Date("2026-06-03T09:10:03Z"),
    },
  });

  const draftActiveReceivable = await prisma.financialDraft.create({
    data: {
      companyId: company.id,
      sourceEventId: activeActionsReceivableSource.id,
      aiRunId: activeActionsReceivableRun.id,
      direction: "CONTA_RECEBER",
      partyName: "Globex Corp",
      amount: 16200,
      dueDate: new Date("2026-06-18"),
      competence: "2026-06",
      description: "Renovacao mensal Globex junho/2026",
      suggestedCategory: "Receita recorrente",
      finalCategory: "Receita recorrente",
      paymentMethod: "PIX",
      notes: "Usar este draft para fluxo de rejeicao no E2E.",
      evidence: ["Cliente recorrente", "Valor dentro do esperado"],
      rawPayload: {
        provider: "active-actions-gateway",
        eventId: "aa-receivable-2026-06-03-001",
      },
      confidenceScore: 61,
      confidenceBand: "MEDIA",
      status: "PENDENTE_REVISAO",
      sourceLabel: "Active Actions",
    },
  });

  const internalFailureSource = await prisma.aiEventSource.create({
    data: {
      companyId: company.id,
      eventId: "internal-failure-2026-06-03-001",
      originType: "INTERNAL",
      channel: "manual-review",
      sender: "system",
      subject: "Internal AI retry failed",
      summary: "System-triggered AI enrichment failed before draft creation.",
      attachmentsMeta: Prisma.JsonNull,
      rawPayload: {
        action: "manual-review",
        entityId: draftActivePayable.id,
      },
      receivedAt: new Date("2026-06-03T09:15:00Z"),
      status: "FAILED",
      processingError: "AI provider timeout after 30s",
    },
  });

  await prisma.aiGatewayRun.create({
    data: {
      companyId: company.id,
      eventSourceId: internalFailureSource.id,
      provider: "internal-ai",
      requestPayload: {
        action: "manual-review",
        draftId: draftActivePayable.id,
      },
      status: "ERRO",
      errorMessage: "AI provider timeout after 30s",
      completedAt: new Date("2026-06-03T09:15:30Z"),
    },
  });

  await prisma.exceptionItem.create({
    data: {
      companyId: company.id,
      code: "AI-FAIL-001",
      title: "AI failure on manual review for Draft CloudPlus Infra",
      description: "AI provider timeout after 30s",
      suggestion: "Retry AI generation or complete draft review manually.",
      confidence: 0,
      severity: "ALTA",
      status: "OPEN",
      timeLabel: "agora",
      timeline: [
        {
          t: "09:15",
          text: "Internal AI request started for CloudPlus draft enrichment.",
        },
        {
          t: "09:15",
          text: "Provider timed out after 30 seconds, manual review required.",
        },
      ],
    },
  });

  await prisma.financialDraftReview.createMany({
    data: [
      {
        companyId: company.id,
        draftId: draftAws.id,
        userId: user.id,
        action: "APPROVE",
        note: "Documento consistente com fornecedor e valor.",
      },
      {
        companyId: company.id,
        draftId: draftNotion.id,
        userId: analyst.id,
        action: "EDIT",
        note: "Ajustado contexto para revisar centro de custo.",
        fieldDelta: {
          notes: {
            before: null,
            after: "Aguardando confirmacao de centro de custo",
          },
        },
      },
      {
        companyId: company.id,
        draftId: draftAcme.id,
        userId: analyst.id,
        action: "REJECT",
        note: "Cliente contestou cobranca, exigir segunda validacao.",
      },
      {
        companyId: company.id,
        draftId: draftActivePayable.id,
        userId: analyst.id,
        action: "EDIT",
        note: "Fila pronta para aprovacao no E2E.",
      },
      {
        companyId: company.id,
        draftId: draftActiveReceivable.id,
        userId: analyst.id,
        action: "EDIT",
        note: "Fila pronta para rejeicao no E2E.",
      },
    ],
  });

  await prisma.processingJobRun.createMany({
    data: [
      {
        companyId: company.id,
        mailboxId: mailboxes[0].id,
        runType: "imap-sync",
        status: "COMPLETED",
        fetchedCount: 4,
        processedCount: 3,
        errorCount: 1,
        summary: {
          newEmails: 4,
          draftsCreated: 3,
        },
        startedAt: new Date("2026-06-02T12:00:00Z"),
        finishedAt: new Date("2026-06-02T12:00:45Z"),
      },
      {
        companyId: company.id,
        mailboxId: mailboxes[0].id,
        runType: "imap-sync",
        status: "FAILED",
        fetchedCount: 1,
        processedCount: 0,
        errorCount: 1,
        errorMessage: "n8n returned invalid JSON",
        summary: {
          newEmails: 1,
        },
        startedAt: new Date("2026-06-02T12:18:00Z"),
        finishedAt: new Date("2026-06-02T12:18:30Z"),
      },
    ],
  });

  const changelogPublished = await prisma.changelogEntry.create({
    data: {
      companyId: company.id,
      authorId: user.id,
      title: "Active Actions ingress com IA",
      description: "Nova trilha de ingestao por AI events, AI run centralizado e fila de validacao humana.",
      version: "0.9.0",
      category: "IA",
      status: "PUBLICADO",
      publishedAt: new Date("2026-06-02T09:00:00Z"),
    },
  });

  await prisma.changelogEntry.create({
    data: {
      companyId: company.id,
      authorId: analyst.id,
      title: "Central de novidades com leitura por usuario",
      description: "Timeline interna pronta para rollout com marcacao de leitura.",
      version: "0.9.1",
      category: "DASHBOARD",
      status: "RASCUNHO",
    },
  });

  await prisma.changelogEntry.create({
    data: {
      companyId: company.id,
      authorId: user.id,
      title: "Integracao inicial com OMIE",
      description: "Estrutura inicial da integracao com OMIE pronta para homologacao e export manual de drafts aprovados.",
      version: "0.9.2",
      category: "INTEGRACAO",
      status: "RASCUNHO"
    }
  });

  await prisma.changelogEntry.create({
    data: {
      companyId: company.id,
      authorId: user.id,
      title: "Integracao inicial com ASAAS",
      description: "Sincronizacao inicial de clientes, cobrancas, pagamentos e webhooks do Asaas pronta para sandbox e producao.",
      version: "0.9.3",
      category: "INTEGRACAO",
      status: "RASCUNHO"
    }
  });

  await prisma.changelogRead.create({
    data: {
      companyId: company.id,
      entryId: changelogPublished.id,
      userId: viewer.id,
      readAt: new Date("2026-06-02T09:12:00Z"),
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: company.id,
        userId: user.id,
        action: "mailbox.sync.completed",
        resource: "mailbox-account",
        details: {
          mailboxId: mailboxes[0].id,
          processedCount: 3,
        },
      },
      {
        companyId: company.id,
        userId: analyst.id,
        action: "financial_draft.reviewed",
        resource: "financial-draft",
        details: {
          draftId: draftActivePayable.id,
          status: "PENDENTE_REVISAO",
        },
      },
      {
        companyId: company.id,
        userId: user.id,
        action: "ai_event.processed",
        resource: "ai-event-source",
        details: {
          eventId: activeActionsPayableSource.eventId,
          draftId: draftActivePayable.id,
        },
      },
      {
        companyId: company.id,
        userId: user.id,
        action: "changelog.published",
        resource: "changelog-entry",
        details: {
          entryId: changelogPublished.id,
        },
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: user.id,
      action: "seed.completed",
      resource: "system",
      details: {
        email: user.email,
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

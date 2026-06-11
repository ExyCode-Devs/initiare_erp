import { randomUUID } from "node:crypto";
import {
  AiEventOriginType,
  AiEventStatus,
  AiGatewayRunStatus,
  AttachmentStatus,
  AutomationStatus,
  ChangelogCategory,
  ChangelogStatus,
  ConfidenceBand,
  DraftRouteSource,
  DraftRoutingStatus,
  DraftStatus,
  ErpEnvironment,
  ErpHealthStatus,
  ErpProvider,
  ErpSyncEntityType,
  ErpSyncStatus,
  ExtractionRunStatus,
  FinanceStatus,
  FinancialDirection,
  InboxStatus,
  JobRunStatus,
  LogStatus,
  Prisma,
  PrismaClient,
  ReviewAction,
  Severity,
} from "@prisma/client";
import { env } from "../src/config/env.js";
import { DEFAULT_AUTOMATION_SETTINGS } from "../src/lib/automation-settings.js";

const DEMO_SOURCE_EVENT_ID = "demo-ai-event-cloudplus";
const DEMO_MAILBOX_NAME = "Financeiro";

export async function provisionDemoData(prisma: PrismaClient) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { slug: "initiare-erp" },
    include: {
      legalEntities: {
        where: { active: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      memberships: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const legalEntity = company.legalEntities[0];
  const admin = company.memberships.find((membership) => membership.user.email === env.SEED_ADMIN_EMAIL)?.user;

  if (!legalEntity || !admin) {
    throw new Error("Demo seed requires default legal entity and admin membership.");
  }

  await prisma.erpWebhookEvent.deleteMany({ where: { companyId: company.id } });
  await prisma.erpRequestLog.deleteMany({ where: { companyId: company.id } });
  await prisma.erpSyncRecord.deleteMany({ where: { companyId: company.id } });
  await prisma.erpConnection.deleteMany({ where: { companyId: company.id } });
  await prisma.portalAccess.deleteMany({ where: { companyId: company.id } });
  await prisma.allocationRule.deleteMany({ where: { companyId: company.id } });
  await prisma.businessClientLegalEntity.deleteMany({ where: { companyId: company.id } });
  await prisma.businessClient.deleteMany({ where: { companyId: company.id } });
  await prisma.changelogRead.deleteMany({ where: { companyId: company.id } });
  await prisma.changelogEntry.deleteMany({ where: { companyId: company.id } });
  await prisma.financialDraftReview.deleteMany({ where: { companyId: company.id } });
  await prisma.financialDraft.deleteMany({ where: { companyId: company.id } });
  await prisma.aiGatewayRun.deleteMany({ where: { companyId: company.id } });
  await prisma.aiEventSource.deleteMany({ where: { companyId: company.id } });
  await prisma.n8nExtractionRun.deleteMany({ where: { companyId: company.id } });
  await prisma.emailAttachment.deleteMany({ where: { companyId: company.id } });
  await prisma.inboundEmail.deleteMany({ where: { companyId: company.id } });
  await prisma.processingJobRun.deleteMany({ where: { companyId: company.id } });
  await prisma.mailboxAccount.deleteMany({ where: { companyId: company.id } });
  await prisma.auditLog.deleteMany({ where: { companyId: company.id } });
  await prisma.insight.deleteMany({ where: { companyId: company.id } });
  await prisma.dreEntry.deleteMany({ where: { companyId: company.id } });
  await prisma.performancePoint.deleteMany({ where: { companyId: company.id } });
  await prisma.dailyReconciliationPoint.deleteMany({ where: { companyId: company.id } });
  await prisma.expenseCategory.deleteMany({ where: { companyId: company.id } });
  await prisma.cashflowPoint.deleteMany({ where: { companyId: company.id } });
  await prisma.integration.deleteMany({ where: { companyId: company.id } });
  await prisma.report.deleteMany({ where: { companyId: company.id } });
  await prisma.flow.deleteMany({ where: { companyId: company.id } });
  await prisma.automation.deleteMany({ where: { companyId: company.id } });
  await prisma.aiLog.deleteMany({ where: { companyId: company.id } });
  await prisma.exceptionItem.deleteMany({ where: { companyId: company.id } });
  await prisma.reconciliationItem.deleteMany({ where: { companyId: company.id } });
  await prisma.operation.deleteMany({ where: { companyId: company.id } });
  await prisma.accountReceivable.deleteMany({ where: { companyId: company.id } });
  await prisma.accountPayable.deleteMany({ where: { companyId: company.id } });
  await prisma.client.deleteMany({ where: { companyId: company.id } });
  await prisma.supplier.deleteMany({ where: { companyId: company.id } });

  await prisma.company.update({
    where: { id: company.id },
    data: {
      domain: "localhost:8080",
      replyFromName: "Initiare Finance",
      replyFromEmail: "finance@initiare.com.br",
      replyToEmail: "reply@initiare.com.br",
      companiesCount: 2,
      aiCycleLabel: "ultima-execucao-registrada",
      aiUptime: 99.98,
      latencyMs: 142,
      integrationsHealthy: 2,
      integrationsTotal: 2,
      timeSavedHours: 284,
      monthlyOperations: 8241,
      operationalSavings: new Prisma.Decimal(42800),
      automationSettings: DEFAULT_AUTOMATION_SETTINGS,
    },
  });

  await prisma.legalEntity.update({
    where: { id: legalEntity.id },
    data: {
      defaultRecipientEmails: ["financeiro@initiare.com.br"],
      defaultMailboxIds: [DEMO_MAILBOX_NAME],
      notes: "Live smoke legal entity",
    },
  });

  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      name: "Acme Industries",
      document: "11.222.333/0001-44",
      segment: "Industria",
      annualRevenue: new Prisma.Decimal(840000),
      status: "Ativo",
      sinceYear: 2022,
    },
  });

  const secondClient = await prisma.client.create({
    data: {
      companyId: company.id,
      name: "Globex Corp",
      document: "22.333.444/0001-55",
      segment: "Tecnologia",
      annualRevenue: new Prisma.Decimal(1260000),
      status: "Ativo",
      sinceYear: 2023,
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      companyId: company.id,
      name: "CloudPlus Infra",
      cnpj: "55.666.777/0001-88",
      category: "Infraestrutura",
      yearlySpend: new Prisma.Decimal(65420.75),
      lastTransaction: "2026-06-03",
    },
  });

  const secondSupplier = await prisma.supplier.create({
    data: {
      companyId: company.id,
      name: "PeopleOps Payroll",
      cnpj: "66.777.888/0001-99",
      category: "Folha",
      yearlySpend: new Prisma.Decimal(118000),
      lastTransaction: "2026-06-01",
    },
  });

  await prisma.accountPayable.create({
    data: {
      companyId: company.id,
      supplierId: supplier.id,
      amount: new Prisma.Decimal(5420.75),
      dueDate: new Date("2026-06-12T00:00:00.000Z"),
      category: "Infraestrutura",
      status: FinanceStatus.EM_REVISAO,
      confidence: 0.88,
      source: "Inbox Financeiro",
      assignee: "IA",
    },
  });

  await prisma.accountReceivable.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      amount: new Prisma.Decimal(18400),
      dueDate: new Date("2026-06-28T00:00:00.000Z"),
      status: FinanceStatus.EM_REVISAO,
      source: "AI Gateway",
      channel: "Boleto",
    },
  });

  await prisma.operation.createMany({
    data: [
      {
        companyId: company.id,
        supplierId: supplier.id,
        reference: "OP-1001",
        amount: new Prisma.Decimal(5420.75),
        dueDate: new Date("2026-06-12T00:00:00.000Z"),
        category: "Infraestrutura",
        status: FinanceStatus.EM_REVISAO,
        source: "AI Gateway",
        confidence: 0.88,
        assignee: "IA",
        direction: "OUT",
      },
      {
        companyId: company.id,
        supplierId: secondSupplier.id,
        reference: "OP-1002",
        amount: new Prisma.Decimal(9830.45),
        dueDate: new Date("2026-06-15T00:00:00.000Z"),
        category: "Folha",
        status: FinanceStatus.PROCESSADO,
        source: "Inbox Financeiro",
        confidence: 0.94,
        assignee: "Analyst",
        direction: "OUT",
      },
    ],
  });

  await prisma.reconciliationItem.createMany({
    data: [
      {
        companyId: company.id,
        code: "RECON-1001",
        bankDate: new Date("2026-06-10T00:00:00.000Z"),
        bankDescription: "TED CloudPlus",
        bankValue: new Prisma.Decimal(-5420.75),
        bookDate: new Date("2026-06-10T00:00:00.000Z"),
        bookDescription: "CloudPlus Infra",
        bookValue: new Prisma.Decimal(-5420.75),
        matchScore: 1,
      },
      {
        companyId: company.id,
        code: "RECON-1002",
        bankDate: new Date("2026-06-10T00:00:00.000Z"),
        bankDescription: "PIX desconhecido",
        bankValue: new Prisma.Decimal(315),
        bookDate: null,
        bookDescription: "-",
        bookValue: new Prisma.Decimal(0),
        matchScore: 0,
      },
    ],
  });

  await prisma.exceptionItem.create({
    data: {
      companyId: company.id,
      code: "AI-FAIL-001",
      title: "AI failure on manual review for Draft CloudPlus Infra",
      description: "AI provider timeout after 30s",
      suggestion: "Retry AI generation or complete draft review manually.",
      confidence: 0.42,
      severity: Severity.ALTA,
      status: "OPEN",
      timeLabel: "agora",
      timeline: [
        { t: "09:15", text: "Internal AI request started." },
        { t: "09:15", text: "Provider timed out, manual review required." },
      ],
    },
  });

  await prisma.aiLog.createMany({
    data: [
      {
        companyId: company.id,
        occurredAt: new Date("2026-06-10T09:10:00.000Z"),
        input: "Cloud invoice incoming",
        action: "Created payable draft",
        confidence: 0.88,
        status: LogStatus.OK,
        parsedPayload: { amount: 5420.75, direction: "CONTA_PAGAR" },
        justification: "Matched recurring supplier and payment pattern.",
      },
      {
        companyId: company.id,
        occurredAt: new Date("2026-06-10T09:15:00.000Z"),
        input: "Provider timeout",
        action: "Raised exception and routed to manual review",
        confidence: 0.42,
        status: LogStatus.WARN,
        parsedPayload: { fallback: true },
        justification: "Provider response exceeded timeout threshold.",
      },
    ],
  });

  await prisma.automation.createMany({
    data: [
      {
        companyId: company.id,
        title: "Inbox processor",
        description: "Reads incoming finance emails and normalizes events.",
        runs: 128,
        accuracy: 92,
        status: AutomationStatus.ACTIVE,
      },
      {
        companyId: company.id,
        title: "Receivable monitor",
        description: "Tracks receivables and payment confirmations.",
        runs: 64,
        accuracy: 87,
        status: AutomationStatus.PAUSED,
      },
    ],
  });

  await prisma.flow.createMany({
    data: [
      {
        companyId: company.id,
        name: "Finance intake",
        description: "Email to reviewable draft pipeline.",
        runs: 128,
        status: AutomationStatus.ACTIVE,
        steps: ["Email", "IA", "Aprovar", "Pagar"],
      },
      {
        companyId: company.id,
        name: "Receivable sync",
        description: "Receivable sync and notify pipeline.",
        runs: 42,
        status: AutomationStatus.PAUSED,
        steps: ["Trigger", "IA Regua", "Notificar"],
      },
    ],
  });

  await prisma.report.createMany({
    data: [
      {
        companyId: company.id,
        name: "DRE Mensal",
        description: "Monthly P&L export.",
        updatedLabel: "Updated 10 minutes ago",
      },
      {
        companyId: company.id,
        name: "Fluxo de Caixa Projetado",
        description: "Projected cashflow export.",
        updatedLabel: "Updated 1 hour ago",
      },
    ],
  });

  await prisma.integration.createMany({
    data: [
      {
        companyId: company.id,
        name: "OMIE",
        description: "ERP principal",
        status: "CONNECTED",
      },
      {
        companyId: company.id,
        name: "ASAAS",
        description: "Recebiveis e webhooks",
        status: "CONNECTED",
      },
    ],
  });

  await prisma.cashflowPoint.createMany({
    data: [
      { companyId: company.id, monthKey: 202601, month: "Jan", entrada: new Prisma.Decimal(120), saida: new Prisma.Decimal(95) },
      { companyId: company.id, monthKey: 202602, month: "Fev", entrada: new Prisma.Decimal(128), saida: new Prisma.Decimal(98) },
      { companyId: company.id, monthKey: 202603, month: "Mar", entrada: new Prisma.Decimal(134), saida: new Prisma.Decimal(101) },
      { companyId: company.id, monthKey: 202604, month: "Abr", entrada: new Prisma.Decimal(142), saida: new Prisma.Decimal(108) },
      { companyId: company.id, monthKey: 202605, month: "Mai", entrada: new Prisma.Decimal(148), saida: new Prisma.Decimal(109) },
      { companyId: company.id, monthKey: 202606, month: "Jun", entrada: new Prisma.Decimal(154), saida: new Prisma.Decimal(112) },
    ],
  });

  await prisma.expenseCategory.createMany({
    data: [
      { companyId: company.id, name: "Infraestrutura", value: 52 },
      { companyId: company.id, name: "Software", value: 32 },
      { companyId: company.id, name: "Folha", value: 16 },
    ],
  });

  await prisma.dailyReconciliationPoint.createMany({
    data: [
      { companyId: company.id, day: 1, auto: 3, manual: 1 },
      { companyId: company.id, day: 2, auto: 4, manual: 1 },
      { companyId: company.id, day: 3, auto: 5, manual: 2 },
    ],
  });

  await prisma.performancePoint.createMany({
    data: [
      { companyId: company.id, day: 1, accuracy: 88, ops: 12 },
      { companyId: company.id, day: 2, accuracy: 90, ops: 14 },
      { companyId: company.id, day: 3, accuracy: 92, ops: 16 },
      { companyId: company.id, day: 4, accuracy: 91, ops: 18 },
    ],
  });

  await prisma.dreEntry.createMany({
    data: [
      { companyId: company.id, label: "Receita liquida", value: new Prisma.Decimal(184000), type: "in", bold: true, highlight: false },
      { companyId: company.id, label: "Custos diretos", value: new Prisma.Decimal(64800), type: "out", bold: false, highlight: false },
      { companyId: company.id, label: "EBITDA", value: new Prisma.Decimal(73200), type: "in", bold: true, highlight: true },
    ],
  });

  await prisma.insight.createMany({
    data: [
      {
        companyId: company.id,
        tone: "ai",
        title: "Revenue trend healthy",
        description: "Collections improved in the last 30 days.",
      },
      {
        companyId: company.id,
        tone: "warning",
        title: "Payables concentration",
        description: "Infra spend still concentrated in one supplier.",
      },
    ],
  });

  const mailbox = await prisma.mailboxAccount.create({
    data: {
      companyId: company.id,
      legalEntityId: legalEntity.id,
      name: DEMO_MAILBOX_NAME,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      username: "financeiro@initiare.com.br",
      passwordCipher: "demo-cipher",
      fromFilter: "billing@cloudplus.example",
      active: true,
      lastSyncAt: new Date("2026-06-10T11:10:00.000Z"),
      lastError: null,
    },
  });

  const inboundEmail = await prisma.inboundEmail.create({
    data: {
      companyId: company.id,
      legalEntityId: legalEntity.id,
      mailboxId: mailbox.id,
      externalMessageId: `demo-message-${randomUUID()}`,
      dedupeHash: `demo-dedupe-${randomUUID()}`,
      sender: "billing@cloudplus.example",
      replyTo: null,
      toRecipients: ["financeiro@initiare.com.br"],
      ccRecipients: [],
      bccRecipients: [],
      subject: "CloudPlus invoice June 2026",
      bodyText: "Invoice attached for june.",
      bodyHtml: null,
      rawHeaders: { "message-id": "demo-message" },
      originalEmlPath: "demo/inbox/cloudplus.eml",
      receivedAt: new Date("2026-06-03T09:00:00.000Z"),
      status: InboxStatus.AGUARDANDO_VALIDACAO,
      processingError: null,
    },
  });

  await prisma.emailAttachment.create({
    data: {
      companyId: company.id,
      emailId: inboundEmail.id,
      originalName: "cloudplus-june-2026.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1048576,
      storagePath: "demo/attachments/cloudplus-june-2026.pdf",
      checksum: "demo-attachment-checksum",
      extractedText: "Cloud invoice extracted text",
      extractionMeta: { provider: "demo" },
      status: AttachmentStatus.EXTRAIDO,
      processingError: null,
    },
  });

  const extractionRun = await prisma.n8nExtractionRun.create({
    data: {
      companyId: company.id,
      emailId: inboundEmail.id,
      provider: "n8n",
      workflowId: "wf-1",
      requestPayload: { emailId: inboundEmail.id },
      rawResponse: "{\"normalized\":true}",
      parsedResponse: { normalized: true },
      status: ExtractionRunStatus.SUCESSO,
      errorMessage: null,
      durationMs: 380,
      startedAt: new Date("2026-06-03T09:00:00.000Z"),
      completedAt: new Date("2026-06-03T09:00:04.000Z"),
    },
  });

  const sourceEvent = await prisma.aiEventSource.create({
    data: {
      companyId: company.id,
      legalEntityId: legalEntity.id,
      eventId: DEMO_SOURCE_EVENT_ID,
      originType: AiEventOriginType.ACTIVE_ACTIONS,
      channel: "gmail",
      sender: "billing@cloudplus.example",
      subject: "CloudPlus invoice June 2026",
      summary: "CloudPlus sent June infrastructure invoice with boleto due on 2026-06-12.",
      attachmentsMeta: [{ filename: "cloudplus-june-2026.pdf" }],
      rawPayload: { provider: "active-actions-gateway" },
      receivedAt: new Date("2026-06-03T09:00:00.000Z"),
      status: AiEventStatus.PROCESSED,
      processingError: null,
      routingStatus: DraftRoutingStatus.ROUTED,
      routeSource: DraftRouteSource.MAILBOX,
      routingReason: "Routed by mailbox alias financeiro@initiare.com.br",
    },
  });

  const aiRun = await prisma.aiGatewayRun.create({
    data: {
      companyId: company.id,
      eventSourceId: sourceEvent.id,
      provider: "active-actions-gateway",
      requestPayload: { eventSourceId: sourceEvent.id },
      rawResponse: "{\"normalized\":true}",
      parsedResponse: { partyName: "CloudPlus Infra", direction: "CONTA_PAGAR" },
      status: AiGatewayRunStatus.SUCESSO,
      errorMessage: null,
      durationMs: 400,
      startedAt: new Date("2026-06-03T09:00:00.000Z"),
      completedAt: new Date("2026-06-03T09:00:04.000Z"),
    },
  });

  const draft = await prisma.financialDraft.create({
    data: {
      companyId: company.id,
      legalEntityId: legalEntity.id,
      sourceEmailId: inboundEmail.id,
      extractionRunId: extractionRun.id,
      sourceEventId: sourceEvent.id,
      aiRunId: aiRun.id,
      direction: FinancialDirection.CONTA_PAGAR,
      partyName: "CloudPlus Infra",
      cpfCnpj: "55.666.777/0001-88",
      amount: new Prisma.Decimal(5420.75),
      dueDate: new Date("2026-06-12T00:00:00.000Z"),
      competence: "2026-06",
      description: "Infra cloud june/2026",
      suggestedCategory: "Infraestrutura",
      finalCategory: "Infraestrutura",
      paymentMethod: "Boleto",
      bankData: { bank: "Itau" },
      notes: "Awaiting analyst approval.",
      evidence: ["Normalized event", "Recurring supplier"],
      rawPayload: { provider: "active-actions-gateway" },
      confidenceScore: 0.88,
      confidenceBand: ConfidenceBand.ALTA,
      status: DraftStatus.PENDENTE_REVISAO,
      sourceLabel: "AI event",
      routingStatus: DraftRoutingStatus.ROUTED,
      routeSource: DraftRouteSource.MAILBOX,
      routingReason: "Routed by mailbox alias financeiro@initiare.com.br",
    },
  });

  await prisma.financialDraftReview.create({
    data: {
      companyId: company.id,
      draftId: draft.id,
      userId: admin.id,
      action: ReviewAction.EDIT,
      note: "Seeded review history",
      fieldDelta: { notes: "Awaiting analyst approval." },
    },
  });

  await prisma.processingJobRun.create({
    data: {
      companyId: company.id,
      mailboxId: mailbox.id,
      runType: "active-actions-gateway",
      status: JobRunStatus.COMPLETED,
      fetchedCount: 1,
      processedCount: 1,
      errorCount: 0,
      summary: { source: "demo" },
      errorMessage: null,
      startedAt: new Date("2026-06-03T09:00:00.000Z"),
      finishedAt: new Date("2026-06-03T09:00:04.000Z"),
    },
  });

  const omieConnection = await prisma.erpConnection.create({
    data: {
      companyId: company.id,
      legalEntityId: legalEntity.id,
      provider: ErpProvider.OMIE,
      environment: ErpEnvironment.HOMOLOG,
      appKeyCipher: "demo-omie-key",
      appSecretCipher: "demo-omie-secret",
      webhookAuthTokenCipher: null,
      baseUrl: "https://app.omie.com.br/api/v1",
      enabled: true,
      lastSyncAt: new Date("2026-06-10T10:00:00.000Z"),
      lastHealthcheckAt: new Date("2026-06-10T10:05:00.000Z"),
      lastHealthcheckStatus: ErpHealthStatus.HEALTHY,
      lastError: null,
    },
  });

  const asaasConnection = await prisma.erpConnection.create({
    data: {
      companyId: company.id,
      legalEntityId: legalEntity.id,
      provider: ErpProvider.ASAAS,
      environment: ErpEnvironment.SANDBOX,
      appKeyCipher: "demo-asaas-key",
      appSecretCipher: null,
      webhookAuthTokenCipher: "demo-asaas-webhook",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      enabled: true,
      lastSyncAt: new Date("2026-06-10T10:00:00.000Z"),
      lastHealthcheckAt: new Date("2026-06-10T10:05:00.000Z"),
      lastHealthcheckStatus: ErpHealthStatus.HEALTHY,
      lastError: null,
    },
  });

  await prisma.erpSyncRecord.create({
    data: {
      companyId: company.id,
      connectionId: asaasConnection.id,
      provider: ErpProvider.ASAAS,
      environment: ErpEnvironment.SANDBOX,
      entityType: ErpSyncEntityType.CHARGE,
      internalId: "charge-1",
      externalId: "asaas-1",
      status: ErpSyncStatus.SUCCESS,
      requestPayload: {
        id: "asaas-1",
        customerId: client.id,
        customerName: client.name,
        status: "RECEIVED",
        description: "Monthly billing",
        billingType: "BOLETO",
        grossValue: 18400,
        netValue: 17990,
        feeValue: 410,
        dueDate: "2026-06-28T00:00:00.000Z",
        paymentDate: "2026-06-29T00:00:00.000Z",
        invoiceUrl: "https://example.test/invoice",
      },
      responsePayload: { ok: true },
      errorMessage: null,
      syncedAt: new Date("2026-06-10T10:10:00.000Z"),
      draftId: null,
    },
  });

  await prisma.erpWebhookEvent.create({
    data: {
      companyId: company.id,
      connectionId: asaasConnection.id,
      provider: ErpProvider.ASAAS,
      environment: ErpEnvironment.SANDBOX,
      externalEventId: "webhook-1",
      eventType: "PAYMENT_RECEIVED",
      headers: { "asaas-access-token": "demo" },
      payload: { id: "webhook-1" },
      status: ErpSyncStatus.SUCCESS,
      errorMessage: null,
      processedAt: new Date("2026-06-10T10:10:00.000Z"),
    },
  });

  await prisma.businessClient.create({
    data: {
      companyId: company.id,
      clientId: secondClient.id,
      name: "Globex Enterprise",
      active: true,
      legalEntities: {
        create: {
          companyId: company.id,
          legalEntityId: legalEntity.id,
          priority: 0,
        },
      },
      allocationRules: {
        create: {
          companyId: company.id,
          strategy: "MANUAL",
          legalEntityId: legalEntity.id,
          percentageMap: Prisma.JsonNull,
          valueBands: Prisma.JsonNull,
          groupMap: Prisma.JsonNull,
          monthlyCapMap: Prisma.JsonNull,
          active: true,
        },
      },
    },
  });

  await prisma.changelogEntry.create({
    data: {
      companyId: company.id,
      authorId: admin.id,
      title: "Active Actions ingress with AI",
      description: "New AI event intake pipeline.",
      version: "0.9.0",
      category: ChangelogCategory.IA,
      status: ChangelogStatus.PUBLICADO,
      imageUrl: null,
      publishedAt: new Date("2026-06-03T09:00:00.000Z"),
    },
  });
}

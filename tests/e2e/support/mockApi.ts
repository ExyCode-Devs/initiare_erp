import { expect, type Page, type Route } from "@playwright/test";

const TOKEN_KEY = "veridia.access-token";
const TOKEN = "test-token";

type DraftListItem = {
  review: {
    workflowStatus: string;
    execution: {
      provider: string;
      environment: string;
      status: string;
      queuedAt: string | null;
      startedAt: string | null;
      finishedAt: string | null;
      retryCount: number;
      lastError: string | null;
      externalPartyId: string | null;
      externalEntryId: string | null;
      requestPayload: unknown;
      responsePayload: unknown;
      billingArtifact: unknown;
    } | null;
    blockers: Array<{ code: string; message: string }>;
    canApprove: boolean;
  };
  id: string;
  direction: string;
  partyName: string;
  cpfCnpj: string | null;
  amount: number | null;
  dueDate: string | null;
  description: string;
  suggestedCategory: string | null;
  finalCategory: string | null;
  paymentMethod: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  routingStatus: string;
  routingReason: string | null;
  routeSource: string;
  confidenceScore: number;
  confidenceBand: string;
  status: string;
  source: {
    id: string;
    originType: string;
    channel: string;
    sender: string | null;
    subject: string | null;
    summary?: string | null;
    receivedAt: string;
  } | null;
  email: {
    id: string;
    sender: string;
    subject: string;
  } | null;
  omieSync: {
    environment: "HOMOLOG" | "PRODUCTION";
    status: string;
    externalId: string | null;
    errorMessage: string | null;
  } | null;
};

type ExceptionItem = {
  id: string;
  code: string;
  title: string;
  desc: string;
  suggestion: string;
  confidence: number;
  severity: string;
  time: string;
  status: string;
  timeline: Array<{ t: string; text: string }>;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function binary(route: Route, body: Buffer, contentType: string) {
  return route.fulfill({
    status: 200,
    contentType,
    body,
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createMockState() {
  const user = {
    id: "user-1",
    name: "Admin User",
    email: "admin@veridia.local",
    role: "ADMIN" as const,
  };

  const activeCompany = {
    id: "company-1",
    name: "Initiare ERP",
    domain: "localhost",
  };

  const memberships = [
    {
      id: "membership-1",
      role: "ADMIN" as const,
      isDefault: true,
      company: activeCompany,
    },
  ];

  const legalEntities = [
    {
      id: "legal-1",
      legalName: "Initiare Tecnologia Ltda",
      tradeName: "Initiare",
      cnpj: "11.222.333/0001-44",
      active: true,
      isDefault: true,
      defaultRecipientEmails: ["financeiro@initiare.com.br"],
      defaultMailboxIds: ["mailbox-1"],
      notes: "Main legal entity",
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
    },
    {
      id: "legal-2",
      legalName: "Initiare Servicos Ltda",
      tradeName: "Initiare Services",
      cnpj: "55.666.777/0001-88",
      active: true,
      isDefault: false,
      defaultRecipientEmails: ["ops@initiare.com.br"],
      defaultMailboxIds: ["mailbox-2"],
      notes: "Second legal entity",
      createdAt: "2026-06-02T09:00:00.000Z",
      updatedAt: "2026-06-02T09:00:00.000Z",
    },
  ];

  const mailboxes = [
    {
      id: "mailbox-1",
      name: "Financeiro",
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      username: "financeiro@initiare.com.br",
      legalEntityId: "legal-1",
      fromFilter: "billing@cloudplus.example",
      active: true,
      lastSyncAt: "2026-06-10T11:10:00.000Z",
      lastError: null,
      createdAt: "2026-06-05T09:00:00.000Z",
    },
    {
      id: "mailbox-2",
      name: "Receitas",
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      username: "receitas@initiare.com.br",
      legalEntityId: "legal-2",
      fromFilter: null,
      active: true,
      lastSyncAt: "2026-06-10T11:05:00.000Z",
      lastError: null,
      createdAt: "2026-06-05T10:00:00.000Z",
    },
  ];

  const drafts: DraftListItem[] = [
    {
      review: {
        workflowStatus: "pending_review",
        execution: null,
        blockers: [],
        canApprove: true,
      },
      id: "draft-1",
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus Infra",
      cpfCnpj: "11.222.333/0001-44",
      amount: 5420.75,
      dueDate: "2026-06-12T00:00:00.000Z",
      description: "Infra cloud june/2026",
      suggestedCategory: "Infraestrutura",
      finalCategory: "Infraestrutura",
      paymentMethod: "Boleto",
      legalEntityId: "legal-1",
      legalEntityName: "Initiare",
      routingStatus: "ROUTED",
      routingReason: "Routed by mailbox alias financeiro@initiare.com.br",
      routeSource: "MAILBOX",
      confidenceScore: 88,
      confidenceBand: "ALTA",
      status: "PENDENTE_REVISAO",
      source: {
        id: "event-1",
        originType: "ACTIVE_ACTIONS",
        channel: "gmail",
        sender: "billing@cloudplus.example",
        subject: "CloudPlus invoice June 2026",
        summary: "CloudPlus sent June infrastructure invoice with boleto due on 2026-06-12.",
        receivedAt: "2026-06-03T09:00:00.000Z",
      },
      email: null,
      omieSync: null,
    },
    {
      review: {
        workflowStatus: "pending_review",
        execution: null,
        blockers: [],
        canApprove: true,
      },
      id: "draft-2",
      direction: "CONTA_RECEBER",
      partyName: "Globex Corp",
      cpfCnpj: null,
      amount: 16200,
      dueDate: "2026-06-18T00:00:00.000Z",
      description: "Monthly renewal Globex june/2026",
      suggestedCategory: "Receita recorrente",
      finalCategory: "Receita recorrente",
      paymentMethod: "PIX",
      legalEntityId: "legal-2",
      legalEntityName: "Initiare Services",
      routingStatus: "ROUTED",
      routingReason: "Routed by legal entity mapping",
      routeSource: "MANUAL",
      confidenceScore: 61,
      confidenceBand: "MEDIA",
      status: "PENDENTE_REVISAO",
      source: {
        id: "event-2",
        originType: "ACTIVE_ACTIONS",
        channel: "webhook",
        sender: "receivables@globex.example",
        subject: "Globex receivable june",
        summary: "Receivable event for Globex renewal due on 2026-06-18.",
        receivedAt: "2026-06-03T09:10:00.000Z",
      },
      email: null,
      omieSync: null,
    },
  ];

  const draftDetails = new Map<string, Record<string, unknown>>([
    [
      "draft-1",
      {
        ...clone(drafts[0]),
        review: {
          ...clone(drafts[0].review),
          duplicateCandidates: [],
        },
        competence: "2026-06",
        bankData: { bank: "Itau" },
        notes: "New event awaiting approval.",
        evidence: ["Normalized event", "Recurring supplier"],
        rawPayload: { provider: "active-actions-gateway" },
        rejectionReason: null,
        source: {
          ...clone(drafts[0].source),
          attachments: [{ filename: "cloudplus-june-2026.pdf", mimeType: "application/pdf" }],
          rawPayload: { eventId: "draft-1" },
          status: "PROCESSED",
          processingError: null,
        },
        aiRun: {
          id: "run-1",
          provider: "active-actions-gateway",
          status: "SUCESSO",
          errorMessage: null,
          rawResponse: "{\"normalized\":true}",
          parsedResponse: {
            partyName: "CloudPlus Infra",
            direction: "CONTA_PAGAR",
          },
          startedAt: "2026-06-03T09:00:00.000Z",
          completedAt: "2026-06-03T09:00:04.000Z",
        },
        sourceEmail: {
          id: "email-1",
          sender: "billing@cloudplus.example",
          subject: "CloudPlus invoice June 2026",
          bodyText: "Invoice attached.",
          receivedAt: "2026-06-03T09:00:00.000Z",
          attachments: [
            {
              id: "attachment-1",
              originalName: "cloudplus-june-2026.pdf",
              mimeType: "application/pdf",
              extractedText: "Cloud invoice extracted text",
            },
          ],
          extractionRuns: [
            {
              id: "extract-1",
              provider: "activepieces",
              workflowId: "wf-1",
              status: "SUCESSO",
              errorMessage: null,
              parsedResponse: { normalized: true },
              startedAt: "2026-06-03T09:00:00.000Z",
              completedAt: "2026-06-03T09:00:04.000Z",
            },
          ],
        },
        reviews: [],
        omieHistory: {
          syncs: [],
          requests: [],
        },
      },
    ],
    [
      "draft-2",
      {
        ...clone(drafts[1]),
        review: {
          ...clone(drafts[1].review),
          duplicateCandidates: [],
        },
        competence: "2026-06",
        bankData: null,
        notes: "Use this draft for rejection flow in E2E.",
        evidence: ["Recurring client", "Expected amount range"],
        rawPayload: { provider: "active-actions-gateway" },
        rejectionReason: null,
        source: {
          ...clone(drafts[1].source),
          attachments: [{ filename: "globex-renewal.json", mimeType: "application/json" }],
          rawPayload: { eventId: "draft-2" },
          status: "PROCESSED",
          processingError: null,
        },
        aiRun: {
          id: "run-2",
          provider: "active-actions-gateway",
          status: "SUCESSO",
          errorMessage: null,
          rawResponse: "{\"normalized\":true}",
          parsedResponse: {
            partyName: "Globex Corp",
            direction: "CONTA_RECEBER",
          },
          startedAt: "2026-06-03T09:10:00.000Z",
          completedAt: "2026-06-03T09:10:03.000Z",
        },
        sourceEmail: null,
        reviews: [],
        omieHistory: {
          syncs: [],
          requests: [],
        },
      },
    ],
  ]);

  const payables: Array<Record<string, unknown>> = [];
  const receivables = [
    {
      id: "receivable-1",
      cliente: "Acme Industries",
      valor: 18400,
      venc: "2026-06-28T00:00:00.000Z",
      status: "Em revisão",
      origem: "AI Gateway",
      canal: "Boleto",
    },
  ];

  const exceptions: ExceptionItem[] = [
    {
      id: "exception-1",
      code: "AI-FAIL-001",
      title: "AI failure on manual review for Draft CloudPlus Infra",
      desc: "AI provider timeout after 30s",
      suggestion: "Retry AI generation or complete draft review manually.",
      confidence: 0,
      severity: "Alta",
      time: "agora",
      status: "OPEN",
      timeline: [
        { t: "09:15", text: "Internal AI request started." },
        { t: "09:15", text: "Provider timed out, manual review required." },
      ],
    },
    {
      id: "exception-2",
      code: "OPS-001",
      title: "Seeded exception for dashboard",
      desc: "Manual reconciliation required.",
      suggestion: "Check supplier mapping.",
      confidence: 42,
      severity: "Media",
      time: "1h",
      status: "OPEN",
      timeline: [{ t: "08:00", text: "Exception created." }],
    },
  ];

  const operations = [
    {
      id: "op-1",
      reference: "OP-1001",
      fornecedor: "CloudPlus Infra",
      valor: 5420.75,
      vencimento: "2026-06-12T00:00:00.000Z",
      categoria: "Infraestrutura",
      status: "Em revisão",
      origem: "AI Gateway",
      confianca: 0.88,
      responsavel: "IA",
    },
    {
      id: "op-2",
      reference: "OP-1002",
      fornecedor: "PeopleOps Payroll",
      valor: 9830.45,
      vencimento: "2026-06-15T00:00:00.000Z",
      categoria: "Folha",
      status: "Processado",
      origem: "Inbox Financeiro",
      confianca: 0.94,
      responsavel: "Analyst",
    },
  ];

  const clients = [
    {
      id: "client-1",
      name: "Acme Industries",
      document: "11.222.333/0001-44",
      segment: "Industria",
      revenue: 840000,
      status: "Ativo",
      since: "2022",
    },
    {
      id: "client-2",
      name: "Globex Corp",
      document: "22.333.444/0001-55",
      segment: "Tecnologia",
      revenue: 1260000,
      status: "Ativo",
      since: "2023",
    },
  ];

  const suppliers = [
    {
      id: "supplier-1",
      name: "CloudPlus Infra",
      cnpj: "11.222.333/0001-44",
      category: "Infraestrutura",
      spend: 65420.75,
      last: "2026-06-03",
    },
    {
      id: "supplier-2",
      name: "PeopleOps Payroll",
      cnpj: "55.666.777/0001-88",
      category: "Folha",
      spend: 118000,
      last: "2026-06-01",
    },
  ];

  const reconciliationItems = [
    {
      id: "recon-1",
      bank: { date: "10/06/2026", desc: "TED CloudPlus", value: -5420.75 },
      book: { date: "10/06/2026", desc: "CloudPlus Infra", value: -5420.75 },
      match: 1,
    },
    {
      id: "recon-2",
      bank: { date: "10/06/2026", desc: "PIX desconhecido", value: 315 },
      book: { date: "-", desc: "-", value: 0 },
      match: 0,
    },
  ];

  const aiLogs = [
    {
      id: "ai-log-1",
      time: "09:10",
      input: "Cloud invoice incoming",
      action: "Created payable draft",
      confidence: 0.88,
      status: "ok",
      parsedPayload: { amount: 5420.75, direction: "CONTA_PAGAR" },
      justification: "Matched recurring supplier and payment pattern.",
    },
    {
      id: "ai-log-2",
      time: "09:15",
      input: "Provider timeout",
      action: "Raised exception and routed to manual review",
      confidence: 0.42,
      status: "warn",
      parsedPayload: { fallback: true },
      justification: "Provider response exceeded timeout threshold.",
    },
  ];

  const automations = [
    {
      id: "automation-1",
      title: "Inbox processor",
      desc: "Reads incoming finance emails and normalizes events.",
      runs: 128,
      accuracy: 92,
      status: "active",
    },
    {
      id: "automation-2",
      title: "Receivable monitor",
      desc: "Tracks receivables and payment confirmations.",
      runs: 64,
      accuracy: 87,
      status: "paused",
    },
  ];

  const flows = [
    {
      id: "flow-1",
      name: "Finance intake",
      desc: "Email to reviewable draft pipeline.",
      runs: 128,
      status: "active",
      steps: ["Email", "IA", "Aprovar", "Pagar"],
    },
    {
      id: "flow-2",
      name: "Receivable sync",
      desc: "Receivable sync and notify pipeline.",
      runs: 42,
      status: "paused",
      steps: ["Trigger", "IA Regua", "Notificar"],
    },
  ];

  const reports = [
    {
      id: "report-1",
      name: "DRE Mensal",
      desc: "Monthly P&L export.",
      updated: "Updated 10 minutes ago",
    },
    {
      id: "report-2",
      name: "Fluxo de Caixa Projetado",
      desc: "Projected cashflow export.",
      updated: "Updated 1 hour ago",
    },
  ];

  const inboxList = [
    {
      id: "email-1",
      mailbox: "Financeiro",
      sender: "billing@cloudplus.example",
      subject: "CloudPlus invoice June 2026",
      receivedAt: "2026-06-03T09:00:00.000Z",
      status: "AGUARDANDO_VALIDACAO",
      attachmentCount: 1,
      extractionStatus: "SUCESSO",
      draft: {
        id: "draft-1",
        direction: "CONTA_PAGAR",
        partyName: "CloudPlus Infra",
        amount: 5420.75,
        confidenceScore: 88,
        confidenceBand: "ALTA",
        status: "PENDENTE_REVISAO",
      },
    },
    {
      id: "email-2",
      mailbox: "Receitas",
      sender: "receivables@globex.example",
      subject: "Globex receivable june",
      receivedAt: "2026-06-03T09:10:00.000Z",
      status: "PROCESSADO",
      attachmentCount: 1,
      extractionStatus: "SUCESSO",
      draft: {
        id: "draft-2",
        direction: "CONTA_RECEBER",
        partyName: "Globex Corp",
        amount: 16200,
        confidenceScore: 61,
        confidenceBand: "MEDIA",
        status: "PENDENTE_REVISAO",
      },
    },
  ];

  const inboxDetails = new Map<string, Record<string, unknown>>([
    [
      "email-1",
      {
        id: "email-1",
        mailbox: "Financeiro",
        sender: "billing@cloudplus.example",
        replyTo: null,
        toRecipients: ["financeiro@initiare.com.br"],
        ccRecipients: null,
        bccRecipients: null,
        subject: "CloudPlus invoice June 2026",
        bodyText: "Invoice attached for june",
        bodyHtml: null,
        receivedAt: "2026-06-03T09:00:00.000Z",
        status: "AGUARDANDO_VALIDACAO",
        processingError: null,
        attachments: [
          {
            id: "attachment-1",
            originalName: "cloudplus-june-2026.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1048576,
            status: "EXTRAIDO",
            processingError: null,
            extractedText: "Cloud invoice extracted text",
            downloadPath: "/api/inbox/attachments/attachment-1/download",
          },
        ],
        extractionRuns: [
          {
            id: "extract-1",
            provider: "activepieces",
            workflowId: "wf-1",
            status: "SUCESSO",
            durationMs: 380,
            errorMessage: null,
            startedAt: "2026-06-03T09:00:00.000Z",
            completedAt: "2026-06-03T09:00:04.000Z",
            parsedResponse: { normalized: true },
          },
        ],
        drafts: [
          {
            id: "draft-1",
            direction: "CONTA_PAGAR",
            partyName: "CloudPlus Infra",
            cpfCnpj: "11.222.333/0001-44",
            amount: 5420.75,
            dueDate: "2026-06-12T00:00:00.000Z",
            competence: "2026-06",
            description: "Infra cloud june/2026",
            suggestedCategory: "Infraestrutura",
            finalCategory: "Infraestrutura",
            paymentMethod: "Boleto",
            bankData: { bank: "Itau" },
            notes: "Review pending",
            confidenceScore: 88,
            confidenceBand: "ALTA",
            status: "PENDENTE_REVISAO",
            evidence: ["Normalized event"],
            rawPayload: { provider: "active-actions-gateway" },
            rejectionReason: null,
            reviews: [],
          },
        ],
      },
    ],
    [
      "email-2",
      {
        id: "email-2",
        mailbox: "Receitas",
        sender: "receivables@globex.example",
        replyTo: null,
        toRecipients: ["receitas@initiare.com.br"],
        ccRecipients: null,
        bccRecipients: null,
        subject: "Globex receivable june",
        bodyText: "Receivable event payload attached.",
        bodyHtml: null,
        receivedAt: "2026-06-03T09:10:00.000Z",
        status: "PROCESSADO",
        processingError: null,
        attachments: [
          {
            id: "attachment-2",
            originalName: "globex-renewal.json",
            mimeType: "application/json",
            sizeBytes: 2048,
            status: "EXTRAIDO",
            processingError: null,
            extractedText: "{\"amount\":16200}",
            downloadPath: "/api/inbox/attachments/attachment-2/download",
          },
        ],
        extractionRuns: [],
        drafts: [],
      },
    ],
  ]);

  const publicChangelogItems = [
    {
      id: "entry-1",
      title: "Active Actions ingress with AI",
      description: "New AI event intake pipeline.",
      version: "0.9.0",
      category: "IA",
      status: "PUBLICADO",
      imageUrl: null,
      publishedAt: "2026-06-03T09:00:00.000Z",
      createdAt: "2026-06-03T09:00:00.000Z",
      author: { id: "user-1", name: "Admin User" },
      unread: true,
    },
  ];

  const adminChangelogItems = [
    {
      id: "entry-1",
      title: "Active Actions ingress with AI",
      description: "New AI event intake pipeline.",
      version: "0.9.0",
      category: "IA",
      status: "PUBLICADO",
      imageUrl: null,
      createdAt: "2026-06-03T09:00:00.000Z",
      updatedAt: "2026-06-03T09:00:00.000Z",
      publishedAt: "2026-06-03T09:00:00.000Z",
      authorId: "user-1",
      companyId: "company-1",
    },
  ];

  const asaasPayments = [
    {
      id: "charge-1",
      externalId: "asaas-1",
      customer: "Acme Industries",
      amount: 18400,
      netAmount: 17990,
      fee: 410,
      dueDate: "2026-06-28T00:00:00.000Z",
      paymentDate: "2026-06-29T00:00:00.000Z",
      status: "RECEIVED",
      billingType: "BOLETO",
      description: "Monthly billing",
      invoiceUrl: "https://example.test/invoice",
      source: "ASAAS sync",
      webhookStatus: "SUCCESS",
      webhookError: null,
    },
  ];

  return {
    token: TOKEN,
    user,
    activeCompany,
    memberships,
    legalEntities,
    mailboxes,
    drafts,
    draftDetails,
    payables,
    receivables,
    exceptions,
    operations,
    clients,
    suppliers,
    reconciliationItems,
    aiLogs,
    automations,
    flows,
    reports,
    inboxList,
    inboxDetails,
    publicChangelogItems,
    adminChangelogItems,
    asaasPayments,
  };
}

function createDashboardOverview(state: ReturnType<typeof createMockState>) {
  return {
    hero: {
      greetingName: "Admin",
      cycleLabel: "cycle #2.184",
      processedToday: state.operations.length,
      openExceptions: state.exceptions.filter((item) => item.status === "OPEN").length,
      uptime: 99.98,
      integrationsHealthy: 4,
      integrationsTotal: 4,
      latencyMs: 142,
    },
    stats: {
      autoReconciliationRate: 84,
      processedByAiAmount: 26420,
      openExceptions: state.exceptions.filter((item) => item.status === "OPEN").length,
      scheduledPayments: state.payables.length,
    },
    cashflow: [
      { month: "Jan", entrada: 100, saida: 80 },
      { month: "Fev", entrada: 120, saida: 90 },
      { month: "Mar", entrada: 128, saida: 86 },
      { month: "Abr", entrada: 140, saida: 94 },
      { month: "Mai", entrada: 138, saida: 92 },
      { month: "Jun", entrada: 148, saida: 96 },
    ],
    expensesByCategory: [
      { name: "Infraestrutura", value: 52 },
      { name: "Software", value: 32 },
      { name: "Folha", value: 16 },
    ],
    reconciliationDaily: [
      { day: "1", auto: 3, manual: 1 },
      { day: "2", auto: 4, manual: 1 },
      { day: "3", auto: 5, manual: 2 },
    ],
    aiActivity: [
      { t: "09:10", type: "ok", text: "Active Actions event normalized" },
      { t: "09:15", type: "warn", text: "Internal AI timeout raised exception" },
    ],
    timeline: [
      { label: "Tempo economizado (mes)", value: "284h" },
      { label: "Economia operacional", value: "R$ 42.800" },
      { label: "Precisao IA", value: "88%" },
      { label: "Operacoes no mes", value: "8.241" },
    ],
    omie: {
      exported: 1,
      success: 0,
      error: 0,
      blocked: 0,
      latest: [],
    },
    asaas: {
      charges: state.asaasPayments.length,
      paid: 1,
      overdue: 0,
      netReceived: 17990,
      fees: 410,
      webhookEvents: 1,
      integrationErrors: 0,
    },
  };
}

function createMonitoringSummary() {
  return {
    api: {
      uptimeSeconds: 3600,
      rssMb: 128,
      heapUsedMb: 64,
      latencyMs: 142,
    },
    application: {
      integrationsHealthy: 4,
      integrationsTotal: 4,
      aiUptime: 99.98,
    },
  };
}

function createAutomationSummary(state: ReturnType<typeof createMockState>) {
  const activeMailboxes = state.mailboxes.filter((item) => item.active);
  const latestSuccessfulSyncAt = activeMailboxes
    .map((item) => item.lastSyncAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return {
    stats: {
      totalEmails: state.drafts.length + 1,
      processed: 1,
      errorCount: 1,
      pendingReview: state.drafts.filter((item) => item.status === "PENDENTE_REVISAO").length,
      approved: state.drafts.filter((item) => item.status === "APROVADO").length,
      rejected: state.drafts.filter((item) => item.status === "REJEITADO").length,
      lowConfidence: state.drafts.filter((item) => item.confidenceBand === "BAIXA").length,
      volume: state.drafts.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    },
    runtime: {
      emailIngestEnabled: true,
      batchProcessingEnabled: true,
      autoSyncMailboxes: true,
      defaultEnvironment: "HOMOLOG" as const,
      maxEmailsPerRun: 10,
      batchIntervalMinutes: 15,
      totalMailboxes: state.mailboxes.length,
      activeMailboxes: activeMailboxes.length,
      unhealthyMailboxes: activeMailboxes.filter((item) => Boolean(item.lastError)).length,
      latestSuccessfulSyncAt,
    },
    latestEmails: state.drafts.map((item) => ({
      id: item.id,
      sender: item.source?.sender ?? item.source?.channel ?? "AI event",
      subject: item.source?.subject ?? item.partyName,
      status:
        item.status === "REJEITADO"
          ? "FAILED"
          : item.status === "PENDENTE_REVISAO"
            ? "RECEIVED"
            : "PROCESSED",
      receivedAt: item.source?.receivedAt ?? "2026-06-03T09:00:00.000Z",
    })),
    latestRuns: [
      {
        id: "run-1",
        runType: "active-actions-gateway",
        status: "COMPLETED",
        fetchedCount: 1,
        processedCount: 1,
        errorCount: 0,
        startedAt: "2026-06-03T09:00:00.000Z",
        finishedAt: "2026-06-03T09:00:04.000Z",
      },
      {
        id: "run-3",
        runType: "internal-ai",
        status: "FAILED",
        fetchedCount: 1,
        processedCount: 0,
        errorCount: 1,
        startedAt: "2026-06-03T09:15:00.000Z",
        finishedAt: "2026-06-03T09:15:30.000Z",
      },
    ],
  };
}

function createSettings(state: ReturnType<typeof createMockState>) {
  return {
    sections: [
      { id: "empresa", label: "Empresa", icon: "Building2" },
      { id: "usuarios", label: "Usuarios & Permissoes", icon: "Users" },
      { id: "integracoes", label: "Integracoes", icon: "Plug" },
      { id: "ia", label: "IA & Modelos", icon: "Brain" },
      { id: "automacao", label: "Automacao", icon: "Zap" },
      { id: "notificacoes", label: "Notificacoes", icon: "Bell" },
      { id: "seguranca", label: "Seguranca", icon: "Shield" },
    ],
    company: {
      name: state.activeCompany.name,
      domain: state.activeCompany.domain,
      companiesCount: 2,
      replyFromName: "Initiare Finance",
      replyFromEmail: "finance@initiare.com.br",
      replyToEmail: "reply@initiare.com.br",
    },
    integrations: [
      {
        id: "omie",
        name: "OMIE",
        status: "connected",
        desc: "2 connection(s) OMIE registered.",
      },
      {
        id: "asaas",
        name: "ASAAS",
        status: "connected",
        desc: "2 connection(s) ASAAS registered.",
      },
    ],
    ai: [
      { l: "Modelo padrao", v: "Configurado" },
      { l: "Threshold de autonomia", v: "Nao configurado", hint: "Define AI auto-approval threshold." },
      { l: "Modo agressivo", v: "Desativado", hint: "No aggressive automation active." },
      { l: "Automacoes registradas", v: String(state.automations.length) },
    ],
  };
}

function createOmieSettings() {
  return {
    provider: "OMIE" as const,
    environments: [
      {
        id: "omie-homolog-1",
        legalEntityId: "legal-1",
        legalEntityName: "Initiare",
        provider: "OMIE" as const,
        environment: "HOMOLOG" as const,
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: true,
        hasAppKey: true,
        hasAppSecret: true,
        lastSyncAt: "2026-06-10T10:00:00.000Z",
        lastHealthcheckAt: "2026-06-10T10:05:00.000Z",
        lastHealthcheckStatus: "HEALTHY" as const,
        lastError: null,
      },
      {
        id: "omie-prod-1",
        legalEntityId: "legal-1",
        legalEntityName: "Initiare",
        provider: "OMIE" as const,
        environment: "PRODUCTION" as const,
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: false,
        hasAppKey: true,
        hasAppSecret: true,
        lastSyncAt: null,
        lastHealthcheckAt: null,
        lastHealthcheckStatus: "UNKNOWN" as const,
        lastError: null,
      },
      {
        id: "omie-homolog-2",
        legalEntityId: "legal-2",
        legalEntityName: "Initiare Services",
        provider: "OMIE" as const,
        environment: "HOMOLOG" as const,
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: true,
        hasAppKey: true,
        hasAppSecret: true,
        lastSyncAt: "2026-06-10T09:00:00.000Z",
        lastHealthcheckAt: "2026-06-10T09:05:00.000Z",
        lastHealthcheckStatus: "HEALTHY" as const,
        lastError: null,
      },
      {
        id: "omie-prod-2",
        legalEntityId: "legal-2",
        legalEntityName: "Initiare Services",
        provider: "OMIE" as const,
        environment: "PRODUCTION" as const,
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: false,
        hasAppKey: false,
        hasAppSecret: false,
        lastSyncAt: null,
        lastHealthcheckAt: null,
        lastHealthcheckStatus: "ERROR" as const,
        lastError: "Production credentials missing",
      },
    ],
  };
}

function createAsaasSettings() {
  return {
    provider: "ASAAS" as const,
    environments: [
      {
        id: "asaas-sandbox-1",
        legalEntityId: "legal-1",
        legalEntityName: "Initiare",
        provider: "ASAAS" as const,
        environment: "SANDBOX" as const,
        baseUrl: "https://sandbox.asaas.com/api/v3",
        enabled: true,
        hasApiKey: true,
        hasWebhookToken: true,
        lastSyncAt: "2026-06-10T10:00:00.000Z",
        lastHealthcheckAt: "2026-06-10T10:05:00.000Z",
        lastHealthcheckStatus: "HEALTHY" as const,
        lastError: null,
      },
      {
        id: "asaas-prod-1",
        legalEntityId: "legal-1",
        legalEntityName: "Initiare",
        provider: "ASAAS" as const,
        environment: "PRODUCTION" as const,
        baseUrl: "https://www.asaas.com/api/v3",
        enabled: false,
        hasApiKey: false,
        hasWebhookToken: false,
        lastSyncAt: null,
        lastHealthcheckAt: null,
        lastHealthcheckStatus: "UNKNOWN" as const,
        lastError: null,
      },
      {
        id: "asaas-sandbox-2",
        legalEntityId: "legal-2",
        legalEntityName: "Initiare Services",
        provider: "ASAAS" as const,
        environment: "SANDBOX" as const,
        baseUrl: "https://sandbox.asaas.com/api/v3",
        enabled: true,
        hasApiKey: true,
        hasWebhookToken: true,
        lastSyncAt: "2026-06-10T09:00:00.000Z",
        lastHealthcheckAt: "2026-06-10T09:05:00.000Z",
        lastHealthcheckStatus: "HEALTHY" as const,
        lastError: null,
      },
      {
        id: "asaas-prod-2",
        legalEntityId: "legal-2",
        legalEntityName: "Initiare Services",
        provider: "ASAAS" as const,
        environment: "PRODUCTION" as const,
        baseUrl: "https://www.asaas.com/api/v3",
        enabled: false,
        hasApiKey: false,
        hasWebhookToken: false,
        lastSyncAt: null,
        lastHealthcheckAt: null,
        lastHealthcheckStatus: "ERROR" as const,
        lastError: "Webhook token missing",
      },
    ],
  };
}

function createAiOverview(state: ReturnType<typeof createMockState>) {
  return {
    health: { model: "configured", status: "active" },
    stats: {
      operationsToday: state.operations.length,
      accuracy: 92.1,
      monthlySavings: 42800,
      timeSavedHours: 284,
      activeAutomations: state.automations.filter((item) => item.status === "active").length,
      runningModels: 2,
    },
    performance: [
      { d: 1, acc: 88, ops: 12 },
      { d: 2, acc: 90, ops: 14 },
      { d: 3, acc: 92, ops: 16 },
      { d: 4, acc: 91, ops: 18 },
    ],
    automations: clone(state.automations),
  };
}

function createExecutiveOverview() {
  return {
    stats: {
      revenue: 184000,
      revenueDelta: "8%",
      ebitda: 73200,
      ebitdaDelta: "5%",
      expense: 96800,
      expenseDelta: "3%",
      delinquencyRate: "2.1%",
      delinquencyDelta: "-0.4pp",
    },
    cashflow: [
      { month: "Jan", entrada: 120, saida: 95 },
      { month: "Fev", entrada: 128, saida: 98 },
      { month: "Mar", entrada: 134, saida: 101 },
      { month: "Abr", entrada: 142, saida: 108 },
      { month: "Mai", entrada: 148, saida: 109 },
      { month: "Jun", entrada: 154, saida: 112 },
    ],
    dre: [
      { l: "Receita liquida", v: 184000, t: "in", bold: true, hl: false },
      { l: "Custos diretos", v: 64800, t: "out", bold: false, hl: false },
      { l: "EBITDA", v: 73200, t: "in", bold: true, hl: true },
    ],
    insights: [
      { c: "ai", t: "Revenue trend healthy", d: "Collections improved in the last 30 days." },
      { c: "warning", t: "Payables concentration", d: "Infra spend still concentrated in one supplier." },
    ],
  };
}

function createAdvancedOpsOverview() {
  return {
    summary: {
      dueContracts: 3,
      dueServiceOrders: 2,
      reconciliationCount: 4,
      approvedDrafts: 1,
      receivableVolume: 18400,
    },
    businessClients: [
      {
        id: "business-client-1",
        name: "Globex Enterprise",
        linkedClientId: "client-2",
        linkedClientName: "Globex Corp",
        allocationRule: {
          id: "rule-1",
          strategy: "MANUAL",
          legalEntityId: "legal-2",
        },
        legalEntities: [
          {
            id: "legal-2",
            legalName: "Initiare Servicos Ltda",
            tradeName: "Initiare Services",
            percentage: null,
            monthlyCap: null,
          },
        ],
      },
    ],
    legalEntities: [
      {
        id: "legal-1",
        legalName: "Initiare Tecnologia Ltda",
        tradeName: "Initiare",
        isDefault: true,
      },
      {
        id: "legal-2",
        legalName: "Initiare Servicos Ltda",
        tradeName: "Initiare Services",
        isDefault: false,
      },
    ],
    latestDrafts: [
      {
        id: "draft-2",
        partyName: "Globex Corp",
        status: "PENDENTE_REVISAO",
        sourceLabel: "OMIE contract",
        createdAt: "2026-06-03T09:10:00.000Z",
      },
    ],
  };
}

function createPortalOverview() {
  return {
    businessClient: {
      id: "business-client-1",
      name: "Globex Enterprise",
    },
    client: {
      id: "client-2",
      name: "Globex Corp",
    },
    stats: {
      totalReceivables: 1,
      totalVolume: 18400,
    },
    items: [
      {
        id: "receivable-1",
        amount: 18400,
        dueDate: "2026-06-28T00:00:00.000Z",
        status: "Em revisão",
        source: "AI Gateway",
        channel: "Boleto",
      },
    ],
  };
}

export async function installApiMocks(page: Page) {
  const state = createMockState();
  const unhandledPaths = new Set<string>();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");

    if (path === "/auth/login" && request.method() === "POST") {
      return json(route, {
        token: state.token,
        user: state.user,
        activeCompany: state.activeCompany,
        memberships: state.memberships,
      });
    }

    if (path === "/auth/me" && request.method() === "GET") {
      const auth = request.headers().authorization;
      if (auth === `Bearer ${state.token}`) {
        return json(route, {
          user: state.user,
          activeCompany: state.activeCompany,
          memberships: state.memberships,
        });
      }
      return json(route, { message: "Unauthorized" }, 401);
    }

    if (path === "/auth/switch-company" && request.method() === "POST") {
      return json(route, {
        token: state.token,
        user: state.user,
        activeCompany: state.activeCompany,
        memberships: state.memberships,
      });
    }

    if (path === "/monitoring/summary") {
      return json(route, createMonitoringSummary());
    }

    if (path === "/dashboard/overview") {
      return json(route, createDashboardOverview(state));
    }

    if (path === "/automation/summary") {
      return json(route, createAutomationSummary(state));
    }

    if (path === "/operations") {
      return json(route, {
        stats: {
          total: state.operations.length,
          processedByAi: 1,
          inReview: 1,
          exceptions: state.exceptions.filter((item) => item.status === "OPEN").length,
        },
        items: state.operations,
      });
    }

    if (path.startsWith("/financial-drafts") && request.method() === "GET") {
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 1) {
        const status = url.searchParams.get("status");
        const direction = url.searchParams.get("direction");
        let items = state.drafts;
        if (status) {
          items = items.filter((item) => item.status === status);
        }
        if (direction) {
          items = items.filter((item) => item.direction === direction);
        }
        return json(route, { items });
      }

      const draftId = parts[1];
      return json(route, state.draftDetails.get(draftId));
    }

    if (path.startsWith("/financial-drafts/") && request.method() === "PATCH") {
      const draftId = path.split("/")[2];
      const payload = request.postDataJSON() as Record<string, unknown>;
      const draft = state.drafts.find((item) => item.id === draftId);
      const detail = state.draftDetails.get(draftId);
      if (draft) {
        Object.assign(draft, payload);
      }
      if (detail) {
        Object.assign(detail, payload);
      }
      return json(route, { id: draftId, status: "PENDENTE_REVISAO" });
    }

    if (path.endsWith("/approve") && request.method() === "POST") {
      const draftId = path.split("/")[2];
      const draft = state.drafts.find((item) => item.id === draftId);
      const detail = state.draftDetails.get(draftId);
      if (draft) {
        draft.status = "APROVADO";
        draft.review.workflowStatus = "approved";
      }
      if (detail) {
        detail.status = "APROVADO";
        (detail.review as DraftListItem["review"]).workflowStatus = "approved";
      }
      if (!state.payables.find((item) => item.id === "payable-cloudplus") && draftId === "draft-1") {
        state.payables.push({
          id: "payable-cloudplus",
          fornecedor: "CloudPlus Infra",
          valor: 5420.75,
          vencimento: "2026-06-12T00:00:00.000Z",
          categoria: "Infraestrutura",
          status: "Em revisão",
          confianca: 0.88,
        });
      }
      return json(route, { id: draftId, status: "APROVADO" });
    }

    if (path.endsWith("/reject") && request.method() === "POST") {
      const draftId = path.split("/")[2];
      const payload = request.postDataJSON() as { reason: string };
      const draft = state.drafts.find((item) => item.id === draftId);
      const detail = state.draftDetails.get(draftId);
      if (draft) {
        draft.status = "REJEITADO";
        draft.review.workflowStatus = "rejected";
      }
      if (detail) {
        detail.status = "REJEITADO";
        detail.rejectionReason = payload.reason;
        (detail.review as DraftListItem["review"]).workflowStatus = "rejected";
      }
      return json(route, { id: draftId, status: "REJEITADO" });
    }

    if (
      (path.endsWith("/retry-execution") || path.endsWith("/mark-duplicate") || path.endsWith("/undo-duplicate") || path.endsWith("/request-reprocess")) &&
      request.method() === "POST"
    ) {
      return json(route, { ok: true });
    }

    if (path === "/accounts-payable") {
      const total = state.payables.reduce((sum, item) => sum + Number(item.valor), 0);
      return json(route, {
        stats: {
          total: `R$ ${total.toLocaleString("pt-BR")}`,
          dueIn7Days: `R$ ${total.toLocaleString("pt-BR")}`,
          scheduledByAi: state.payables.length,
          overdue: 0,
        },
        items: state.payables,
      });
    }

    if (path === "/accounts-receivable") {
      return json(route, {
        stats: {
          total: "R$ 18.400,00",
          dueIn7Days: "R$ 18.400,00",
          delinquencyRate: "2.1%",
          receivedMonth: "R$ 18.400,00",
        },
        items: state.receivables,
      });
    }

    if (path === "/asaas/payments") {
      return json(route, {
        stats: {
          charges: state.asaasPayments.length,
          paid: 1,
          overdue: 0,
          netReceived: 17990,
          fees: 410,
          webhookEvents: 1,
          integrationErrors: 0,
        },
        items: state.asaasPayments,
        latestWebhook: {
          id: "webhook-1",
          eventType: "PAYMENT_RECEIVED",
          status: "SUCCESS",
          errorMessage: null,
          createdAt: "2026-06-10T10:00:00.000Z",
        },
      });
    }

    if (path === "/clients") {
      return json(route, { items: state.clients });
    }

    if (path === "/suppliers") {
      return json(route, { items: state.suppliers });
    }

    if (path === "/reconciliation") {
      return json(route, {
        stats: {
          reconciledRate: "84%",
          reconciledCount: 1,
          pending: 0,
          divergent: 1,
        },
        items: state.reconciliationItems,
      });
    }

    if (path === "/exceptions") {
      return json(route, {
        summary: { open: state.exceptions.filter((item) => item.status === "OPEN").length },
        items: state.exceptions,
      });
    }

    if (path.startsWith("/exceptions/") && request.method() === "PATCH") {
      const exceptionId = path.split("/")[2];
      const payload = request.postDataJSON() as { status: string };
      const item = state.exceptions.find((entry) => entry.id === exceptionId);
      if (item) {
        item.status = payload.status;
      }
      return json(route, { status: payload.status });
    }

    if (path === "/ai/logs") {
      return json(route, { items: state.aiLogs });
    }

    if (path === "/automations") {
      return json(route, { items: state.automations });
    }

    if (path.startsWith("/automations/") && request.method() === "PATCH") {
      const automationId = path.split("/")[2];
      const payload = request.postDataJSON() as { status: "ACTIVE" | "PAUSED" };
      const item = state.automations.find((automation) => automation.id === automationId);
      if (item) {
        item.status = payload.status === "ACTIVE" ? "active" : "paused";
      }
      return json(route, { id: automationId, status: item?.status ?? "paused" });
    }

    if (path === "/flows") {
      return json(route, { items: state.flows });
    }

    if (path === "/reports") {
      return json(route, { items: state.reports });
    }

    if (path === "/settings") {
      return json(route, createSettings(state));
    }

    if (path === "/settings/integrations/omie") {
      return json(route, createOmieSettings());
    }

    if (path === "/settings/integrations/asaas") {
      return json(route, createAsaasSettings());
    }

    if (path === "/settings/legal-entities") {
      return json(route, { items: state.legalEntities });
    }

    if (
      (path.startsWith("/settings/integrations/omie/") || path.startsWith("/settings/integrations/asaas/")) &&
      (request.method() === "PUT" || request.method() === "POST")
    ) {
      return json(route, { ok: true });
    }

    if (path.startsWith("/settings/legal-entities") && (request.method() === "POST" || request.method() === "PATCH" || request.method() === "DELETE")) {
      return json(route, { ok: true });
    }

    if (path === "/settings/company" && request.method() === "PATCH") {
      const payload = request.postDataJSON() as Record<string, string | null>;
      return json(route, {
        company: {
          id: state.activeCompany.id,
          name: payload.name ?? state.activeCompany.name,
          domain: payload.domain ?? state.activeCompany.domain,
          companiesCount: 2,
          replyFromName: payload.replyFromName ?? "Initiare Finance",
          replyFromEmail: payload.replyFromEmail ?? "finance@initiare.com.br",
          replyToEmail: payload.replyToEmail ?? "reply@initiare.com.br",
        },
      });
    }

    if (path === "/mailboxes") {
      if (request.method() === "GET") {
        return json(route, { items: state.mailboxes });
      }
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const mailbox = {
          id: `mailbox-${state.mailboxes.length + 1}`,
          name: String(payload.name ?? "Mailbox"),
          host: String(payload.host ?? "imap.gmail.com"),
          port: Number(payload.port ?? 993),
          tls: Boolean(payload.tls ?? true),
          username: String(payload.username ?? "mailbox@example.com"),
          legalEntityId: payload.legalEntityId ? String(payload.legalEntityId) : null,
          fromFilter: payload.fromFilter ? String(payload.fromFilter) : null,
          active: Boolean(payload.active ?? true),
          lastSyncAt: null,
          lastError: null,
          createdAt: "2026-06-10T12:00:00.000Z",
        };
        state.mailboxes.unshift(mailbox);
        return json(route, mailbox);
      }
    }

    if (path.startsWith("/mailboxes/") && request.method() === "POST") {
      const mailboxId = path.split("/")[2];
      return json(route, { ok: true, mailboxId, fetchedCount: 1, processedCount: 1, errorCount: 0 });
    }

    if (path.startsWith("/inbox/emails") && request.method() === "GET") {
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 2) {
        const status = url.searchParams.get("status");
        const confidenceBand = url.searchParams.get("confidenceBand");
        let items = state.inboxList;
        if (status) {
          items = items.filter((item) => item.status === status);
        }
        if (confidenceBand) {
          items = items.filter((item) => item.draft?.confidenceBand === confidenceBand);
        }
        return json(route, { items });
      }

      const emailId = parts[2];
      return json(route, state.inboxDetails.get(emailId));
    }

    if (path === "/inbox/attachments/attachment-1/download") {
      return binary(route, Buffer.from("pdf-content"), "application/pdf");
    }

    if (path === "/inbox/attachments/attachment-2/download") {
      return binary(route, Buffer.from("{\"amount\":16200}"), "application/json");
    }

    if (path === "/changelog") {
      return json(route, { items: state.publicChangelogItems });
    }

    if (path === "/admin/changelog") {
      return json(route, { items: state.adminChangelogItems });
    }

    if (path.startsWith("/changelog/") && path.endsWith("/mark-seen") && request.method() === "POST") {
      const entryId = path.split("/")[2];
      const item = state.publicChangelogItems.find((entry) => entry.id === entryId);
      if (item) {
        item.unread = false;
      }
      return json(route, { id: entryId, readAt: "2026-06-10T12:00:00.000Z" });
    }

    if (path === "/admin/changelog" && request.method() === "POST") {
      return json(route, { id: "entry-2" });
    }

    if (path.startsWith("/admin/changelog/") && request.method() === "PATCH") {
      return json(route, { ok: true });
    }

    if (path.startsWith("/admin/changelog/") && path.endsWith("/publish") && request.method() === "POST") {
      return json(route, { ok: true });
    }

    if (path === "/ai/overview") {
      return json(route, createAiOverview(state));
    }

    if (path === "/executive/overview") {
      return json(route, createExecutiveOverview());
    }

    if (path === "/advanced-ops/overview") {
      return json(route, createAdvancedOpsOverview());
    }

    if (
      (path === "/advanced-ops/contracts/generate-drafts" ||
        path === "/advanced-ops/business-clients" ||
        path.includes("/advanced-ops/business-clients/") ||
        path === "/advanced-ops/service-orders/generate-drafts" ||
        path === "/advanced-ops/reconciliation/create-draft") &&
      request.method() !== "GET"
    ) {
      return json(route, { ok: true });
    }

    if (path === "/advanced-ops/portal/access-token" && request.method() === "POST") {
      return json(route, { token: "portal-token-1" });
    }

    if (path === "/portal/overview") {
      return json(route, createPortalOverview());
    }

    unhandledPaths.add(`${request.method()} ${path}`);
    return json(route, { message: `Unhandled mock path: ${path}` }, 404);
  });

  return {
    authenticate: async () => {
      await page.addInitScript(
        ({ key, value }) => {
          window.localStorage.setItem(key, value);
        },
        { key: TOKEN_KEY, value: state.token },
      );
    },
    login: async () => {
      await page.goto("/login");
      await page.getByTestId("login-email").fill("admin@veridia.local");
      await page.getByTestId("login-password").fill("ChangeMe123!");
      await page.getByTestId("login-submit").click();
      await page.waitForURL("**/");
    },
    assertNoUnhandled: () => {
      expect([...unhandledPaths]).toEqual([]);
    },
  };
}

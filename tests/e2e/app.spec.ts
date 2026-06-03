import { expect, test, type Page, type Route } from "@playwright/test";

type DraftListItem = {
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
  email: null;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installApiMocks(page: Page) {
  const token = "test-token";
  const user = {
    id: "user-1",
    name: "Admin User",
    email: "admin@veridia.local",
    role: "ADMIN",
  };
  const company = {
    id: "company-1",
    name: "Initiare ERP",
    domain: "localhost",
  };

  const drafts: DraftListItem[] = [
    {
      id: "draft-1",
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus Infra",
      cpfCnpj: "11.222.333/0001-44",
      amount: 5420.75,
      dueDate: "2026-06-12T00:00:00.000Z",
      description: "Infraestrutura cloud junho/2026",
      suggestedCategory: "Infraestrutura",
      finalCategory: "Infraestrutura",
      paymentMethod: "Boleto",
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
    },
    {
      id: "draft-2",
      direction: "CONTA_RECEBER",
      partyName: "Globex Corp",
      cpfCnpj: null,
      amount: 16200,
      dueDate: "2026-06-18T00:00:00.000Z",
      description: "Renovacao mensal Globex junho/2026",
      suggestedCategory: "Receita recorrente",
      finalCategory: "Receita recorrente",
      paymentMethod: "PIX",
      confidenceScore: 61,
      confidenceBand: "MEDIA",
      status: "PENDENTE_REVISAO",
      source: {
        id: "event-2",
        originType: "ACTIVE_ACTIONS",
        channel: "webhook",
        sender: "receivables@acme.example",
        subject: "Acme cobranca junho",
        summary: "Receivable event for Globex renewal due on 2026-06-18.",
        receivedAt: "2026-06-03T09:10:00.000Z",
      },
      email: null,
    },
  ];

  const draftDetails = new Map<string, Record<string, unknown>>([
    [
      "draft-1",
      {
        ...drafts[0],
        competence: "2026-06",
        bankData: { bank: "Itau" },
        notes: "Novo evento aguardando aprovacao.",
        evidence: ["Evento normalizado", "Fornecedor recorrente"],
        rawPayload: { provider: "active-actions-gateway" },
        rejectionReason: null,
        source: {
          ...drafts[0].source,
          attachments: [{ filename: "cloudplus-junho-2026.pdf", mimeType: "application/pdf" }],
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
        sourceEmail: null,
        reviews: [],
      },
    ],
    [
      "draft-2",
      {
        ...drafts[1],
        competence: "2026-06",
        bankData: null,
        notes: "Usar este draft para fluxo de rejeicao no E2E.",
        evidence: ["Cliente recorrente", "Valor dentro do esperado"],
        rawPayload: { provider: "active-actions-gateway" },
        rejectionReason: null,
        source: {
          ...drafts[1].source,
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
      status: "Em revisao",
      origem: "AI Gateway",
      canal: "Boleto",
    },
  ];

  const exceptions = [
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

  function dashboardOverview() {
    return {
      hero: {
        greetingName: "Admin",
        cycleLabel: "cycle #2.184",
        processedToday: 4,
        openExceptions: exceptions.filter((item) => item.status === "OPEN").length,
        uptime: 99.98,
        integrationsHealthy: 8,
        integrationsTotal: 8,
        latencyMs: 142,
      },
      stats: {
        autoReconciliationRate: 84,
        processedByAiAmount: 26420,
        openExceptions: exceptions.filter((item) => item.status === "OPEN").length,
        scheduledPayments: payables.length,
      },
      cashflow: [
        { month: "Jan", entrada: 100, saida: 80 },
        { month: "Fev", entrada: 120, saida: 90 },
      ],
      expensesByCategory: [
        { name: "Infraestrutura", value: 52 },
        { name: "Software", value: 48 },
      ],
      reconciliationDaily: [
        { day: "1", auto: 3, manual: 1 },
        { day: "2", auto: 4, manual: 1 },
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
    };
  }

  function automationSummary() {
    return {
      stats: {
        totalEmails: drafts.length + 1,
        processed: drafts.filter((item) => item.status !== "PENDENTE_REVISAO").length + 1,
        errorCount: 1,
        pendingReview: drafts.filter((item) => item.status === "PENDENTE_REVISAO").length,
        approved: drafts.filter((item) => item.status === "APROVADO").length,
        rejected: drafts.filter((item) => item.status === "REJEITADO").length,
        lowConfidence: drafts.filter((item) => item.confidenceBand === "BAIXA").length,
        volume: drafts.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
      },
      latestEmails: drafts.map((item) => ({
        id: item.id,
        sender: item.source?.sender ?? item.source?.channel ?? "AI event",
        subject: item.source?.subject ?? item.partyName,
        status: item.status === "REJEITADO" ? "FAILED" : item.status === "PENDENTE_REVISAO" ? "RECEIVED" : "PROCESSED",
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

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");

    if (path === "/auth/login" && request.method() === "POST") {
      return json(route, { token, user, company });
    }

    if (path === "/auth/me" && request.method() === "GET") {
      const auth = request.headers()["authorization"];
      if (auth === `Bearer ${token}`) {
        return json(route, { user, company });
      }
      return json(route, { message: "Unauthorized" }, 401);
    }

    if (path === "/dashboard/overview") {
      return json(route, dashboardOverview());
    }

    if (path === "/automation/summary") {
      return json(route, automationSummary());
    }

    if (path.startsWith("/financial-drafts") && request.method() === "GET") {
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 1) {
        return json(route, { items: drafts });
      }

      const draftId = parts[1];
      return json(route, draftDetails.get(draftId));
    }

    if (path.startsWith("/financial-drafts/") && request.method() === "PATCH") {
      const draftId = path.split("/")[2];
      const payload = request.postDataJSON() as Record<string, unknown>;
      const detail = draftDetails.get(draftId);
      if (detail) {
        Object.assign(detail, payload);
      }
      return json(route, { id: draftId, status: "PENDENTE_REVISAO" });
    }

    if (path.endsWith("/approve") && request.method() === "POST") {
      const draftId = path.split("/")[2];
      const draft = drafts.find((item) => item.id === draftId);
      const detail = draftDetails.get(draftId);
      if (draft) {
        draft.status = "APROVADO";
      }
      if (detail) {
        detail.status = "APROVADO";
      }
      if (!payables.find((item) => item.id === "payable-cloudplus") && draftId === "draft-1") {
        payables.push({
          id: "payable-cloudplus",
          fornecedor: "CloudPlus Infra",
          valor: 5420.75,
          vencimento: "2026-06-12T00:00:00.000Z",
          categoria: "Infraestrutura",
          status: "Em revisao",
          confianca: 0.88,
        });
      }
      return json(route, { id: draftId, status: "APROVADO" });
    }

    if (path.endsWith("/reject") && request.method() === "POST") {
      const draftId = path.split("/")[2];
      const draft = drafts.find((item) => item.id === draftId);
      const detail = draftDetails.get(draftId);
      const payload = request.postDataJSON() as { reason: string };
      if (draft) {
        draft.status = "REJEITADO";
      }
      if (detail) {
        detail.status = "REJEITADO";
        detail.rejectionReason = payload.reason;
      }
      return json(route, { id: draftId, status: "REJEITADO" });
    }

    if (path === "/accounts-payable") {
      const total = payables.reduce((sum, item) => sum + Number(item.valor), 0);
      return json(route, {
        stats: {
          total: `R$ ${total.toLocaleString("pt-BR")}`,
          dueIn7Days: `R$ ${total.toLocaleString("pt-BR")}`,
          scheduledByAi: payables.length,
          overdue: 0,
        },
        items: payables,
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
        items: receivables,
      });
    }

    if (path === "/exceptions") {
      return json(route, {
        summary: { open: exceptions.filter((item) => item.status === "OPEN").length },
        items: exceptions,
      });
    }

    if (path.startsWith("/exceptions/") && request.method() === "PATCH") {
      const exceptionId = path.split("/")[2];
      const payload = request.postDataJSON() as { status: string };
      const item = exceptions.find((entry) => entry.id === exceptionId);
      if (item) {
        item.status = payload.status;
      }
      return json(route, { status: payload.status });
    }

    if (path === "/changelog") {
      return json(route, {
        items: [
          {
            id: "entry-1",
            title: "Active Actions ingress com IA",
            description: "Nova trilha de ingestao por AI events.",
            version: "0.9.0",
            category: "IA",
            status: "PUBLICADO",
            imageUrl: null,
            publishedAt: "2026-06-03T09:00:00.000Z",
            createdAt: "2026-06-03T09:00:00.000Z",
            author: { id: "user-1", name: "Admin User" },
            unread: true,
          },
        ],
      });
    }

    if (path === "/admin/changelog") {
      return json(route, {
        items: [
          {
            id: "entry-1",
            title: "Active Actions ingress com IA",
            description: "Nova trilha de ingestao por AI events.",
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
        ],
      });
    }

    return json(route, { message: `Unhandled mock path: ${path}` }, 404);
  });
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("login, dashboard, validation, finance pages, exceptions, and changelog work", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("admin@veridia.local");
  await page.getByTestId("login-password").fill("ChangeMe123!");
  await page.getByTestId("login-submit").click();

  await page.waitForURL("**/");
  await expect(page.getByText("Eventos totais")).toBeVisible();
  await expect(page.getByText("Abrir inbox")).toHaveCount(0);

  await page.goto("/validacao-financeira");
  await page.getByTestId("draft-list-item-draft-1").click();
  await page.getByTestId("draft-approve-button").click();

  await page.goto("/contas-a-pagar");
  await expect(page.getByText("CloudPlus Infra")).toBeVisible();

  await page.goto("/validacao-financeira");
  await page.getByTestId("draft-list-item-draft-2").click();
  await page.getByPlaceholder("Motivo de rejeicao, ou nota de aprovacao.").fill("Need manual follow-up");
  await page.getByTestId("draft-reject-button").click();
  await expect(page.getByText("Excecao").first()).toBeVisible();

  await page.goto("/contas-a-receber");
  await expect(page.getByText("Acme Industries")).toBeVisible();

  await page.goto("/excecoes");
  await expect(page.getByText("AI failure on manual review for Draft CloudPlus Infra").first()).toBeVisible();
  await page.getByTestId("exception-detail-approve").click();

  await page.goto("/novidades");
  await expect(page.getByText("Active Actions ingress com IA")).toBeVisible();
});

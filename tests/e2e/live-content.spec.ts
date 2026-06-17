import { expect, test, type Page } from "@playwright/test";
import { loginByApi } from "./support/live-auth";

async function openAuthenticated(page: Page, path: string) {
  await loginByApi(page);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Algo deu errado")).toHaveCount(0);
  await expect(page.getByText("Pagina nao encontrada")).toHaveCount(0);
}

async function restorePrimaryDraftReady(page: Page) {
  const token = await page.evaluate(() => window.localStorage.getItem("veridia.access-token"));
  expect(token).toBeTruthy();

  const draftsResponse = await page.request.get("http://127.0.0.1:4010/api/financial-drafts?limit=50", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  expect(draftsResponse.ok()).toBeTruthy();
  const draftsPayload = (await draftsResponse.json()) as {
    items: Array<{ id: string; direction: string; partyName: string }>;
  };
  const draftId = draftsPayload.items.find((item) => item.direction === "CONTA_PAGAR")?.id;
  expect(draftId).toBeTruthy();

  const response = await page.request.patch(`http://127.0.0.1:4010/api/financial-drafts/${draftId}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    data: {
      partyName: "CloudPlus Infra",
      cpfCnpj: "11.222.333/0001-44",
      amount: 5420.75,
      dueDate: "2026-06-12",
      competence: "2026-06",
      description: "Infra cloud june/2026",
      suggestedCategory: "Infraestrutura",
      finalCategory: "Infraestrutura",
      paymentMethod: "Boleto",
      notes: "New event awaiting approval.",
    },
  });

  expect(response.ok()).toBeTruthy();
  await page.reload();
  await page.waitForLoadState("networkidle");
}

test("live dashboard shows seeded notification entry points", async ({ page }) => {
  await openAuthenticated(page, "/");

  await expect(page.getByRole("heading", { name: /Bom dia,/ })).toBeVisible();
  await expect(page.getByText("2/2 integracoes")).toBeVisible();
  await expect(page.getByTestId("topbar-notifications-badge")).toHaveText(/\d+/);
  await expect(page.getByTestId("sidebar-notifications-badge")).toHaveText(/\d+/);
  await expect(page.getByRole("link", { name: "Abrir central de novidades" })).toBeVisible();
  await expect(page.getByTestId("dashboard-automation-runtime")).toContainText("Ingestao");
});

test("live validacao financeira shows seeded draft without external execution", async ({ page }) => {
  await openAuthenticated(page, "/validacao-financeira");
  await restorePrimaryDraftReady(page);

  await expect(page.locator('[data-testid^="draft-list-item-"]')).toHaveCount(1);
  await expect(page.getByText("CloudPlus Infra").first()).toBeVisible();
  await expect(page.getByText("CloudPlus invoice June 2026").first()).toBeVisible();
  await expect(page.getByText("Status atual: Sem execucao")).toBeVisible();
  await expect(page.getByTestId("draft-approval-gate")).toContainText("Pronto para aprovacao");
  await expect(page.getByTestId("draft-approval-gate")).toContainText("Nao enviado");
  await expect(page.getByTestId("draft-approve-button")).toBeVisible();
  await expect(page.getByTestId("draft-reject-button")).toBeVisible();
});

test("live draft approval gate reflects local blockers before any external send", async ({ page }) => {
  await openAuthenticated(page, "/validacao-financeira");
  await restorePrimaryDraftReady(page);

  await expect(page.getByTestId("draft-approval-gate")).toContainText("Pronto para aprovacao");
  await page.locator('input[type="date"]').first().fill("");
  await page.getByTestId("draft-save-button").click();

  await expect(page.getByTestId("draft-approval-gate")).toContainText("Bloqueado");
  await expect(page.getByTestId("draft-approval-gate")).toContainText("Nao enviado");
  await expect(page.getByText("Vencimento e obrigatorio antes da aprovacao.").last()).toBeVisible();
  await expect(page.getByTestId("draft-approve-button")).toBeDisabled();
});

test("live cadastros pages show seeded clients and suppliers", async ({ page }) => {
  await openAuthenticated(page, "/clientes");

  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("Acme Industries")).toBeVisible();
  await expect(page.getByText("Globex Corp")).toBeVisible();
  await expect(page.getByText("Industria")).toBeVisible();
  await expect(page.getByText("Tecnologia")).toBeVisible();

  await page.goto("/fornecedores");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("CloudPlus Infra")).toBeVisible();
  await expect(page.getByText("PeopleOps Payroll")).toBeVisible();
  await expect(page.getByText("Infraestrutura")).toBeVisible();
  await expect(page.getByText("Folha")).toBeVisible();
});

test("live front-end numeric consistency matches seeded financial totals", async ({ page }) => {
  await openAuthenticated(page, "/");
  await restorePrimaryDraftReady(page);

  await page.goto("/validacao-financeira");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("CloudPlus Infra").first()).toBeVisible();

  await page.goto("/inbox-financeiro");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("CloudPlus invoice June 2026").first()).toBeVisible();

  await page.goto("/contas-a-pagar");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/5\.420,75/).first()).toBeVisible();
  await expect(page.getByText("CloudPlus Infra").first()).toBeVisible();

  await page.goto("/contas-a-receber");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/18\.400/).first()).toBeVisible();
  await expect(page.getByText("Acme Industries").first()).toBeVisible();
  await expect(page.getByText(/17\.990/).first()).toBeVisible();
  await expect(page.getByText(/410/).first()).toBeVisible();
});

test("live financeiro pages show seeded payables, receivables, and ASAAS sync", async ({ page }) => {
  await openAuthenticated(page, "/contas-a-pagar");

  await expect(page.locator("tbody tr")).toHaveCount(1);
  const payablesRow = page.locator("tbody tr").first();
  await expect(payablesRow.getByText("CloudPlus Infra")).toBeVisible();
  await expect(payablesRow.getByText("R$ 5.420,75")).toBeVisible();
  await expect(page.getByText("Programado IA")).toBeVisible();

  await page.goto("/contas-a-receber");
  await page.waitForLoadState("networkidle");

  const receivablesRow = page.locator("tbody").first().locator("tr").first();
  await expect(page.locator("tbody").first().locator("tr")).toHaveCount(1);
  await expect(receivablesRow.getByText("Acme Industries")).toBeVisible();
  await expect(receivablesRow.getByText("AI Gateway")).toBeVisible();
  await expect(page.locator("div").filter({ hasText: /^ASAAS$/ })).toBeVisible();
  await expect(page.getByText("asaas-1")).toBeVisible();
});

test("live notification bell opens novidades and unread state can be cleared", async ({ page }) => {
  await openAuthenticated(page, "/");

  const token = await page.evaluate(() => window.localStorage.getItem("veridia.access-token"));
  expect(token).toBeTruthy();
  const title = `Bell Notification ${Date.now()}`;
  await page.request.post("http://127.0.0.1:4010/api/admin/changelog", {
    headers: {
      authorization: `Bearer ${token}`,
    },
    data: {
      title,
      description: "Notification created during bell flow test.",
      version: `0.9.${Date.now()}`,
      category: "MELHORIA",
      status: "PUBLICADO",
      imageUrl: null,
    },
  });

  await page.reload();
  await page.waitForLoadState("networkidle");

  await page.getByTestId("topbar-notifications-link").click();
  await page.waitForURL("**/novidades");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Central de Novidades" })).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByTestId("topbar-notifications-badge")).toHaveText(/\d+/);
  await expect(page.getByTestId("sidebar-notifications-badge")).toHaveText(/\d+/);

  const targetButton = page
    .getByRole("heading", { name: title })
    .locator('xpath=ancestor::*[self::div][contains(@class,"p-5")][1]//button[normalize-space()="Marcar lido"]');
  await targetButton.click();

  const changelogResponse = await page.request.get("http://127.0.0.1:4010/api/changelog", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  expect(changelogResponse.ok()).toBeTruthy();
  const changelogPayload = (await changelogResponse.json()) as {
    items: Array<{ title: string; unread: boolean }>;
  };
  const targetItem = changelogPayload.items.find((item) => item.title === title);
  expect(targetItem?.unread).toBeFalsy();
});

test("live integrations hub supports multi-mailbox management", async ({ page }) => {
  await openAuthenticated(page, "/configuracoes");

  await expect(page.getByText("Mailboxes", { exact: true })).toBeVisible();
  await expect(page.getByText("OMIE conexoes")).toBeVisible();
  await expect(page.getByText("ASAAS conexoes")).toBeVisible();
  await expect(page.getByText("OMIE Homologacao")).toBeVisible();
  await expect(page.getByText("ASAAS Sandbox")).toBeVisible();
  await expect(page.getByText("Financeiro", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar mailbox" }).click();
  await expect(page.getByRole("heading", { name: "Novo mailbox" })).toBeVisible();

  const uniqueMailbox = `QA Inbox ${Date.now()}`;
  await page.getByTestId("settings-mailbox-name").fill(uniqueMailbox);
  await page.getByPlaceholder("Usuario IMAP").fill("qa.integration@initiare.com.br");
  await page.getByPlaceholder("App password").fill("ChangeMe123!");
  await page.getByPlaceholder("Filtro remetente opcional").fill("finance@vendor.test");
  await page.getByTestId("settings-mailbox-submit").click();

  await expect(page.getByTestId("settings-feedback")).toHaveText("Mailbox created.");
  await expect(page.getByText(uniqueMailbox)).toBeVisible();
});

test("live notifications settings show unread state and can clear it", async ({ page }) => {
  await openAuthenticated(page, "/configuracoes");

  const token = await page.evaluate(() => window.localStorage.getItem("veridia.access-token"));
  expect(token).toBeTruthy();

  const version = `0.9.${Date.now()}`;
  await page.request.post("http://127.0.0.1:4010/api/admin/changelog", {
    headers: {
      authorization: `Bearer ${token}`,
    },
    data: {
      title: `QA Notification ${Date.now()}`,
      description: "Notification created during live settings test.",
      version,
      category: "MELHORIA",
      status: "PUBLICADO",
      imageUrl: null,
    },
  });

  await page.reload();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Notificacoes" }).click();
  await expect(page.getByText("Centro de notificacoes")).toBeVisible();
  await expect(page.getByText("QA Notification", { exact: false })).toBeVisible();
  await expect(page.getByTestId("topbar-notifications-badge")).toHaveText(/\d+/);

  await page.getByTestId("settings-notifications-mark-all").click();

  await expect(page.getByTestId("settings-feedback")).toHaveText("All notifications marked as read.");
  await expect(page.getByTestId("topbar-notifications-badge")).toHaveCount(0);
  await expect(page.locator("span").filter({ hasText: /^Lido$/ }).first()).toBeVisible();
});

test("live automation settings persist local runtime preferences", async ({ page }) => {
  await openAuthenticated(page, "/configuracoes");

  await page.getByRole("button", { name: "Automacao" }).click();
  await expect(page.getByText("Runtime da automacao")).toBeVisible();

  const emailToggle = page.getByTestId("settings-automation-email-ingest");
  await emailToggle.uncheck();
  await page.getByTestId("settings-automation-max-emails").fill("7");
  await page.getByTestId("settings-automation-save").click();

  await expect(page.getByTestId("settings-feedback")).toHaveText("Automation settings saved.");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Automacao" }).click();

  await expect(page.getByTestId("settings-automation-max-emails")).toHaveValue("7");
  await expect(emailToggle).not.toBeChecked();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("dashboard-automation-runtime")).toContainText("Desligada");
  await expect(page.getByTestId("dashboard-automation-runtime")).toContainText("Lote 7");

  await page.goto("/inbox-financeiro");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("inbox-automation-runtime")).toContainText("Desligada");
  await expect(page.getByTestId("inbox-automation-runtime")).toContainText("Ligado");
  await expect(page.getByTestId("inbox-automation-runtime")).toContainText("Lote");
  await expect(page.getByText("Limite 7 por ciclo", { exact: false })).toBeVisible();
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginByApi } from "./support/live-auth";

type RouteCase = {
  path: string;
  label: string;
  assertVisible: (page: Page) => Locator;
};

const authenticatedRoutes: RouteCase[] = [
  {
    path: "/",
    label: "dashboard",
    assertVisible: (page) => page.getByRole("heading", { name: /Bom dia,/ }),
  },
  {
    path: "/operacoes",
    label: "operacoes",
    assertVisible: (page) => page.getByPlaceholder("Buscar por fornecedor, ID, valor..."),
  },
  {
    path: "/validacao-financeira",
    label: "validacao financeira",
    assertVisible: (page) => page.getByRole("heading", { name: "Validacao Financeira" }),
  },
  {
    path: "/advanced-ops",
    label: "advanced ops",
    assertVisible: (page) => page.getByRole("heading", { name: "Advanced Ops" }),
  },
  {
    path: "/contas-a-pagar",
    label: "contas a pagar",
    assertVisible: (page) => page.getByRole("heading", { name: "Contas a pagar" }),
  },
  {
    path: "/contas-a-receber",
    label: "contas a receber",
    assertVisible: (page) => page.getByRole("heading", { name: "Contas a receber" }),
  },
  {
    path: "/conciliacao",
    label: "conciliacao",
    assertVisible: (page) => page.getByText("Sincronizar agora"),
  },
  {
    path: "/excecoes",
    label: "excecoes",
    assertVisible: (page) => page.getByTestId("exception-detail-approve"),
  },
  {
    path: "/central-ia",
    label: "central ia",
    assertVisible: (page) => page.getByRole("heading", { name: "Central IA" }),
  },
  {
    path: "/logs-ia",
    label: "logs ia",
    assertVisible: (page) => page.getByRole("heading", { name: "Logs IA" }),
  },
  {
    path: "/automacao",
    label: "automacao",
    assertVisible: (page) => page.getByText("Runs").first(),
  },
  {
    path: "/fluxos",
    label: "fluxos",
    assertVisible: (page) => page.getByRole("heading", { name: "Fluxos" }),
  },
  {
    path: "/clientes",
    label: "clientes",
    assertVisible: (page) => page.getByRole("heading", { name: "Clientes" }),
  },
  {
    path: "/fornecedores",
    label: "fornecedores",
    assertVisible: (page) => page.getByRole("heading", { name: "Fornecedores" }),
  },
  {
    path: "/inbox-financeiro",
    label: "inbox financeiro",
    assertVisible: (page) => page.getByRole("heading", { name: "Inbox Financeiro" }),
  },
  {
    path: "/novidades",
    label: "novidades",
    assertVisible: (page) => page.getByRole("heading", { name: "Central de Novidades" }),
  },
  {
    path: "/relatorios",
    label: "relatorios",
    assertVisible: (page) => page.getByText("PDF").first(),
  },
  {
    path: "/executivo",
    label: "dashboard executivo",
    assertVisible: (page) => page.getByRole("heading", { name: "Dashboard Executivo" }),
  },
  {
    path: "/configuracoes",
    label: "configuracoes",
    assertVisible: (page) => page.getByRole("heading", { name: "Configuracoes" }),
  },
  {
    path: "/chat",
    label: "chat",
    assertVisible: (page) => page.getByText("Conversas"),
  },
];

test("live login route opens", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByTestId("login-email")).toBeVisible();
  await expect(page.getByTestId("login-password")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toBeVisible();
  await expect(page.getByText("Algo deu errado")).toHaveCount(0);
  await expect(page.getByText("Pagina nao encontrada")).toHaveCount(0);
});

for (const routeCase of authenticatedRoutes) {
  test(`live smoke, ${routeCase.label} opens`, async ({ page }) => {
    await loginByApi(page);

    await page.goto(routeCase.path);
    await expect(routeCase.assertVisible(page)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Algo deu errado")).toHaveCount(0);
    await expect(page.getByText("Pagina nao encontrada")).toHaveCount(0);
  });
}

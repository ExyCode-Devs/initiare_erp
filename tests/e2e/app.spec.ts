import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

test("login, dashboard, validation, finance pages, exceptions, and changelog work", async ({ page }) => {
  const api = await installApiMocks(page);

  await api.login();

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
  await expect(page.getByText("Exceção").first()).toBeVisible();

  await page.goto("/contas-a-receber");
  await expect(page.getByRole("cell", { name: "Acme Industries", exact: true })).toBeVisible();

  await page.goto("/excecoes");
  await expect(page.getByText("AI failure on manual review for Draft CloudPlus Infra").first()).toBeVisible();
  await page.getByTestId("exception-detail-approve").click();

  await page.goto("/novidades");
  await expect(page.getByText("Active Actions ingress with AI")).toBeVisible();

  api.assertNoUnhandled();
});

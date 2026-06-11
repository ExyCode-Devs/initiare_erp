import { expect, type Page } from "@playwright/test";

export const LIVE_API_BASE = "http://127.0.0.1:4010/api";
export const TOKEN_KEY = "veridia.access-token";

export async function loginByApi(page: Page) {
  const response = await page.request.post(`${LIVE_API_BASE}/auth/login`, {
    data: {
      email: "admin@veridia.local",
      password: "ChangeMe123!",
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { token: string };

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: TOKEN_KEY, value: payload.token },
  );
}

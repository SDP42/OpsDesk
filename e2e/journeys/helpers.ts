import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.DEMO_PASSWORD ?? "cleared-for-takeoff";

/** Sign in through the API (cookies are shared with the page) and skip first-flight onboarding. */
export async function signIn(page: Page, email: string) {
  const r = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(r.ok()).toBeTruthy();
  await page.request.patch("/api/me/preferences", { data: { onboarded: true, data_mode: "demo" } });
}

export async function api<T = unknown>(page: Page, method: "get" | "post", url: string, data?: unknown): Promise<T> {
  const r = method === "get" ? await page.request.get(url) : await page.request.post(url, { data });
  expect(r.ok(), `${method.toUpperCase()} ${url} -> ${r.status()}`).toBeTruthy();
  return ((await r.json()) as { data: T }).data;
}

export async function ticketOnBooking(page: Page, tboh: string): Promise<{ id: string; number: string }> {
  const list = await api<{ id: string; number: string }[]>(page, "get", `/api/tickets?tboh=${tboh}`);
  return list[0]!;
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}

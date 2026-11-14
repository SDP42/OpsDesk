import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DEMO_PASSWORD ?? "cleared-for-takeoff";

/**
 * Journey A (Problem 1): the Pilot files a refund on TBOH-88213, sees earlier cases and an
 * intent suggestion; the Controller then sees linked history and the Third-Contact banner.
 */
test("journey A: context and linkage", async ({ page, request }) => {
  // Skip first-flight onboarding for the test users.
  for (const email of ["pilot.saf@opsdesk.demo", "priya.nair@opsdesk.demo"]) {
    const ctx = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(ctx.ok()).toBeTruthy();
    await request.patch("/api/me/preferences", { data: { onboarded: true, data_mode: "demo" } });
  }

  await page.goto("/login");
  await page.getByTestId("callsign-requester").click();
  await page.waitForURL("**/pilot");

  await page.getByRole("textbox", { name: /what happened/i }).fill("Refund for TBOH-88213 still not received");
  await page.locator('textarea[name="description"]').fill("Asking again: the refund is still pending, the guest keeps calling.");
  await page.locator('input[name="tboh"]').fill("TBOH-88213");

  await expect(page.getByTestId("booking-panel")).toContainText(/earlier case/i);
  await expect(page.getByTestId("intent-suggest")).toContainText("Refund > Delay");
  await page.screenshot({ path: "screenshots/journey-a-pilot.png", fullPage: true });

  await page.getByRole("button", { name: /file flight/i }).click();
  const filed = page.getByTestId("flight-filed");
  await expect(filed).toBeVisible();
  const number = (await filed.textContent())?.match(/OD-\d+/)?.[0];
  expect(number).toBeTruthy();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("callsign-agent").click();
  await page.waitForURL("**/tower");
  await page.goto(`/tower/t/${number}`);
  await expect(page.getByRole("status").filter({ hasText: /third-contact guardian/i })).toBeVisible();
  await expect(page.getByText("TBOH-88213").first()).toBeVisible();
  await expect(page.getByText(/linked flights/i).first()).toBeVisible();
  await page.screenshot({ path: "screenshots/journey-a-controller.png", fullPage: true });
});

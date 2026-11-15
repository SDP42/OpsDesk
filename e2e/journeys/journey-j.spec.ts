import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

/** Constellation (3D linked cases) and Follow-the-Sun (shift handoffs with regional calendars). */
test("constellation renders and lists linked flights", async ({ page }) => {
  await signIn(page, "priya.nair@opsdesk.demo");
  await page.goto("/tower/links?tboh=TBOH-88213");
  await expect(page.getByText(/flights and \d+ links within two hops/)).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await shot(page, "constellation");
  await page.getByRole("button", { name: /List/ }).click();
  await expect(page.getByRole("button", { name: /OD-\d+/ }).first()).toBeVisible();
});

test("follow the sun shows regional working days and a plan", async ({ page }) => {
  await signIn(page, "meera.iyer@opsdesk.demo");
  await page.goto("/tower/handoffs");
  await expect(page.getByRole("heading", { name: /Urgent work never/ })).toBeVisible();
  for (const r of ["India", "UAE", "UK", "SE Asia"]) await expect(page.getByText(r, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Hand over \d+ flights/ })).toBeVisible();
  await shot(page, "follow-the-sun");
});

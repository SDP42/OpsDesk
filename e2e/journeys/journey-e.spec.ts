import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

/** Journey E (Problems 5 and 6): Weather Radar shows an emerging theme; the Black Box streams every row. */
test("journey E: insights and uncapped export", async ({ page }) => {
  await signIn(page, "meera.iyer@opsdesk.demo");
  await page.goto("/tower/insights");
  await expect(page.getByRole("heading", { name: /Hear the weather/ })).toBeVisible();
  await expect(page.getByText("Emerging").first()).toBeVisible();
  await shot(page, "journey-e-weather");

  await page.goto("/tower/data");
  const res = await page.request.get("/api/export/tickets?format=ndjson");
  const total = Number(res.headers()["x-total-count"]);
  const rows = (await res.text()).trim().split("\n").length;
  expect(rows).toBe(total);
  expect(total).toBeGreaterThan(3000 - 1);
  await expect(page.getByRole("button", { name: /Stream export/ })).toBeVisible();
  await shot(page, "journey-e-blackbox");
});

import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

/** Journey G: Chaos Mode forms a Storm Cell; one broadcast replies to every agency. */
test("journey G: storm cell and broadcast", async ({ page }) => {
  await signIn(page, "meera.iyer@opsdesk.demo");
  await page.goto("/tower/storms");
  await page.getByRole("button", { name: /Run chaos mode/ }).click();
  // Wait for all 40 flights to land before broadcasting to the full cell.
  await expect(page.getByRole("button", { name: /Run chaos mode/ })).toBeEnabled({ timeout: 90_000 });
  const storm = page.locator("article").filter({ hasText: "Palm Crescent Resort" }).first();
  await expect(storm).toBeVisible({ timeout: 30_000 });
  await shot(page, "journey-g-storm");
  await storm.getByRole("button", { name: /Broadcast to/ }).click();
  await expect(storm).toContainText(/Broadcast already sent/, { timeout: 15_000 });
});

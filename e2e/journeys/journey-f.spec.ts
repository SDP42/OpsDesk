import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

/** Journey F: a Ghost Flight is pre-empted and dissolves before the agency writes in. */
test("journey F: ghost flight dissolves", async ({ page }) => {
  await signIn(page, "meera.iyer@opsdesk.demo");
  await page.goto("/tower/ghosts");
  const card = page.locator("article").filter({ hasText: "TBOH-77341" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/risk/i);
  await shot(page, "journey-f-ghost");
  await card.getByRole("button", { name: /Send and dissolve ghost/ }).click();
  await expect(card).toBeHidden({ timeout: 10_000 });
});

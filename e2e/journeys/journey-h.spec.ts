import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

/** Journey H: HRMS leave makes flights orphaned; one click re-vectors them. */
test("journey H: crew roster rebalances orphaned flights", async ({ page }) => {
  await signIn(page, "meera.iyer@opsdesk.demo");
  await page.goto("/tower/roster");
  await expect(page.getByText(/Diwali leave/).first()).toBeVisible();
  await expect(page.getByText(/Orphan risk/)).toBeVisible();
  await shot(page, "journey-h-roster");
  await page.getByRole("button", { name: /Re-vector all now/ }).click();
  await expect(page.getByText(/Orphan risk/)).toBeHidden({ timeout: 15_000 });
});

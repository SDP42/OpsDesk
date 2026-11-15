import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

/** Wall Mode and Demo Autopilot: the showpieces for the ops floor and the demo. */
test("wall mode shows the live board", async ({ page }) => {
  await signIn(page, "meera.iyer@opsdesk.demo");
  await page.goto("/wall");
  await expect(page.getByText("Wall mode")).toBeVisible();
  await expect(page.getByText(/Open flights/i)).toBeVisible();
  await expect(page.getByRole("img", { name: /Radar with \d+ open flights/ })).toBeVisible();
  await shot(page, "wall-mode");
});

test("autopilot starts from one click and can be stepped", async ({ page }) => {
  await page.goto("/login?autopilot=1");
  const bar = page.getByRole("region", { name: "Demo autopilot" });
  await expect(bar).toBeVisible({ timeout: 20_000 });
  await expect(bar).toContainText("1/9");
  await bar.getByRole("button", { name: "Narration" }).click();
  await bar.getByRole("button", { name: "Next" }).click();
  await expect(bar).toContainText("2/9");
  await expect(page).toHaveURL(/\/tower\/t\/OD-/);
  await shot(page, "autopilot");
  await bar.getByRole("button", { name: "Stop autopilot" }).click();
  await expect(bar).toBeHidden();
});

import { expect, test } from "@playwright/test";
import { shot, signIn, ticketOnBooking } from "./helpers";

/** Journey D (Problem 4): check-in in 9 hours; escalate with a reason; it lands with the Tower Chief. */
test("journey D: travel-aware SLA and escalation", async ({ page }) => {
  await signIn(page, "priya.nair@opsdesk.demo");
  const t = await ticketOnBooking(page, "TBOH-90009");
  await page.goto(`/tower/t/${t.number}`);
  await expect(page.getByText(/check-in in 9h|check-in in 8h/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Escalate/ }).click();
  await page.getByLabel(/Reason for the Tower Chief/).fill("Check-in in 9 hours and the hotel has no record");
  await page.getByRole("button", { name: "Send to Tower Chief" }).click();
  await expect(page.getByText("Tower Chief").first()).toBeVisible();
  await page.context().clearCookies();
  await signIn(page, "rahul.kapoor@opsdesk.demo");
  await page.goto("/tower/escalations");
  await expect(page.getByTestId("flight-strip").filter({ hasText: t.number })).toBeVisible();
  await shot(page, "journey-d-escalation");
});

import { expect, test } from "@playwright/test";
import { api, shot, signIn } from "./helpers";

/** Journey B (Problem 2): an urgent Dubai flight is vectored to a UAE controller with a visible reason. */
test("journey B: routing with a reason", async ({ page }) => {
  await signIn(page, "pilot.dun@opsdesk.demo");
  const created = await api<{ ticket: { id: string; number: string } }>(page, "post", "/api/tickets", {
    title: "Urgent: guest stranded, hotel refusing check-in",
    description: "Guest is at the desk right now.",
    priority: "P1",
  });
  await page.context().clearCookies();
  await signIn(page, "priya.nair@opsdesk.demo");
  await page.goto(`/tower/t/${created.ticket.number}`);
  await expect(page.locator("p").filter({ hasText: "VECTORED" }).first()).toContainText("Region match UAE (+40)");
  await expect(page.getByText(/Why not/i)).toBeVisible();
  await shot(page, "journey-b-routing");
});

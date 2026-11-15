import { expect, test } from "@playwright/test";
import { api, shot, signIn, ticketOnBooking } from "./helpers";

/** Journey C (Problem 3): transfer keeps supplier recipients; the handoff check needs confirmation. */
test("journey C: frequencies survive a handoff", async ({ page }) => {
  await signIn(page, "priya.nair@opsdesk.demo");
  const t = await ticketOnBooking(page, "TBOH-66120");
  const controllers = await api<{ id: string; callsign: string }[]>(page, "get", "/api/controllers");
  const omar = controllers.find((c) => c.callsign === "AE-01")!;
  await page.goto(`/tower/t/${t.number}`);
  await expect(page.getByText("Atlas Bedbank").first()).toBeVisible();
  await page.getByLabel("Transfer to controller").selectOption(omar.id);
  await page.getByRole("button", { name: "Transfer" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Frequencies survive the transfer");
  await expect(dialog).toContainText("Atlas Bedbank");
  await shot(page, "journey-c-handoff");
  await page.getByTestId("confirm-handoff").click();
  await expect(dialog).toBeHidden();
  const detail = await api<{ ticket: { owner: { id: string } }; timeline: { type: string }[] }>(page, "get", `/api/tickets/${t.id}`);
  expect(detail.ticket.owner.id).toBe(omar.id);
  expect(detail.timeline.some((e) => e.type === "handoff_check")).toBeTruthy();
});

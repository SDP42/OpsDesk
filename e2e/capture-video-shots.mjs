// Captures 1920x1080 screens of every persona for the explainer video.
import { chromium } from "@playwright/test";
const OUT = "/Users/swayampanchal/voyagehack/docs/video/shots";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, baseURL: "http://localhost:3000" });
const p = await ctx.newPage();
const shot = async (name, full = false) => { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log(name); };
const login = async (email) => {
  await ctx.clearCookies();
  await p.request.post("/api/auth/login", { data: { email, password: "cleared-for-takeoff" } });
  await p.request.patch("/api/me/preferences", { data: { onboarded: true, data_mode: "demo" } });
};
const visit = async (path, name, wait = 4000, full = true) => { await p.goto(path); await p.waitForTimeout(wait); await shot(name); if (full) await shot(name + "_full", true); };

// Landing: scroll through scenes
await p.goto("/"); await p.waitForTimeout(6000);
const h = await p.evaluate(() => document.body.scrollHeight);
for (let i = 0; i < 9; i++) {
  await p.evaluate((y) => window.scrollTo(0, y), Math.min(i * 1080 * 1.6, h - 1080));
  await p.waitForTimeout(1800); await shot(`landing_${i}`);
}
await p.goto("/login"); await p.waitForTimeout(2500); await shot("login");

await login("pilot.saf@opsdesk.demo");
await visit("/pilot", "pilot", 4500);

await login("priya.nair@opsdesk.demo");
await visit("/tower/queue", "queue");
await visit("/tower/triage", "triage");
const t = (await (await p.request.get("/api/tickets?tboh=TBOH-88213")).json()).data[0];
await visit(`/tower/t/${t.number}`, "flight", 5500);
await visit("/tower/links?tboh=TBOH-88213", "constellation", 6000, false);

await login("rahul.kapoor@opsdesk.demo");
await visit("/tower/escalations", "escalations");
await visit("/tower/storms", "storms");
await visit("/tower/handoffs", "handoffs");

await login("meera.iyer@opsdesk.demo");
await visit("/tower", "tower", 5000);
await visit("/tower/ghosts", "ghosts");
await visit("/tower/roster", "roster");
await visit("/tower/suppliers", "suppliers");
await visit("/tower/insights", "insights");
await p.goto("/tower/simulate"); await p.waitForTimeout(2500);
try { await p.getByRole("button", { name: /Run simulation/ }).click(); await p.waitForTimeout(4500); } catch {}
await shot("simulate"); await shot("simulate_full", true);
await visit("/tower/data", "data");
await p.goto("/tower"); await p.waitForTimeout(3500);
await p.keyboard.press("Meta+k"); await p.waitForTimeout(800);
await p.keyboard.type("critical refunds in UAE", { delay: 40 }); await p.waitForTimeout(1500); await shot("cmdk");
await p.keyboard.press("Escape");
await visit("/wall", "wall", 5000, false);

await login("partner.atlas@opsdesk.demo");
await visit("/partner", "partner");
await b.close();
console.log("done");

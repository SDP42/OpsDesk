// Builds docs/presentation/OpsDesk_Idea_Submission.pptx (cover + 2 content slides + thank you).
// Run from the repo root: NODE_PATH=docs/presentation/node_modules node docs/presentation/build_deck.js
const path = require("path");
const pptxgen = require("pptxgenjs");

const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "OpsDesk_Idea_Submission.pptx");
const SKILL = process.env.PPTX_SKILL_DIR;

const THEME = {
  name: "Daylight Tower",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0D1117", lt1: "FFFFFF", dk2: "1F2630", lt2: "F4F1EA",
    accent1: "FF5A1F", accent2: "FFC629", accent3: "2D5BFF", accent4: "0C9F6A", accent5: "DF1C47", accent6: "6F4CF6",
    hlink: "2D5BFF", folHlink: "6F4CF6",
  },
};
const K = { ink: "0D1117", paper: "F4F1EA", beacon: "FF5A1F", taxi: "C98F00", cobalt: "2D5BFF", signal: "0C9F6A", alarm: "DF1C47", violet: "6F4CF6", dim: "5A6270", line: "D8D2C4", white: "FFFFFF" };
const TINT = { [K.beacon]: "FFEDE5", [K.cobalt]: "E9EEFF", [K.signal]: "E2F4EC", [K.violet]: "EFEBFE", [K.taxi]: "FFF5D6", [K.ink]: "ECEDEF", [K.alarm]: "FDE7EC" };
const GH = "https://github.com/SDP42/OpsDesk";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "OpsDesk Control Tower: Idea Submission";
pres.author = "Swayam Panchal, Jeevesh Bodhani, Rishit Lahoti, Shreyas Kale";

// ---------------------------------------------------------------- helpers
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontFace: "Calibri", color: K.ink, valign: "top", ...o });
const rect = (s, x, y, w, h, fill, line = fill) => s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: line, width: 0.75 } });
/** White panel with a coloured spine on the left and a small-caps label. */
const panel = (s, x, y, w, h, color, label) => {
  rect(s, x, y, w, h, K.white, K.line);
  rect(s, x, y, 0.06, h, color);
  if (label) T(s, label.toUpperCase(), { x: x + 0.18, y: y + 0.08, w: w - 0.3, h: 0.22, fontSize: 9.5, bold: true, color, charSpacing: 1.5 });
};
/** Indented square-bullet list of plain strings. */
const bullets = (s, items, x, y, w, h, size = 8) =>
  T(s, items.map((t) => ({ text: t, options: { bullet: { code: "25AA", indent: 9 }, paraSpaceAfter: 2.5, breakLine: true } })), { x, y, w, h, fontSize: size });
/** Indented square-bullet list with a bold lead and a dimmed explanation. */
const richBullets = (s, items, x, y, w, h, size = 8, gap = 2.5) => {
  const runs = [];
  items.forEach(([lead, rest], i) => {
    runs.push({ text: lead + "  ", options: { bold: true, bullet: { code: "25AA", indent: 9 }, paraSpaceAfter: gap } });
    runs.push({ text: rest, options: { color: K.dim, breakLine: i < items.length - 1 } });
  });
  T(s, runs, { x, y, w, h, fontSize: size });
};
const sign = (s, x, y, w, text, fill, color = K.white) => {
  rect(s, x, y, w, 0.28, fill);
  T(s, text, { x, y: y + 0.045, w, h: 0.2, fontSize: 9, bold: true, align: "center", color, fontFace: "Courier New", charSpacing: 1 });
};
const img = (s, file, x, y, w, h, name) => {
  rect(s, x - 0.02, y - 0.02, w + 0.04, h + 0.04, K.white, K.line);
  s.addImage({ path: A(file), x, y, w, h, sizing: { type: "cover", w, h }, altText: name, objectName: name });
};
const header = (s, n, kicker, title, sub) => {
  T(s, `${n}  ·  ${kicker}`.toUpperCase(), { x: 0.35, y: 0.16, w: 6, h: 0.2, fontSize: 9, bold: true, color: K.beacon, charSpacing: 2 });
  T(s, "OPSDESK CONTROL TOWER  ·  TBO VOYAGEHACK PS3", { x: 7.0, y: 0.16, w: 5.98, h: 0.2, fontSize: 8, color: K.dim, align: "right", charSpacing: 1.5 });
  T(s, title, { x: 0.35, y: 0.36, w: 12.63, h: 0.42, fontFace: "Cambria", fontSize: 22, bold: true });
  T(s, sub, { x: 0.35, y: 0.78, w: 12.63, h: 0.22, fontSize: 10.5, color: K.dim, italic: true });
};
const arrow = (s, x, y, w, h, both = false) =>
  s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: K.ink, width: 1.25, endArrowType: "triangle", ...(both ? { beginArrowType: "triangle" } : {}) } });
const node = (s, x, y, w, h, color, title, body) => {
  rect(s, x, y, w, h, TINT[color], color);
  rect(s, x, y, 0.05, h, color);
  T(s, [{ text: title, options: { bold: true, color, breakLine: true, fontSize: 8 } }, { text: body, options: { fontSize: 8 } }], { x: x + 0.12, y: y + 0.05, w: w - 0.18, h: h - 0.08 });
};


/** Rounded tag; returns its width so chips can flow. */
const chipW = (t, size) => t.length * size * 0.0062 + 0.16;
const chip = (s, x, y, t, color, size = 7.5, h = 0.24, solid = false) => {
  const w = chipW(t, size);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: solid ? color : TINT[color] }, line: { color: TINT[color] === undefined ? color : color, width: 0.5 } });
  T(s, t, { x, y: y + (h - size / 72 * 1.25) / 2, w, h: size / 72 * 1.3, fontSize: size, align: "center", color: solid ? K.white : K.ink, bold: solid });
  return w;
};
/** Lay chips left to right, wrapping inside width w; returns the y below the last row. */
const chips = (s, items, x, y, w, color, size = 7.5, h = 0.24, gap = 0.06) => {
  let cx = x, cy = y;
  items.forEach((t) => {
    const cw = chipW(t, size);
    if (cx + cw > x + w && cx > x) { cx = x; cy += h + gap; }
    chip(s, cx, cy, t, color, size, h);
    cx += cw + gap;
  });
  return cy + h;
};
/** Big-number tile. */
/** Lucide (ISC) icon, white on a coloured disc. */
const icon = (s, name, x, y, d, color) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color } });
  s.addImage({ path: A(`icons/${name}.png`), x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56, altText: name });
};
/** Panel whose label sits beside an icon disc. */
const ipanel = (s, x, y, w, h, color, label, ic) => {
  rect(s, x, y, w, h, K.white, K.line);
  rect(s, x, y, 0.06, h, color);
  icon(s, ic, x + 0.17, y + 0.09, 0.26, color);
  T(s, label.toUpperCase(), { x: x + 0.5, y: y + 0.1, w: w - 0.6, h: 0.22, fontSize: 9.5, bold: true, color, charSpacing: 1.5 });
};
const lead = (s, x, y, w, text) => T(s, text, { x, y, w, h: 0.18, fontSize: 8, italic: true, color: K.dim });
const stat = (s, x, y, w, h, value, label, color) => {
  rect(s, x, y, w, h, TINT[color]);
  rect(s, x, y, w, 0.04, color);
  T(s, value, { x: x + 0.1, y: y + 0.08, w: w - 0.15, h: 0.36, fontFace: "Cambria", fontSize: 16, bold: true, color });
  T(s, label, { x: x + 0.1, y: y + 0.37, w: w - 0.15, h: h - 0.4, fontSize: 7.5, color: K.ink });
};
const check = (s, x, y, t, ok = true) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.2, h: 0.2, fill: { color: ok ? K.signal : "B9BEC6" }, line: { color: ok ? K.signal : "B9BEC6" } });
  T(s, ok ? "✓" : "…", { x, y: y + 0.02, w: 0.2, h: 0.16, fontSize: 8, bold: true, color: K.white, align: "center" });
  T(s, t, { x: x + 0.27, y: y + 0.02, w: 2.6, h: 0.18, fontSize: 8, color: ok ? K.ink : K.dim });
};

// ============================================================ 1. COVER
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  rect(s, 0, 0, 13.333, 0.08, K.beacon);
  img(s, "landing.png", 6.75, 0.55, 6.2, 3.875, "Landing page");
  img(s, "wall.png", 6.75, 4.6, 3.0, 1.875, "Wall Mode");
  img(s, "constellation.png", 9.95, 4.6, 3.0, 1.875, "Constellation");
  sign(s, 0.55, 0.55, 2.3, "TBO VOYAGEHACK", K.ink);
  sign(s, 2.95, 0.55, 3.25, "PROBLEM STATEMENT 3 · OPSDESK", K.beacon);
  T(s, "OpsDesk", { x: 0.55, y: 1.05, w: 6, h: 0.9, fontFace: "Cambria", fontSize: 54, bold: true });
  T(s, "Control Tower", { x: 0.55, y: 1.85, w: 6, h: 0.8, fontFace: "Cambria", fontSize: 40, italic: true, color: K.beacon });
  rect(s, 0.55, 2.78, 0.6, 0.04, K.ink);
  T(s, "Every ticket is a flight.", { x: 0.55, y: 2.88, w: 6, h: 0.4, fontFace: "Cambria", fontSize: 20, italic: true, color: K.dim });
  T(s, "A travel-ops ticketing platform for TBO's B2B world, run like an air-traffic control tower: every case linked to its booking, routed with a visible reason, timed to the guest's check-in, and worked together with suppliers and HR data.", { x: 0.55, y: 3.35, w: 5.9, h: 0.95, fontSize: 13, color: "2A3038" });
  [["30+", "features shipped", K.beacon], ["6", "personas served", K.cobalt], ["347", "commits", K.signal], ["12", "e2e journeys", K.violet], ["97", "Lighthouse perf", K.beacon], ["88%", "intent accuracy", K.cobalt]].forEach(([v, l, c], i) => {
    const x = 0.55 + (i % 3) * 2.0, y = 4.4 + Math.floor(i / 3) * 0.98;
    rect(s, x, y, 1.85, 0.86, K.white, K.line);
    rect(s, x, y, 0.06, 0.86, c);
    T(s, v, { x: x + 0.18, y: y + 0.06, w: 1.6, h: 0.48, fontFace: "Cambria", fontSize: 24, bold: true, color: c });
    T(s, l, { x: x + 0.18, y: y + 0.55, w: 1.65, h: 0.25, fontSize: 10.5, color: K.dim });
  });
  T(s, [{ text: "Team  ", options: { bold: true, color: K.beacon } }, { text: "Swayam Panchal · Jeevesh Bodhani · Rishit Lahoti · Shreyas Kale", options: {} }], { x: 0.55, y: 6.42, w: 6.1, h: 0.3, fontSize: 11.5 });
  T(s, [{ text: "Dept. of AI & Data Science, Dwarkadas J. Sanghvi College of Engineering  ·  ", options: { color: K.dim } }, { text: GH, options: { color: K.cobalt, hyperlink: { url: GH } } }], { x: 0.55, y: 6.75, w: 12.4, h: 0.3, fontSize: 10.5 });
  s.addNotes("Cover. OpsDesk Control Tower reframes TBO ops ticketing as air-traffic control.");
}

// ============================================================ 2. SOLUTION
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  header(s, "01", "The solution", "Every MVP in the brief, built, and why it matters to TBO", "MVP-1 to MVP-7 and the stretch goals from the problem statement, then what makes OpsDesk unique, its impact, feasibility, viability and benefits");

  const hd = (t) => ({ text: t, options: { bold: true, color: K.white, fill: { color: K.ink }, fontSize: 9 } });
  const c = (t, o = {}) => ({ text: t, options: { fontSize: 8, color: K.ink, valign: "middle", ...o } });
  const m = (t) => c(t, { bold: true, color: K.beacon });
  const rows = [
    [hd("MVP"), hd("What the brief asks"), hd("What OpsDesk ships (all live, tested)")],
    [m("1 · Context"), c("Ticket with TBOH, intent, travel dates; link by TBOH/agency/intent; status flow; timeline"), c("TBOH fills check-in + LCD; TF-IDF + MiniLM intent (top-3, 88%); links by TBOH 1.0, agency+intent 0.8, meaning; Guardian on 3rd contact; New→Open→Pending→Escalated→Resolved→Closed enforced")],
    [m("2 · Routing"), c("Beyond FIFO: region, time, rank, availability; views; show why it was routed"), c("Vectoring scores 6 signals + 4 presets; triage / my queue / region / escalations / constellation views; waterfall + 'why not' runners-up; what-if simulator")],
    [m("3 · Side conv."), c("Explicit recipients that survive transfer; internal vs external"), c("Frequencies with locked recipients; HandoffDiff confirm on transfer; separate internal/external routes + colours; Supplier Partner portal")],
    [m("4 · SLA"), c("SLA from priority + check-in/LCD; at-risk/breached; first-class escalate"), c("Wheels-Up clock (×0.25 within 12 h, holiday pause); fuel gauges; 1-click Escalate with reason → Tower Chief in < 1 s; Breach Forecast")],
    [m("5 · Insights"), c("Themes, top themes + samples, product link; AI on linked history"), c("Weather Radar heat map, z-score emerging flag, editable product link; Co-pilot Brief from linked history; Frustration Radar")],
    [m("6 · Data"), c("Durable storage, export beyond 3K, scale + retention stance"), c("SQLite WAL / Postgres; keyset-streamed CSV/NDJSON with live counter, no cap; SSE; 90-day archive; CDC → Kafka → ClickHouse path")],
    [m("7 · Roles"), c("Requester / Agent / Escalation Mgr / Lead; never expose other agencies"), c("5 roles in one RBAC module; cross-agency reads return 404 (tested); httpOnly JWT, argon2, rate limits, audit log on every change")],
  ];
  s.addTable(rows, { x: 0.35, y: 1.12, w: 6.55, colW: [0.9, 2.05, 3.6], rowH: [0.25, 0.44, 0.42, 0.37, 0.42, 0.4, 0.4, 0.4], border: { type: "solid", color: K.line, pt: 0.75 }, fill: { color: K.white }, margin: 0.04 });

  panel(s, 0.35, 4.32, 3.2, 1.0, K.signal, "Stretch goals");
  [["Real-time sync (SSE)", 1], ["MiniLM auto-intent", 1], ["Supplier portal", 1], ["Canned replies", 1], ["Webhooks", 0], ["CSAT", 0]].forEach(([t, ok], i) =>
    check(s, 0.5 + (i % 2) * 1.5, 4.6 + Math.floor(i / 2) * 0.235, t + (ok ? "" : " · next"), !!ok));
  panel(s, 3.7, 4.32, 3.2, 1.0, K.cobalt, "Technical expectations");
  ["Working demo", "README → P1-P6", "Durable storage", "Empty/load/error", "No secrets", "Strict validation"].forEach((t, i) =>
    check(s, 3.85 + (i % 2) * 1.5, 4.6 + Math.floor(i / 2) * 0.235, t));

  const chart = (x, title, file, cap, alt) => {
    panel(s, x, 5.42, 2.1, 1.88, K.ink, title);
    s.addImage({ path: A(file), x: x + 0.1, y: 5.72, w: 1.92, h: 1.1, sizing: { type: "contain", w: 1.92, h: 1.1 }, altText: alt, objectName: alt });
    T(s, cap, { x: x + 0.18, y: 6.88, w: 1.85, h: 0.4, fontSize: 7.5, color: K.dim });
  };
  chart(0.35, "Routing reason", "chart_waterfall.png", "Real Vectoring output: Omar won by 34 pts; every point shown.", "Routing waterfall");
  chart(2.575, "Travel-aware SLA", "chart_sla_curve.png", "Response time shrinks as the guest's check-in nears.", "SLA curve");
  chart(4.8, "Before vs after", "chart_ba_compact.png", "Measured: context 0→2, intent 76→88%, load 4.7→0.8 s.", "Before after");

  // A. Headline: the one sentence a judge should remember
  rect(s, 7.05, 1.12, 5.93, 0.7, TINT[K.beacon]);
  rect(s, 7.05, 1.12, 0.06, 0.7, K.beacon);
  icon(s, "rocket", 7.22, 1.27, 0.4, K.beacon);
  T(s, [{ text: "From a first-come inbox to an air-traffic control tower.", options: { bold: true, fontFace: "Cambria", fontSize: 13.5, breakLine: true } },
    { text: "Every case linked to its booking, routed with a visible reason, and timed to the guest's check-in.", options: { color: K.dim, fontSize: 8.5 } }], { x: 7.75, y: 1.2, w: 5.15, h: 0.58 });

  // B. Hero: capability comparison
  ipanel(s, 7.05, 1.92, 5.93, 2.43, K.beacon, "Why it's unique · OpsDesk vs a generic helpdesk", "target");
  const rowsU = [
    ["ghost", K.beacon, "Ghost Flights", "predicts tickets before they arrive", "—", "—"],
    ["cloud-lightning", K.alarm, "Storm Cells", "5+ cases → 1 incident, 1 broadcast", "—", "manual"],
    ["user-check", K.signal, "HR-aware routing", "Darwinbox leave and shifts", "—", "paid app"],
    ["sun", K.taxi, "Follow-the-Sun", "region handoff, holiday-aware", "—", "manual"],
    ["chart-line", K.cobalt, "Breach Forecast", "Monte Carlo what-if before acting", "—", "—"],
    ["triangle-alert", K.violet, "Churn early-warning", "3rd contact + frustration radar", "—", "paid AI"],
    ["lightbulb", K.ink, "Explainable by default", "every score shows its 'why'", "—", "—"],
    ["mic", K.beacon, "Voice + plain English", "Tower Radio voice, ⌘K questions", "—", "paid bot"],
  ];
  const th = (t, f, al = "center") => ({ text: t, options: { bold: true, color: K.white, fill: { color: f }, fontSize: 8, align: al, valign: "middle" } });
  const tc = (t, o = {}) => ({ text: t, options: { fontSize: 7.5, align: "center", valign: "middle", ...o } });
  const RH = 0.228, TY = 2.23;
  s.addTable([
    [th("Capability", K.ink, "left"), th("Generic helpdesk", "5A6270"), th("+ paid add-ons", K.alarm), th("OpsDesk", K.signal)],
    ...rowsU.map(([, , h, d, g, a]) => [
      { text: [{ text: h + "  ", options: { bold: true } }, { text: d, options: { color: K.dim } }], options: { fontSize: 7.5, valign: "middle", margin: [0, 0.04, 0, 0.32] } },
      tc(g, { color: "9AA0A8", bold: true }),
      tc(a, { color: a === "—" ? "9AA0A8" : K.alarm, bold: a === "—" }),
      tc("✓ built in", { color: K.signal, bold: true, fill: { color: TINT[K.signal] } }),
    ]),
  ], { x: 7.2, y: TY, w: 5.63, colW: [3.03, 0.86, 0.86, 0.88], rowH: [0.26, ...rowsU.map(() => RH)], border: { type: "solid", color: K.line, pt: 0.5 }, fill: { color: K.white }, margin: 0.03 });
  rowsU.forEach(([ic, col], k) => icon(s, ic, 7.25, TY + 0.26 + k * RH + 0.025, 0.18, col));

  // C. Impact strip
  rect(s, 7.05, 4.45, 5.93, 0.92, K.white, K.line);
  rect(s, 7.05, 4.45, 0.06, 0.92, K.alarm);
  icon(s, "zap", 7.24, 4.55, 0.3, K.alarm);
  T(s, [{ text: "IMPACT", options: { bold: true, color: K.alarm, charSpacing: 1.5, breakLine: true, fontSize: 9.5 } }, { text: "measured on the prototype", options: { color: K.dim, fontSize: 7, italic: true } }], { x: 7.22, y: 4.92, w: 0.95, h: 0.42 });
  [["0", "repeat stories per booking", K.alarm], ["< 1 s", "escalation to Tower Chief", K.beacon], ["76→88%", "intent accuracy", K.cobalt], ["3K→60K+", "rows per export", K.signal]].forEach(([v, l, col], k) => {
    const x = 8.2 + k * 1.2;
    rect(s, x, 4.53, 1.13, 0.76, TINT[col]);
    rect(s, x, 4.53, 1.13, 0.04, col);
    T(s, v, { x: x + 0.08, y: 4.61, w: 1.0, h: 0.34, fontFace: "Cambria", fontSize: 15, bold: true, color: col });
    T(s, l, { x: x + 0.08, y: 4.97, w: 1.0, h: 0.3, fontSize: 7, color: K.ink });
  });

  // D. Feasible & viable + benefits
  ipanel(s, 7.05, 5.47, 2.915, 1.83, K.signal, "Feasible & viable", "badge-check");
  [["terminal", K.signal, "Runs today:", "3 commands on a laptop"], ["cpu", K.cobalt, "CPU only:", "pretrained MiniLM, offline fallback"], ["wallet", K.violet, "₹0 add-ons:", "Apache / MIT stack, no per-seat fee"], ["database", K.taxi, "Scales:", "SQLite → Postgres → Kafka path"]].forEach(([ic, col, h, d], k) => {
    const y = 5.86 + k * 0.355;
    icon(s, ic, 7.22, y, 0.26, col);
    T(s, [{ text: h + " ", options: { bold: true } }, { text: d, options: { color: K.dim } }], { x: 7.56, y: y + 0.04, w: 2.35, h: 0.2, fontSize: 7.5 });
  });
  ipanel(s, 10.065, 5.47, 2.915, 1.83, K.violet, "Benefits by persona", "users");
  [["Agency", "Never repeats the story", K.beacon, "building-2"], ["Agent", "History + why, one screen", K.cobalt, "headset"], ["Manager", "Sorted by check-in", K.alarm, "shield-alert"], ["Lead", "Risk before breach", K.signal, "chart-column"], ["Product", "Themes as they emerge", K.violet, "lightbulb"], ["Supplier", "Replies on the ticket", K.taxi, "truck"]].forEach(([h, d, col, ic], k) => {
    const x = 10.215 + (k % 2) * 1.37, y = 5.84 + Math.floor(k / 2) * 0.475;
    rect(s, x, y, 1.3, 0.42, TINT[col]);
    icon(s, ic, x + 0.06, y + 0.085, 0.25, col);
    T(s, [{ text: h, options: { bold: true, color: col, breakLine: true } }, { text: d, options: { color: K.ink } }], { x: x + 0.37, y: y + 0.05, w: 0.92, h: 0.36, fontSize: 7 });
  });
  s.addNotes("Every MVP from the brief with what we built, stretch goals, technical expectations, eight differentiating ideas, and the impact, feasibility, viability and benefits.");
}

// ============================================================ 3. PROTOTYPE, ARCHITECTURE, PERSONAS
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  header(s, "02", "The prototype", "A working prototype: 12 live screens, the architecture and 6 persona journeys", "Every screenshot is the running app on seeded demo data; the arrows show how one request travels through the system");
  T(s, [{ text: "▶  Watch the 4-min demo video", options: { hyperlink: { url: "https://drive.google.com/drive/folders/1E1uyaZgydQRglXeVXrytohNdNHtkvjsT?usp=sharing" }, color: K.beacon, bold: true } }], { x: 9.9, y: 0.8, w: 3.08, h: 0.22, fontSize: 10, align: "right" });

  const shots = [
    ["tower.png", "Tower overview"], ["flight.png", "Flight detail + Why"], ["pilot.png", "Pilot flight board"], ["partner.png", "Supplier portal"],
    ["ghosts.png", "Ghost Flights"], ["storms.png", "Storm Cells"], ["roster.png", "Crew Roster (HRMS)"], ["handoffs.png", "Follow-the-Sun"],
    ["weather.png", "Weather Radar"], ["simulate.png", "Routing simulator"], ["blackbox.png", "Black Box export"], ["wall.png", "Wall Mode"],
  ];
  shots.forEach(([f, cap], i) => {
    const x = 0.35 + (i % 4) * 1.55, y = 1.14 + Math.floor(i / 4) * 1.2;
    img(s, f, x, y, 1.45, 0.92, cap);
    T(s, cap, { x, y: y + 0.95, w: 1.45, h: 0.2, fontSize: 8, bold: true });
  });

  panel(s, 6.6, 1.12, 6.38, 3.56, K.beacon, "System architecture: request path");
  const X = 6.78, W = 6.04;
  node(s, X, 1.42, W, 0.42, K.ink, "CLIENTS · browser", "Landing (scroll video + 3D) · Tower console · Pilot board · Partner portal · Wall Mode · Tower Radio voice · ⌘K Ask the Tower");
  arrow(s, 8.0, 1.84, 0, 0.2);
  T(s, "HTTPS · httpOnly JWT cookie", { x: 8.08, y: 1.87, w: 2.5, h: 0.16, fontSize: 7, italic: true, color: K.dim });
  node(s, X, 2.04, W, 0.38, K.violet, "EDGE · Next.js 15 server", "same-origin /api proxy · SSE pass-through · security headers · typed client from OpenAPI");
  arrow(s, 8.0, 2.42, 0, 0.2);
  T(s, "REST + Server-Sent Events", { x: 8.08, y: 2.45, w: 2.5, h: 0.16, fontSize: 7, italic: true, color: K.dim });
  node(s, X, 2.62, 4.1, 0.56, K.beacon, "API · FastAPI + Pydantic v2", "RBAC 5 roles (cross-agency → 404) · Tickets · Links · Frequencies · Partner · Ops · Insights · Export · Stream · Assistant");
  arrow(s, 10.9, 2.9, 0.2, 0, true);
  node(s, 11.12, 2.62, 1.7, 0.56, K.signal, "EXTERNAL", "Darwinbox HRMS · suppliers · holiday calendars");
  arrow(s, 7.9, 3.18, 0, 0.2);
  arrow(s, 10.05, 3.18, 0, 0.2);
  node(s, X, 3.38, 2.4, 1.2, K.taxi, "ENGINES · pure, every output has a reason", "Vectoring · Wheels-Up SLA · Linker · Intent (TF-IDF + MiniLM) · Weather · Ghosts (GBM) · Forecast (Monte Carlo) · Storms · Roster · Follow-the-Sun · Frustration (VADER) · Promises · Simulator · Co-pilot");
  node(s, 9.28, 3.38, 1.72, 1.2, K.cobalt, "DATA", "SQLite WAL or PostgreSQL · SQLAlchemy 2 async · Alembic · 20 tables · timeline + audit_log · cached vectors");
  arrow(s, 11.0, 3.98, 0.12, 0, true);
  node(s, 11.12, 3.38, 1.7, 1.2, K.violet, "JOBS · APScheduler", "sla_tick every 60 s → SSE push · 90-day archive · Follow-the-Sun handoffs");

  const hd = (t) => ({ text: t, options: { bold: true, color: K.white, fill: { color: K.ink }, fontSize: 8.5 } });
  const c = (t) => ({ text: t, options: { fontSize: 7.5, color: K.ink, valign: "middle" } });
  const p = (t, sub) => ({ text: [{ text: t, options: { bold: true, color: K.beacon, breakLine: true } }, { text: sub, options: { color: K.dim } }], options: { fontSize: 7.5, valign: "middle" } });
  const journeys = [
    [hd("Persona (from the brief)"), hd("What they need"), hd("Their journey in OpsDesk")],
    [p("Agency / Requester", "Pilot"), c("Continuity and status, no repeat explanations"), c("Types the problem → TBOH fills check-in and LCD → intent suggested → 'you have 2 earlier cases' → files → tracks status and ETA on the departures board, or asks Tower Radio by voice")],
    [p("Ops Agent", "Controller"), c("History, links, intent, correct routing, clean threads"), c("Queue sorted by fuel left → opens flight with linked history and Guardian banner → reads why it was routed → Co-pilot Brief + forecast → opens a Frequency to the supplier → replies or escalates")],
    [p("Escalation Manager", "Tower Chief"), c("Direct escalation, check-in/LCD urgency"), c("Escalation lands in < 1 s with its reason → sorted by check-in → accepts, reassigns or resolves → one broadcast for a Storm Cell → Follow-the-Sun handoff at shift end")],
    [p("Ops Lead / Governance", "Airport Director"), c("Queue health, SLA risk, reporting without limits"), c("Radar and health tiles → simulates routing presets and applies the winner → syncs Darwinbox roster, re-routes orphans → streams uncapped exports → runs the archive")],
    [p("Product / Insights", "Weather desk"), c("Recurring themes into the backlog"), c("Weather Radar 8-week heat map → emerging spike flagged → reads sample tickets → attaches a Jira or roadmap product link")],
    [p("Supplier Partner", "our addition"), c("Answer TBO without email chains"), c("Sees only its own channels → quick replies ('Confirmed, HCN to follow') → reply lands on the ticket timeline live → tracks its own reply speed")],
  ];
  s.addTable(journeys, { x: 0.35, y: 4.8, w: 9.0, colW: [1.55, 2.0, 5.45], rowH: [0.22, 0.36, 0.36, 0.36, 0.36, 0.33, 0.33], border: { type: "solid", color: K.line, pt: 0.75 }, fill: { color: K.white }, margin: 0.04 });

  panel(s, 9.5, 4.8, 3.48, 2.5, K.cobalt, "Tech stack");
  let ty = 5.1;
  [["Backend", K.beacon, ["Python 3.12", "FastAPI", "Pydantic v2", "SQLAlchemy 2", "Alembic"]],
   ["AI / ML", K.violet, ["scikit-learn", "MiniLM (ONNX)", "VADER", "NumPy", "networkx"]],
   ["Frontend", K.cobalt, ["Next.js 15", "React 19", "Tailwind 4", "Radix", "TanStack Query"]],
   ["Realtime · motion", K.taxi, ["SSE", "APScheduler", "React Three Fiber", "GSAP", "Lenis"]],
   ["Data · security · quality", K.signal, ["SQLite / Postgres", "argon2 + JWT", "pytest", "Playwright"]]].forEach(([lab, col, items]) => {
    T(s, lab.toUpperCase(), { x: 9.65, y: ty, w: 3, h: 0.16, fontSize: 7, bold: true, color: col, charSpacing: 1 });
    ty = chips(s, items, 9.65, ty + 0.17, 3.2, col, 7, 0.19, 0.04) + 0.06;
  });
  s.addNotes("Twelve real screenshots, the request path through the architecture, the journey of every persona the brief names plus our supplier partner, and the full tech stack.");
}

// ============================================================ 4. THANK YOU
const VIDEO = "https://drive.google.com/drive/folders/1E1uyaZgydQRglXeVXrytohNdNHtkvjsT?usp=sharing";
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  rect(s, 0, 0, 13.333, 0.08, K.beacon);
  T(s, "Thank you", { x: 0.5, y: 0.35, w: 6, h: 0.8, fontFace: "Cambria", fontSize: 44, bold: true });
  T(s, "Thank you for reviewing OpsDesk Control Tower. We welcome your questions.", { x: 0.5, y: 1.15, w: 7.1, h: 0.4, fontFace: "Cambria", fontSize: 16, italic: true, color: K.beacon });

  [["Swayam Panchal", K.beacon], ["Jeevesh Bodhani", K.cobalt], ["Rishit Lahoti", K.signal], ["Shreyas Kale", K.violet]].forEach(([n, col], i) => {
    const x = 0.5 + i * 1.8;
    rect(s, x, 1.72, 1.7, 0.95, K.white, K.line);
    rect(s, x, 1.72, 1.7, 0.06, col);
    T(s, n, { x: x + 0.14, y: 1.93, w: 1.5, h: 0.26, fontSize: 12, bold: true });
    T(s, "AI & Data Science · DJSCE", { x: x + 0.14, y: 2.22, w: 1.55, h: 0.2, fontSize: 8.5, color: K.dim });
  });
  T(s, "Dept. of Artificial Intelligence and Data Science · Dwarkadas J. Sanghvi College of Engineering, Mumbai", { x: 0.5, y: 2.8, w: 7.1, h: 0.25, fontSize: 10, color: K.dim });

  ipanel(s, 0.5, 3.2, 3.5, 2.5, K.signal, "Brief deliverables", "badge-check");
  [["Runnable application", "make setup · seed · dev"], ["README mapped to P1-P6", "accounts, formulas, scale"], ["3-5 min demo video", "problem → solution → every persona"], ["Seed data", "3,000+ flights, 5 agencies"], ["Architecture + cost contrast", "this deck · docs/MODELS.md"]].forEach(([a, b], i) => {
    const y = 3.58 + i * 0.41;
    s.addShape(pres.shapes.OVAL, { x: 0.68, y, w: 0.24, h: 0.24, fill: { color: K.signal }, line: { color: K.signal } });
    T(s, "✓", { x: 0.68, y: y + 0.03, w: 0.24, h: 0.18, fontSize: 9, bold: true, color: K.white, align: "center" });
    T(s, [{ text: a, options: { bold: true, breakLine: true } }, { text: b, options: { color: K.dim, fontSize: 8 } }], { x: 1.0, y: y - 0.03, w: 2.9, h: 0.36, fontSize: 9 });
  });

  ipanel(s, 4.1, 3.2, 3.5, 2.5, K.cobalt, "Run the prototype", "terminal");
  [["Clone", "git clone github.com/SDP42/OpsDesk"], ["Install + seed", "make setup && make seed"], ["Start", "make dev  →  localhost:3000"], ["Guided demo", "Autopilot walks every persona in 90 s"]].forEach(([h, d], i) => {
    const y = 3.6 + i * 0.5;
    s.addShape(pres.shapes.OVAL, { x: 4.28, y, w: 0.3, h: 0.3, fill: { color: K.cobalt }, line: { color: K.cobalt } });
    T(s, String(i + 1), { x: 4.28, y: y + 0.06, w: 0.3, h: 0.18, fontSize: 9.5, bold: true, color: K.white, align: "center" });
    if (i < 3) s.addShape(pres.shapes.LINE, { x: 4.43, y: y + 0.3, w: 0, h: 0.2, line: { color: K.cobalt, width: 1 } });
    T(s, [{ text: h, options: { bold: true, breakLine: true } }, { text: d, options: { color: K.dim, fontSize: 8, fontFace: i < 3 ? "Courier New" : "Calibri" } }], { x: 4.7, y: y - 0.02, w: 2.85, h: 0.42, fontSize: 9.5 });
  });

  ipanel(s, 0.5, 5.82, 7.1, 1.28, K.beacon, "What's next", "rocket");
  chips(s, ["Webhooks", "CSAT after resolve", "Multi-tenant agencies", "Live Darwinbox tenant", "Kafka + ClickHouse", "WhatsApp"], 0.68, 6.2, 6.8, K.beacon, 8, 0.27, 0.06);
  T(s, [{ text: "GitHub  ", options: { bold: true, color: K.beacon } }, { text: GH, options: { color: K.cobalt, hyperlink: { url: GH } } }, { text: "   ·   source, README, model card", options: { color: K.dim } }], { x: 0.68, y: 6.68, w: 6.8, h: 0.3, fontSize: 10 });

  // Demo video: the hero of this slide
  const VX = 7.85, VW = 5.08, VH = VW * 9 / 16;
  T(s, "WATCH THE DEMO", { x: VX, y: 0.22, w: 3, h: 0.22, fontSize: 9.5, bold: true, color: K.beacon, charSpacing: 2 });
  rect(s, VX - 0.04, 0.48, VW + 0.08, VH + 0.08, K.ink);
  s.addImage({ path: A("video_thumb.jpg"), x: VX, y: 0.52, w: VW, h: VH, sizing: { type: "cover", w: VW, h: VH }, altText: "Demo video", hyperlink: { url: VIDEO, tooltip: "Watch the OpsDesk demo video" } });
  s.addShape(pres.shapes.OVAL, { x: VX + VW / 2 - 0.5, y: 0.52 + VH / 2 - 0.5, w: 1.0, h: 1.0, fill: { color: K.beacon, transparency: 5 }, line: { color: K.white, width: 3 }, hyperlink: { url: VIDEO } });
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: VX + VW / 2 - 0.15, y: 0.52 + VH / 2 - 0.2, w: 0.42, h: 0.4, rotate: 90, fill: { color: K.white }, line: { color: K.white }, hyperlink: { url: VIDEO } });
  rect(s, VX, 0.52 + VH - 0.36, 1.35, 0.28, K.ink);
  T(s, "▶  4:11 · 1080p", { x: VX + 0.08, y: 0.52 + VH - 0.32, w: 1.25, h: 0.2, fontSize: 9, bold: true, color: K.white });

  rect(s, VX, 3.5, VW, 1.0, K.white, K.line);
  rect(s, VX, 3.5, 0.06, 1.0, K.beacon);
  s.addImage({ path: A("video_qr.png"), x: VX + 0.14, y: 3.56, w: 0.88, h: 0.88, altText: "QR code for the demo video", hyperlink: { url: VIDEO } });
  T(s, [{ text: "OpsDesk in 4 minutes", options: { bold: true, fontSize: 12, breakLine: true } }, { text: "Problem → solution → every persona, live → architecture → impact. Narrated, with captions.", options: { color: K.dim, fontSize: 8.5, breakLine: true } }, { text: "Open the video on Google Drive", options: { color: K.cobalt, fontSize: 9, bold: true, hyperlink: { url: VIDEO } } }], { x: VX + 1.15, y: 3.58, w: VW - 1.25, h: 0.88 });

  ipanel(s, VX, 4.62, VW, 2.48, K.violet, "Built and verified", "flask-conical");
  [["347", "commits, small and conventional", K.beacon], ["120+", "unit and API tests passing", K.cobalt], ["12", "Playwright journeys end to end", K.signal], ["97", "Lighthouse performance score", K.violet], ["88%", "intent accuracy, pretrained MiniLM", K.beacon], ["< 1 s", "escalation to the Tower Chief", K.cobalt]].forEach(([v, l, col], i) => {
    const x = VX + 0.2 + (i % 2) * 2.45, y = 5.0 + Math.floor(i / 2) * 0.68;
    T(s, v, { x, y, w: 2.3, h: 0.36, fontFace: "Cambria", fontSize: 18, bold: true, color: col });
    T(s, l, { x, y: y + 0.36, w: 2.35, h: 0.22, fontSize: 8.5, color: K.dim });
  });
  s.addNotes("Team, deliverables, how to run it, what's next, and the demo video on Google Drive.");
}

pres.writeFile({ fileName: OUT }).then(async () => {
  // pptxgenjs emits a stray mid-paragraph <a:pPr><a:buNone/> for every run after the first; it hides the
  // bullet and is invalid DrawingML, so strip it from every slide.
  const fs = require("fs");
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    const xml = await zip.file(name).async("string");
    zip.file(name, xml.replace(/<\/a:r><a:pPr[^>]*>(?:(?!<\/a:pPr>).)*<\/a:pPr>/g, "</a:r>"));
  }
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  if (SKILL) {
    const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
});

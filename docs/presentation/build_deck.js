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
const K = { ink: "0D1117", ink2: "1A212B", paper: "F4F1EA", beacon: "FF5A1F", taxi: "FFC629", cobalt: "2D5BFF", signal: "0C9F6A", alarm: "DF1C47", violet: "6F4CF6", dim: "5A6270", line: "D8D2C4", white: "FFFFFF", soft: "C9D0D8" };
const GH = "https://github.com/SDP42/OpsDesk";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "OpsDesk Control Tower: Idea Submission";
pres.author = "Swayam Panchal, Jeevesh Bodhani, Rishit Lahoti, Shreyas Kale";

// ---------------------------------------------------------------- helpers
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontFace: "Calibri", color: K.ink, valign: "top", ...o });
const card = (s, x, y, w, h, fill = K.white, name = "card") =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.07, fill: { color: fill }, line: { color: fill === K.white ? K.line : fill, width: 0.75 }, objectName: name });
const H = (s, text, x, y, w, color = K.ink) => T(s, text, { x, y, w, h: 0.24, fontSize: 11, bold: true, color });
const sign = (s, x, y, w, text, fill = K.taxi, color = K.ink, size = 9) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.26, rectRadius: 0.05, fill: { color: fill }, line: { color: fill } });
  T(s, text, { x, y: y + 0.035, w, h: 0.2, fontSize: size, bold: true, align: "center", color, fontFace: "Courier New", charSpacing: 1 });
};
const dot = (s, x, y, d, fill, label, color = K.white, size = 9) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  T(s, label, { x, y: y + d / 2 - 0.09, w: d, h: 0.18, fontSize: size, bold: true, color, align: "center" });
};
const img = (s, file, x, y, w, h, name) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.025, y: y - 0.025, w: w + 0.05, h: h + 0.05, rectRadius: 0.04, fill: { color: K.white }, line: { color: K.line, width: 0.75 } });
  s.addImage({ path: A(file), x, y, w, h, sizing: { type: "cover", w, h }, altText: name, objectName: name });
};
const header = (s, title, sub) => {
  T(s, title, { x: 0.35, y: 0.2, w: 12.6, h: 0.42, fontFace: "Cambria", fontSize: 22, bold: true });
  T(s, sub, { x: 0.35, y: 0.62, w: 12.6, h: 0.26, fontSize: 11, color: K.dim, italic: true });
};
const ACC = [K.beacon, K.taxi, K.cobalt, K.signal, K.alarm, K.violet, K.beacon, K.cobalt];

// ============================================================ 1. COVER
{
  const s = pres.addSlide();
  s.background = { color: K.ink };
  img(s, "landing.png", 6.75, 0.55, 6.2, 3.875, "Landing page");
  img(s, "wall.png", 6.75, 4.6, 3.0, 1.875, "Wall Mode");
  img(s, "constellation.png", 9.95, 4.6, 3.0, 1.875, "Constellation");
  sign(s, 0.55, 0.55, 2.3, "TBO VOYAGEHACK", K.taxi);
  sign(s, 2.95, 0.55, 3.25, "PROBLEM STATEMENT 3 · OPSDESK", K.beacon, K.white);
  T(s, "OpsDesk", { x: 0.55, y: 1.05, w: 6, h: 0.9, fontFace: "Cambria", fontSize: 54, bold: true, color: K.white });
  T(s, "Control Tower", { x: 0.55, y: 1.85, w: 6, h: 0.8, fontFace: "Cambria", fontSize: 40, italic: true, color: K.beacon });
  T(s, "Every ticket is a flight.", { x: 0.55, y: 2.7, w: 6, h: 0.45, fontFace: "Cambria", fontSize: 24, color: K.taxi });
  T(s, "A travel-ops ticketing platform for TBO's B2B world, built as an air-traffic control tower: every case linked to its booking, routed with a visible reason, timed to the guest's check-in, and worked with suppliers and HR data instead of around them.", { x: 0.55, y: 3.25, w: 5.9, h: 1.0, fontSize: 13.5, color: "D9DEE5" });
  [["30+", "features shipped"], ["5", "personas"], ["339+", "commits"], ["12", "e2e journeys"], ["97", "Lighthouse perf"], ["88%", "intent accuracy"]].forEach(([v, l], i) => {
    const x = 0.55 + (i % 3) * 2.0, y = 4.35 + Math.floor(i / 3) * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.85, h: 0.88, rectRadius: 0.06, fill: { color: K.ink2 }, line: { color: "2A3340", width: 0.75 } });
    T(s, v, { x: x + 0.12, y: y + 0.06, w: 1.6, h: 0.5, fontFace: "Cambria", fontSize: 26, bold: true, color: i % 2 ? K.taxi : K.beacon });
    T(s, l, { x: x + 0.12, y: y + 0.56, w: 1.65, h: 0.25, fontSize: 10.5, color: "B8C0CA" });
  });
  T(s, [{ text: "Team: ", options: { bold: true, color: K.taxi } }, { text: "Swayam Panchal · Jeevesh Bodhani · Rishit Lahoti · Shreyas Kale", options: { color: K.white } }], { x: 0.55, y: 6.42, w: 6.1, h: 0.3, fontSize: 11.5 });
  T(s, [{ text: "Dept. of AI & Data Science, Dwarkadas J. Sanghvi College of Engineering  ·  ", options: { color: "B8C0CA" } }, { text: GH, options: { color: K.taxi, hyperlink: { url: GH } } }], { x: 0.55, y: 6.75, w: 12.4, h: 0.3, fontSize: 10.5 });
  s.addNotes("Cover. OpsDesk Control Tower reframes TBO ops ticketing as air-traffic control.");
}

// ============================================================ 2. SOLUTION: PS DELIVERABLES + IDEATION
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  header(s, "The solution: every MVP from the brief, plus 8 ideas a helpdesk can't do", "Mapped to OpsDesk MVP-1 to MVP-7, the stretch goals and the technical expectations in the problem statement");

  // MVP table
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
  s.addTable(rows, { x: 0.35, y: 1.0, w: 6.55, colW: [0.9, 2.05, 3.6], rowH: [0.25, 0.44, 0.42, 0.37, 0.42, 0.4, 0.4, 0.4], border: { type: "solid", color: K.line, pt: 0.75 }, fill: { color: K.white }, margin: 0.04 });

  // Stretch + technical expectations
  card(s, 0.35, 4.22, 6.55, 1.02, K.white, "Stretch card");
  H(s, "Stretch goals", 0.48, 4.28, 3.0);
  H(s, "Technical expectations", 3.7, 4.28, 3.1);
  const stretch = [["✓", "Real-time sync (SSE)", K.signal], ["✓", "Stronger auto-intent (MiniLM)", K.signal], ["✓", "Supplier portal thread UX", K.signal], ["✓", "Canned replies → Co-pilot drafts", K.signal], ["○", "Webhooks · CSAT: next", K.dim]];
  stretch.forEach(([i, t, col], k) => T(s, [{ text: i + " ", options: { bold: true, color: col } }, { text: t, options: {} }], { x: 0.48 + (k % 2) * 1.6, y: 4.56 + Math.floor(k / 2) * 0.21, w: 1.6, h: 0.2, fontSize: 8 }));
  const tech = ["Working demo over slides", "README mapped to P1-P6", "Durable store, all records", "Empty / loading / error", "No secrets · strict input"];
  tech.forEach((t, k) => T(s, [{ text: "✓ ", options: { bold: true, color: K.signal } }, { text: t, options: {} }], { x: 3.7 + (k % 2) * 1.6, y: 4.56 + Math.floor(k / 2) * 0.21, w: 1.6, h: 0.2, fontSize: 8 }));

  // Three compact charts
  const chart = (x, title, file, cap, alt) => {
    card(s, x, 5.36, 2.1, 1.94, K.white, alt);
    T(s, title, { x: x + 0.1, y: 5.42, w: 1.9, h: 0.2, fontSize: 9, bold: true });
    s.addImage({ path: A(file), x: x + 0.07, y: 5.64, w: 1.96, h: 1.18, sizing: { type: "contain", w: 1.96, h: 1.18 }, altText: alt, objectName: alt });
    T(s, cap, { x: x + 0.1, y: 6.86, w: 1.9, h: 0.42, fontSize: 7.5, color: K.dim });
  };
  chart(0.35, "Routing reason (P2)", "chart_waterfall.png", "Real Vectoring output: Omar won by 34 pts; every point shown.", "Routing waterfall");
  chart(2.575, "Travel-aware SLA (P4)", "chart_sla_curve.png", "Response time shrinks as the guest's check-in nears.", "SLA curve");
  chart(4.8, "Before vs after", "chart_ba_compact.png", "Measured: context 0→2, intent 76→88%, load 4.7→0.8 s.", "Before after");

  // Unique ideation
  card(s, 7.05, 1.0, 5.93, 3.55, K.white, "Ideation card");
  H(s, "Why it's different: 8 ideas built in, not bolted on", 7.2, 1.07, 5.6);
  const ideas = [
    ["Ghost Flights", "Predicts tickets before they exist (gradient boosting on supplier lag, check-in, rate change); one heads-up dissolves them."],
    ["Storm Cells", "5+ cases on one hotel or supplier in 60 min become one incident; one approved broadcast answers every agency."],
    ["HR-aware routing", "Darwinbox leave and shift sync: nobody on leave gets work; their open cases are re-vectored in one click."],
    ["Follow-the-Sun", "Urgent cases move to the region starting its day, skipping public holidays, with an auto Handoff Brief."],
    ["Breach Forecast", "Monte Carlo 'what if I escalate, reassign or call the supplier now?' before anyone acts."],
    ["Churn early-warning", "Third-Contact Guardian + VADER Frustration Radar raise priority before an agency gives up."],
    ["Explainable by default", "Every route, link, SLA, forecast and ghost shows its 'why'; Agency Mirror previews what the agency sees."],
    ["Voice-first ops floor", "Tower Radio voice assistant, plain-English ⌘K, Wall Mode TV board and a narrated demo Autopilot."],
  ];
  ideas.forEach(([h, d], i) => {
    const x = 7.2 + (i % 2) * 2.9, y = 1.38 + Math.floor(i / 2) * 0.79;
    dot(s, x, y + 0.02, 0.28, ACC[i], String(i + 1), i === 1 ? K.ink : K.white, 9);
    T(s, [{ text: h, options: { bold: true, breakLine: true, fontSize: 9 } }, { text: d, options: { color: K.dim, fontSize: 8 } }], { x: x + 0.36, y, w: 2.45, h: 0.76 });
  });

  // Cost contrast
  card(s, 7.05, 4.67, 5.93, 1.55, K.ink, "Cost card");
  H(s, "Cost & complexity vs 'pay per add-on / TPS API'", 7.2, 4.74, 5.6, K.taxi);
  const cost = [
    ["Paid AI copilot add-on", "Co-pilot Brief + MiniLM intent, local CPU"],
    ["Third-party TBOH-linking app", "Built-in Linker + Constellation"],
    ["Export / API step-ups, 3K cap", "Keyset streaming, no cap, SSE"],
    ["Archive storage add-on", "90-day retention job, Parquet path"],
    ["Chatbot / voice add-on", "Browser speech + Tower Radio"],
  ];
  cost.forEach(([a, b], i) => {
    const y = 5.03 + i * 0.22;
    T(s, a, { x: 7.2, y, w: 2.45, h: 0.2, fontSize: 8, color: "B8C0CA" });
    T(s, "→", { x: 9.62, y, w: 0.25, h: 0.2, fontSize: 8, color: K.beacon, bold: true });
    T(s, b, { x: 9.9, y, w: 3.0, h: 0.2, fontSize: 8, color: K.white, bold: true });
  });

  // Case flow
  card(s, 7.05, 6.34, 5.93, 0.96, K.white, "Flow card");
  H(s, "How one case flows", 7.2, 6.4, 3.0);
  [["File", "TBOH fills dates"], ["Classify", "Intent top-3"], ["Link", "History + Guardian"], ["Vector", "Owner + reason"], ["Clock", "Wheels-up SLA"], ["Resolve", "Escalate · reply"]].forEach(([h, d], i) => {
    const x = 7.2 + i * 0.96;
    dot(s, x, 6.69, 0.24, ACC[i], String(i + 1), i === 1 ? K.ink : K.white, 8);
    T(s, [{ text: h, options: { bold: true, breakLine: true } }, { text: d, options: { color: K.dim } }], { x: x + 0.27, y: 6.66, w: 0.68, h: 0.6, fontSize: 7.5 });
  });
  s.addNotes("Every MVP from the brief with what we built, stretch goals, technical expectations, eight differentiating ideas, a cost contrast versus paid add-ons and the case flow.");
}

// ============================================================ 3. PROTOTYPE, ARCHITECTURE, PERSONAS
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  header(s, "The prototype: 12 live screens, a 4-layer architecture, 6 persona journeys", "Python 3.12 · FastAPI · SQLAlchemy 2 · scikit-learn · MiniLM (ONNX) · VADER · Next.js 15 · React 19 · Tailwind 4 · React Three Fiber · GSAP · Playwright");

  const shots = [
    ["tower.png", "Tower overview"], ["flight.png", "Flight detail + Why"], ["pilot.png", "Pilot flight board"], ["partner.png", "Supplier Partner portal"],
    ["ghosts.png", "Ghost Flights"], ["storms.png", "Storm Cells broadcast"], ["roster.png", "Crew Roster (HRMS)"], ["handoffs.png", "Follow-the-Sun"],
    ["weather.png", "Weather Radar"], ["simulate.png", "Routing simulator"], ["blackbox.png", "Black Box export"], ["wall.png", "Wall Mode"],
  ];
  shots.forEach(([f, cap], i) => {
    const x = 0.35 + (i % 4) * 1.94, y = 1.0 + Math.floor(i / 4) * 1.42;
    img(s, f, x, y, 1.84, 1.12, cap);
    T(s, cap, { x, y: y + 1.14, w: 1.84, h: 0.2, fontSize: 8, bold: true });
  });

  // Detailed architecture
  card(s, 8.1, 1.0, 4.88, 4.22, K.white, "Architecture");
  H(s, "System architecture", 8.25, 1.06, 4.6);
  const box = (y, h, fill, title, body, tc = K.white, bc = "D9DEE5") => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.25, y, w: 4.58, h, rectRadius: 0.05, fill: { color: fill }, line: { color: fill } });
    T(s, [{ text: title + "  ", options: { bold: true, color: tc } }, { text: body, options: { color: bc } }], { x: 8.33, y: y + 0.04, w: 4.42, h: h - 0.06, fontSize: 7.5 });
  };
  box(1.34, 0.42, K.ink2, "CLIENTS", "Landing (scroll-scrubbed footage + R3F) · Tower · Pilot · Partner portal · Wall Mode · Tower Radio voice · ⌘K Ask the Tower");
  box(1.8, 0.4, K.ink, "EDGE · Next.js 15", "same-origin /api proxy · httpOnly cookie · SSE pass-through · security headers · typed client from OpenAPI");
  box(2.24, 0.56, K.beacon, "API · FastAPI", "Auth + RBAC (5 roles) · Tickets · Links · Comments · Frequencies · Partner · Ops (roster, ghosts, storms, handoffs) · Insights · Export · Stream · Assistant · Admin", K.white, "FFE9DF");
  box(2.84, 0.62, K.taxi, "ENGINES · pure, tested, every output has a reason", "Vectoring · Wheels-Up SLA · Linker · Intent (TF-IDF + MiniLM) · Weather · Ghosts (GBM) · Forecast (Monte Carlo) · Storms (networkx) · Roster · Follow-the-Sun · Frustration (VADER) · Promises · Simulator · Ask-the-Tower · Co-pilot · Tower Radio", K.ink, K.ink);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.25, y: 3.5, w: 2.24, h: 0.72, rectRadius: 0.05, fill: { color: K.violet }, line: { color: K.violet } });
  T(s, [{ text: "JOBS · APScheduler  ", options: { bold: true } }, { text: "sla_tick every 60 s → SSE · archive (90 d) · Follow-the-Sun handoffs · Chaos burst", options: { color: "E6E0FF" } }], { x: 8.33, y: 3.54, w: 2.1, h: 0.66, fontSize: 7.5, color: K.white });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.59, y: 3.5, w: 2.24, h: 0.72, rectRadius: 0.05, fill: { color: K.cobalt }, line: { color: K.cobalt } });
  T(s, [{ text: "DATA  ", options: { bold: true } }, { text: "SQLite WAL / PostgreSQL · Alembic · 20 tables · audit_log + timeline on every change", options: { color: "DCE4FF" } }], { x: 10.67, y: 3.54, w: 2.1, h: 0.66, fontSize: 7.5, color: K.white });
  box(4.26, 0.4, K.signal, "EXTERNAL", "Darwinbox HRMS (leave, shifts) · supplier partners · MiniLM ONNX model (local) · holiday calendars");
  T(s, "Scale path: Postgres WAL → Debezium CDC → Kafka → ClickHouse · nightly Parquet · signed URLs above 1M rows", { x: 8.25, y: 4.72, w: 4.6, h: 0.44, fontSize: 7.5, color: K.dim, italic: true });

  // Persona journeys
  const hd = (t) => ({ text: t, options: { bold: true, color: K.white, fill: { color: K.ink }, fontSize: 8.5 } });
  const c = (t, o = {}) => ({ text: t, options: { fontSize: 7.5, color: K.ink, valign: "middle", ...o } });
  const p = (t) => c(t, { bold: true, color: K.beacon, fontSize: 8 });
  const journeys = [
    [hd("Persona (brief)"), hd("Primary need"), hd("Journey in OpsDesk"), hd("Home screen")],
    [p("Agency / Requester · Pilot"), c("Continuity, status, no repeat explanations"), c("Types the problem → TBOH fills check-in/LCD → intent suggested → 'you have 2 earlier cases' → files → tracks status + ETA on the departures board, or asks Tower Radio"), c("/pilot")],
    [p("Ops Agent · Controller"), c("History, links, intent, correct routing, clean threads"), c("Queue sorted by fuel → opens flight with linked history + Guardian banner → reads routing why → Co-pilot Brief + forecast → opens a Frequency to the supplier → replies or escalates (E)"), c("/tower, /tower/queue")],
    [p("Escalation Manager · Tower Chief"), c("Direct escalation, check-in/LCD urgency"), c("Escalation lands in < 1 s with reason → sorted by check-in → accepts, reassigns or resolves → broadcasts one reply to a Storm Cell → Follow-the-Sun at shift end"), c("/tower/escalations")],
    [p("Ops Lead / Governance · Director"), c("Queue health, SLA risk, reporting without limits"), c("Radar + health tiles → simulates routing presets and applies the winner → syncs Darwinbox roster, re-vectors orphans → streams uncapped exports → runs archive"), c("/tower, /simulate, /data")],
    [p("Product / Insights"), c("Recurring themes into the backlog"), c("Weather Radar: 8-week heat map → emerging spike flagged → sample tickets → attaches a Jira or roadmap product link"), c("/tower/insights")],
    [p("Supplier Partner (our addition)"), c("Answer TBO without email chains"), c("Sees only its channels → quick replies ('Confirmed, HCN to follow') → reply lands on the ticket timeline live → tracks its own reply speed"), c("/partner")],
  ];
  s.addTable(journeys, { x: 0.35, y: 5.32, w: 12.63, colW: [2.05, 2.45, 6.83, 1.3], rowH: [0.22, 0.29, 0.29, 0.29, 0.29, 0.27, 0.27], border: { type: "solid", color: K.line, pt: 0.75 }, fill: { color: K.white }, margin: 0.035 });
  s.addNotes("Twelve real screenshots, the four-layer architecture with jobs, data and external integrations, and the journey of every persona the brief names plus our supplier partner.");
}

// ============================================================ 4. THANK YOU
{
  const s = pres.addSlide();
  s.background = { color: K.ink };
  T(s, "Thank you", { x: 0.5, y: 0.35, w: 6, h: 0.8, fontFace: "Cambria", fontSize: 44, bold: true, color: K.white });
  T(s, "Every ticket is a flight, and now someone is watching the tower.", { x: 0.5, y: 1.15, w: 7.6, h: 0.4, fontFace: "Cambria", fontSize: 17, italic: true, color: K.taxi });

  // Team
  ["Swayam Panchal", "Jeevesh Bodhani", "Rishit Lahoti", "Shreyas Kale"].forEach((n, i) => {
    const x = 0.5 + i * 1.95;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 1.85, h: 1.15, rectRadius: 0.07, fill: { color: K.ink2 }, line: { color: "2A3340", width: 0.75 } });
    dot(s, x + 0.12, 1.88, 0.46, ACC[i], n.split(" ").map((w) => w[0]).join(""), i === 1 ? K.ink : K.white, 11);
    T(s, n, { x: x + 0.12, y: 2.4, w: 1.65, h: 0.24, fontSize: 11.5, bold: true, color: K.white });
    T(s, "AI & Data Science · DJSCE", { x: x + 0.12, y: 2.63, w: 1.7, h: 0.2, fontSize: 8.5, color: "B8C0CA" });
  });
  T(s, "Department of Artificial Intelligence and Data Science · Dwarkadas J. Sanghvi College of Engineering, Mumbai", { x: 0.5, y: 3.0, w: 7.7, h: 0.25, fontSize: 10.5, color: K.white });

  // Deliverables checklist
  card(s, 0.5, 3.38, 3.8, 2.3, K.ink2, "Deliverables");
  H(s, "Brief deliverables", 0.65, 3.45, 3.5, K.taxi);
  [
    ["Runnable application", "make setup · make seed · make dev"],
    ["README mapped to P1-P6", "demo accounts, formulas, scale path"],
    ["3-5 min demo script", "Autopilot + journeys A-H, all automated"],
    ["Architecture + cost contrast", "this deck, docs/MODELS.md"],
  ].forEach(([a, b], i) => {
    const y = 3.76 + i * 0.47;
    T(s, "✓", { x: 0.65, y, w: 0.2, h: 0.2, fontSize: 11, bold: true, color: K.signal });
    T(s, [{ text: a, options: { bold: true, color: K.white, breakLine: true } }, { text: b, options: { color: "B8C0CA" } }], { x: 0.9, y, w: 3.3, h: 0.44, fontSize: 9 });
  });

  // Demo accounts
  card(s, 4.4, 3.38, 3.8, 2.3, K.ink2, "Accounts");
  H(s, "Demo accounts (password: cleared-for-takeoff)", 4.55, 3.45, 3.6, K.taxi);
  [["Pilot", "pilot.saf@opsdesk.demo"], ["Controller", "priya.nair@opsdesk.demo"], ["Tower Chief", "rahul.kapoor@opsdesk.demo"], ["Director", "meera.iyer@opsdesk.demo"], ["Supplier", "partner.atlas@opsdesk.demo"]].forEach(([r, e], i) => {
    const y = 3.8 + i * 0.36;
    T(s, r, { x: 4.55, y, w: 1.0, h: 0.22, fontSize: 9, bold: true, color: K.white });
    T(s, e, { x: 5.55, y, w: 2.6, h: 0.22, fontSize: 9, color: K.soft, fontFace: "Courier New" });
  });

  // Next steps + repo
  card(s, 0.5, 5.8, 7.7, 1.25, K.ink2, "Next");
  H(s, "What's next", 0.65, 5.87, 3, K.taxi);
  T(s, "Webhooks for ticket create/update · CSAT after resolve · multi-tenant agencies · live Darwinbox tenant mapping · Kafka + ClickHouse analytics · WhatsApp channel", { x: 0.65, y: 6.13, w: 7.4, h: 0.4, fontSize: 9.5, color: K.soft });
  T(s, [{ text: "GitHub  ", options: { bold: true, color: K.taxi } }, { text: GH, options: { color: K.white, hyperlink: { url: GH } } }, { text: "   ·   open localhost:3000 → 'Take the 90-second flight'", options: { color: K.soft } }], { x: 0.65, y: 6.6, w: 7.4, h: 0.3, fontSize: 10.5 });

  // Proof column
  img(s, "tower.png", 8.45, 0.4, 4.45, 2.0, "Tower");
  img(s, "flight.png", 8.45, 2.55, 2.15, 1.35, "Flight");
  img(s, "pilot.png", 10.75, 2.55, 2.15, 1.35, "Pilot");
  card(s, 8.45, 4.05, 4.45, 3.0, K.ink2, "Stats");
  H(s, "Built and verified", 8.6, 4.12, 4.2, K.taxi);
  [["339+", "commits, all small and conventional"], ["120+", "unit and API tests passing"], ["12", "Playwright journeys end to end"], ["97 / 100", "Lighthouse performance / accessibility"], ["88%", "intent accuracy with pretrained MiniLM"], ["< 1 s", "escalation to the Tower Chief"]].forEach(([v, l], i) => {
    const y = 4.45 + i * 0.42;
    T(s, v, { x: 8.6, y, w: 1.2, h: 0.36, fontFace: "Cambria", fontSize: 17, bold: true, color: i % 2 ? K.taxi : K.beacon });
    T(s, l, { x: 9.85, y: y + 0.08, w: 2.95, h: 0.25, fontSize: 9.5, color: K.soft });
  });
  s.addNotes("Team, deliverables, demo accounts, next steps and the evidence that it all runs.");
}

pres.writeFile({ fileName: OUT }).then(async () => {
  if (SKILL) {
    const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
});

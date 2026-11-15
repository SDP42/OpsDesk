// Builds docs/presentation/OpsDesk_Idea_Submission.pptx (cover + 2 content slides + thank you).
// Run: node docs/presentation/build_deck.js   (from the repo root)
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
const K = { ink: "0D1117", paper: "F4F1EA", beacon: "FF5A1F", taxi: "FFC629", cobalt: "2D5BFF", signal: "0C9F6A", alarm: "DF1C47", violet: "6F4CF6", dim: "5A6270", line: "D8D2C4", white: "FFFFFF", card: "FFFFFF" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "OpsDesk Control Tower: Idea Submission";
pres.author = "Swayam Panchal, Jeevesh Bodhani, Rishit Lahoti, Shreyas Kale";
const GH = "https://github.com/SDP42/OpsDesk";

const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: "Calibri", color: K.ink, valign: "top", ...o });
const card = (slide, x, y, w, h, fill = K.card, name) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: K.line, width: 0.75 }, objectName: name });
const sign = (slide, x, y, w, text, fill = K.taxi, color = K.ink, size = 9) => {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.26, rectRadius: 0.05, fill: { color: fill }, line: { color: fill } });
  T(slide, text, { x, y: y + 0.035, w, h: 0.2, fontSize: size, bold: true, align: "center", color, fontFace: "Courier New", charSpacing: 1 });
};
const dot = (slide, x, y, d, fill, label, color = K.white, size = 10) => {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  T(slide, label, { x, y: y + d / 2 - 0.1, w: d, h: 0.2, fontSize: size, bold: true, color, align: "center" });
};
const img = (slide, file, x, y, w, h, name) => {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, rectRadius: 0.05, fill: { color: K.white }, line: { color: K.line, width: 0.75 } });
  slide.addImage({ path: A(file), x, y, w, h, sizing: { type: "cover", w, h }, altText: name, objectName: name });
};

// ============================================================ 1. COVER
{
  const s = pres.addSlide();
  s.background = { color: K.ink };
  img(s, "landing.png", 6.75, 0.55, 6.2, 3.875, "Landing page screenshot");
  img(s, "wall.png", 6.75, 4.6, 3.0, 1.875, "Wall Mode screenshot");
  img(s, "constellation.png", 9.95, 4.6, 3.0, 1.875, "Constellation screenshot");
  sign(s, 0.55, 0.55, 2.3, "TBO VOYAGEHACK", K.taxi);
  sign(s, 2.95, 0.55, 3.25, "PROBLEM STATEMENT 3 · OPSDESK", K.beacon, K.white);
  T(s, "OpsDesk", { x: 0.55, y: 1.05, w: 6, h: 0.9, fontFace: "Cambria", fontSize: 54, bold: true, color: K.white });
  T(s, "Control Tower", { x: 0.55, y: 1.85, w: 6, h: 0.8, fontFace: "Cambria", fontSize: 40, italic: true, color: K.beacon });
  T(s, "Every ticket is a flight.", { x: 0.55, y: 2.7, w: 6, h: 0.45, fontFace: "Cambria", fontSize: 24, color: K.taxi });
  T(s, "A travel-ops ticketing platform for TBO's B2B world, built as an air-traffic control tower: every case linked to its booking, routed with a visible reason, timed to the guest's check-in, and worked with suppliers and HR data instead of around them.", { x: 0.55, y: 3.25, w: 5.9, h: 1.0, fontSize: 13.5, color: "D9DEE5" });
  const stats = [["30+", "features shipped"], ["5", "personas"], ["339", "commits"], ["12", "e2e journeys"], ["97", "Lighthouse perf"], ["88%", "intent accuracy"]];
  stats.forEach(([v, l], i) => {
    const x = 0.55 + (i % 3) * 2.0, y = 4.35 + Math.floor(i / 3) * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.85, h: 0.88, rectRadius: 0.06, fill: { color: "1A212B" }, line: { color: "2A3340", width: 0.75 } });
    T(s, v, { x: x + 0.12, y: y + 0.06, w: 1.6, h: 0.5, fontFace: "Cambria", fontSize: 26, bold: true, color: i % 2 ? K.taxi : K.beacon });
    T(s, l, { x: x + 0.12, y: y + 0.56, w: 1.65, h: 0.25, fontSize: 10.5, color: "B8C0CA" });
  });
  T(s, [
    { text: "Team: ", options: { bold: true, color: K.taxi } },
    { text: "Swayam Panchal · Jeevesh Bodhani · Rishit Lahoti · Shreyas Kale", options: { color: K.white } },
  ], { x: 0.55, y: 6.42, w: 6.1, h: 0.3, fontSize: 11.5 });
  T(s, [
    { text: "Dept. of AI & Data Science, Dwarkadas J. Sanghvi College of Engineering  ·  ", options: { color: "B8C0CA" } },
    { text: GH, options: { color: K.taxi, hyperlink: { url: GH } } },
  ], { x: 0.55, y: 6.75, w: 12.4, h: 0.3, fontSize: 10.5 });
  s.addNotes("Cover. OpsDesk Control Tower reframes ops ticketing for TBO as air-traffic control. Screens: landing page, Wall Mode, 3D Constellation.");
}

// ============================================================ 2. PROBLEM -> SOLUTION
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  T(s, "Six problems, six working fixes: from isolated tickets to a control tower", { x: 0.4, y: 0.25, w: 12.5, h: 0.45, fontFace: "Cambria", fontSize: 22, bold: true });
  T(s, "Each row is built, unit-tested and demonstrated by an end-to-end journey in the prototype", { x: 0.4, y: 0.7, w: 12.5, h: 0.3, fontSize: 11, color: K.dim, italic: true });

  const head = (t) => ({ text: t, options: { bold: true, color: K.white, fill: { color: K.ink }, fontSize: 10, fontFace: "Calibri" } });
  const cell = (t, o = {}) => ({ text: t, options: { fontSize: 8.5, color: K.ink, fontFace: "Calibri", valign: "middle", ...o } });
  const rows = [
    [head("#"), head("TBO's problem today"), head("OpsDesk solution (built)"), head("Proof in the prototype")],
    [cell("1", { bold: true, color: K.beacon, align: "center", fontSize: 12 }), cell("Tickets without context: no intent, no linkage; the same refund raised 3× = 3 unrelated tickets"), cell("Auto-linking by TBOH (1.0), agency+intent (0.8) and meaning (MiniLM); TF-IDF+MiniLM intent ensemble; Third-Contact Guardian raises priority and alerts the Tower Chief"), cell("Journey A: new refund links both earlier cases, suggests Refund > Delay, fires the Guardian · 5,553 links auto-made")],
    [cell("2", { bold: true, color: K.beacon, align: "center", fontSize: 12 }), cell("Hardcoded FIFO/LIFO triggers; routing ignores region, time, rank and availability"), cell("Vectoring scores region, shift, priority + agency rank, availability, skill and load; 4 presets; every decision stores a score waterfall and a one-line reason + 'why not' runner-ups"), cell("Journey B: Dubai P1 → UAE controller, 'Region match UAE (+40), P1 urgency (+30), on shift (+15)'")],
    [cell("3", { bold: true, color: K.beacon, align: "center", fontSize: 12 }), cell("Side-conversation recipients stuck to the ticket group; break on transfer"), cell("Frequencies with explicit, locked recipients; HandoffDiff confirms who stays/joins/drops; Supplier Partner portal lets the other organisation reply inside OpsDesk"), cell("Journey C: Mumbai → Dubai transfer keeps both suppliers; handoff check on the timeline")],
    [cell("4", { bold: true, color: K.beacon, align: "center", fontSize: 12 }), cell("One-size SLA; escalation only via followers or email"), cell("Wheels-Up clock shrinks as check-in/LCD nears (P1 60m … ×0.25 within 12h); 1-click Escalate (reason required) changes owner + queue; Breach Forecast (Monte Carlo) per action"), cell("Journey D: check-in in 9h → critical → Tower Chief queue in < 1 s, logged")],
    [cell("5", { bold: true, color: K.beacon, align: "center", fontSize: 12 }), cell("Insights trapped in tickets; AI costs extra and needs a human in the loop"), cell("Weather Radar heat map with emerging spikes + product links; Co-pilot Brief; Tower Radio voice assistant; Frustration Radar (VADER): all free, local, explainable"), cell("Journey E: 'Inventory sync' flagged Emerging; zero paid AI calls")],
    [cell("6", { bold: true, color: K.beacon, align: "center", fontSize: 12 }), cell("~3K-row export cap, no realtime, archive/API tax"), cell("Keyset-streamed CSV/NDJSON with live counter, no cap; SSE realtime; 90-day archive job; documented CDC → Kafka → ClickHouse scale path"), cell("Every row streamed (3,040 in 0.15 s); retention run on demand")],
  ];
  s.addTable(rows, { x: 0.4, y: 1.1, w: 7.75, colW: [0.35, 2.0, 3.1, 2.3], rowH: [0.28, 0.58, 0.58, 0.56, 0.58, 0.56, 0.52], border: { type: "solid", color: K.line, pt: 0.75 }, fill: { color: K.white }, margin: 0.05 });

  // Bottom-left: two real engine visuals
  const chartCard = (x, title, file, cap, alt) => {
    card(s, x, 4.92, 3.8, 2.38, K.white, title);
    T(s, title, { x: x + 0.15, y: 5.0, w: 3.5, h: 0.24, fontSize: 11, bold: true });
    s.addImage({ path: A(file), x: x + 0.12, y: 5.27, w: 3.56, h: 1.62, sizing: { type: "contain", w: 3.56, h: 1.62 }, altText: alt, objectName: alt });
    T(s, cap, { x: x + 0.15, y: 6.92, w: 3.5, h: 0.32, fontSize: 8.5, color: K.dim });
  };
  chartCard(0.4, "Explainable routing (Problem 2)", "chart_waterfall.png", "Real Vectoring output for a Dubai P1: every point is shown, and so is why the runners-up lost.", "Routing score waterfall");
  chartCard(4.35, "Travel-aware SLA (Problem 4)", "chart_sla_curve.png", "Deadlines shrink as check-in or LCD nears; within 12 h a case gets a quarter of its normal time.", "SLA urgency curve");

  // Right column: flow, measured deltas, uniqueness
  card(s, 8.3, 1.1, 4.65, 2.1, K.white, "Flow card");
  T(s, "How one case flows through OpsDesk", { x: 8.45, y: 1.18, w: 4.4, h: 0.24, fontSize: 11, bold: true });
  const steps = [
    ["File", "Pilot types; TBOH fills check-in + LCD"],
    ["Classify", "Intent top-3 with confidence"],
    ["Link", "Earlier cases + Third-Contact Guardian"],
    ["Vector", "Best controller, scored with a reason"],
    ["Clock", "Wheels-up SLA, live over SSE"],
    ["Resolve", "Escalate, Frequency, brief, reply"],
  ];
  steps.forEach(([h, d], i) => {
    const x = 8.45 + (i % 2) * 2.25, y = 1.5 + Math.floor(i / 2) * 0.55;
    dot(s, x, y + 0.03, 0.3, [K.beacon, K.taxi, K.cobalt, K.signal, K.alarm, K.violet][i], String(i + 1), i === 1 ? K.ink : K.white, 9);
    T(s, [{ text: h, options: { bold: true, breakLine: true } }, { text: d, options: { color: K.dim } }], { x: x + 0.38, y, w: 1.82, h: 0.5, fontSize: 8.5 });
  });

  card(s, 8.3, 3.33, 4.65, 1.95, K.white, "Measured card");
  T(s, "Before vs after, measured on our build", { x: 8.45, y: 3.41, w: 4.4, h: 0.24, fontSize: 11, bold: true });
  s.addImage({ path: A("chart_ba_compact.png"), x: 8.42, y: 3.7, w: 4.42, h: 1.27, sizing: { type: "contain", w: 4.42, h: 1.27 }, altText: "Before vs after bars", objectName: "Before after compact" });
  T(s, "Journey A context · TF-IDF vs TF-IDF + MiniLM · Lighthouse 64 → 97", { x: 8.45, y: 4.98, w: 4.4, h: 0.24, fontSize: 8.5, color: K.dim });

  card(s, 8.3, 5.41, 4.65, 1.89, K.ink, "Unique card");
  T(s, "Why it's different", { x: 8.45, y: 5.49, w: 4.4, h: 0.24, fontSize: 11, bold: true, color: K.taxi });
  const uniq = [
    ["Proactive:", "Ghost Flights predict tickets; Storm Cells answer 40 agencies at once"],
    ["HR-aware:", "Darwinbox leave and shifts drive routing and handoffs"],
    ["Explainable:", "every route, link, SLA and forecast shows its inputs"],
    ["No paid AI:", "MiniLM, VADER and scikit-learn run locally on CPU"],
  ];
  uniq.forEach(([h, b], i) => {
    T(s, [{ text: h + " ", options: { bold: true, color: K.white } }, { text: b, options: { color: "C9D0D8" } }], { x: 8.45, y: 5.82 + i * 0.37, w: 4.4, h: 0.35, fontSize: 9 });
  });
  s.addNotes("Problems 1-6 from the PS, the feature that solves each, and where the demo proves it. Charts use measured values only.");
}

// ============================================================ 3. PROTOTYPE, ARCHITECTURE, STACK
{
  const s = pres.addSlide();
  s.background = { color: K.paper };
  T(s, "Working prototype: 15 screens, five personas, one explainable engine layer", { x: 0.4, y: 0.25, w: 12.5, h: 0.45, fontFace: "Cambria", fontSize: 22, bold: true });
  T(s, "Next.js 15 + FastAPI monorepo · 120+ unit/API tests · 12 Playwright journeys · Lighthouse 97 / 100 / 96 / 100", { x: 0.4, y: 0.7, w: 12.5, h: 0.3, fontSize: 11, color: K.dim, italic: true });

  // Screenshot grid (left)
  const shots = [
    ["tower.png", "Tower overview: radar, health, SLA risk"],
    ["flight.png", "Flight: links, Guardian, waterfall, forecast"],
    ["ghosts.png", "Ghost Flights: risk + pre-emptive message"],
    ["storms.png", "Storm Cell: 1 broadcast → many agencies"],
    ["roster.png", "Crew Roster: Darwinbox leave, orphans"],
    ["weather.png", "Weather Radar: themes, emerging spikes"],
  ];
  shots.forEach(([f, cap], i) => {
    const x = 0.45 + (i % 3) * 2.62, y = 1.18 + Math.floor(i / 3) * 1.86;
    img(s, f, x, y, 2.5, 1.5, cap);
    T(s, cap, { x, y: y + 1.53, w: 2.5, h: 0.25, fontSize: 8.5, color: K.ink, bold: true });
  });

  // Architecture (right top)
  card(s, 8.4, 1.15, 4.55, 3.65, K.white, "Architecture card");
  T(s, "System architecture", { x: 8.55, y: 1.22, w: 4.3, h: 0.28, fontSize: 11, bold: true });
  const layer = (y, h, fill, title, body, tc = K.white, bc = "D9DEE5") => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.55, y, w: 4.25, h, rectRadius: 0.06, fill: { color: fill }, line: { color: fill } });
    T(s, title, { x: 8.65, y: y + 0.05, w: 4.05, h: 0.22, fontSize: 9.5, bold: true, color: tc });
    T(s, body, { x: 8.65, y: y + 0.26, w: 4.05, h: h - 0.28, fontSize: 8.5, color: bc });
  };
  layer(1.55, 0.62, K.ink, "apps/web · Next.js 15, React 19, Tailwind 4", "Landing (GSAP + Lenis + R3F, scroll-scrubbed footage) · Tower · Pilot · Partner · Wall · ⌘K Ask the Tower · Tower Radio voice");
  s.addShape(pres.shapes.DOWN_ARROW, { x: 10.55, y: 2.18, w: 0.25, h: 0.2, fill: { color: K.beacon }, line: { color: K.beacon } });
  layer(2.4, 0.62, K.beacon, "apps/api · FastAPI, Pydantic v2, RBAC, SSE, APScheduler", "httpOnly JWT, 5 roles, 60+ typed routes, streaming export, sla_tick job, Darwinbox adapter", K.white, "FFE9DF");
  s.addShape(pres.shapes.DOWN_ARROW, { x: 10.55, y: 3.03, w: 0.25, h: 0.2, fill: { color: K.beacon }, line: { color: K.beacon } });
  layer(3.25, 0.82, K.taxi, "app/engines · pure Python, unit-tested, every output has a reason", "Vectoring · Wheels-Up SLA · Linker · Intent (TF-IDF + MiniLM) · Weather · Ghosts (GBM) · Forecast (Monte Carlo) · Storms (networkx) · Roster · Follow-the-Sun · Frustration (VADER) · Promises · Simulator · NLQ", K.ink, K.ink);
  layer(4.12, 0.6, K.cobalt, "SQLite WAL / PostgreSQL · Alembic · 20 tables", "Scale path: WAL → Debezium CDC → Kafka → ClickHouse; Parquet archive", K.white, "DCE4FF");

  // Data charts (right bottom)
  card(s, 8.4, 4.95, 4.55, 2.35, K.white, "Data card");
  s.addImage({ path: A("chart_data.png"), x: 8.5, y: 5.0, w: 4.35, h: 1.63, sizing: { type: "contain", w: 4.35, h: 1.63 }, altText: "Links by type and live SLA mix", objectName: "Data charts" });
  T(s, [
    { text: "Live demo world: ", options: { bold: true } },
    { text: "12 agencies, 4 regions, 37 users, 400 bookings, 3,000 flights, 16.5k timeline events. Seed is relative to 'now'; ", options: {} },
    { text: "make seed", options: { fontFace: "Courier New", bold: true } },
    { text: " in 7 s.", options: {} },
  ], { x: 8.55, y: 6.65, w: 4.3, h: 0.6, fontSize: 8.5, color: K.ink });

  // Bottom-left: personas + stack
  card(s, 0.4, 4.95, 7.85, 2.35, K.ink, "Personas and stack card");
  T(s, "Five personas, each with a home screen", { x: 0.55, y: 5.02, w: 4.0, h: 0.26, fontSize: 11, bold: true, color: K.taxi });
  const personas = [
    ["Pilot", "agency: files with TBOH, sees earlier cases, live departures board"],
    ["Controller", "queue by fuel, links, waterfall, brief, forecast, J/K/E keys"],
    ["Tower Chief", "escalations in < 1 s, Storm broadcast, Follow-the-Sun"],
    ["Airport Director", "simulator, Weather Radar, Black Box, roster, Chaos, Wall"],
    ["Supplier Partner", "external org replies to its channels, sees reply speed"],
  ];
  personas.forEach(([p, d], i) => {
    T(s, [{ text: p + " · ", options: { bold: true, color: K.white } }, { text: d, options: { color: "C9D0D8" } }], { x: 0.55, y: 5.32 + i * 0.36, w: 4.0, h: 0.34, fontSize: 8.5 });
  });
  T(s, "Tech stack (all open source)", { x: 4.75, y: 5.02, w: 3.4, h: 0.26, fontSize: 11, bold: true, color: K.taxi });
  const stack = ["Python 3.12", "FastAPI", "SQLAlchemy 2", "Alembic", "scikit-learn", "MiniLM (ONNX)", "VADER", "networkx", "NumPy", "holidays", "Next.js 15", "React 19", "Tailwind 4", "R3F / three.js", "GSAP + Lenis", "Radix UI", "TanStack Query", "Recharts", "Playwright", "pytest"];
  stack.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 4.75 + col * 1.15, y = 5.33 + row * 0.27;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.1, h: 0.23, rectRadius: 0.04, fill: { color: i % 4 === 0 ? K.beacon : "1F2833" }, line: { color: "2E3946", width: 0.5 } });
    T(s, t, { x, y: y + 0.035, w: 1.1, h: 0.18, fontSize: 7.5, color: K.white, align: "center", bold: true });
  });
  s.addNotes("Real screenshots of the running prototype, the four-layer architecture, live demo data and the full open-source stack.");
}

// ============================================================ 4. THANK YOU
{
  const s = pres.addSlide();
  s.background = { color: K.ink };
  T(s, "Thank you", { x: 0.6, y: 0.55, w: 7, h: 1.0, fontFace: "Cambria", fontSize: 54, bold: true, color: K.white });
  T(s, "Every ticket is a flight, and now someone is watching the tower.", { x: 0.6, y: 1.55, w: 7.4, h: 0.5, fontFace: "Cambria", fontSize: 20, italic: true, color: K.taxi });
  T(s, "Team", { x: 0.6, y: 2.35, w: 4, h: 0.35, fontSize: 14, bold: true, color: K.beacon, fontFace: "Courier New", charSpacing: 2 });
  const team = ["Swayam Panchal", "Jeevesh Bodhani", "Rishit Lahoti", "Shreyas Kale"];
  team.forEach((n, i) => {
    const x = 0.6 + (i % 2) * 3.7, y = 2.8 + Math.floor(i / 2) * 1.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.5, h: 0.9, rectRadius: 0.08, fill: { color: "1A212B" }, line: { color: "2A3340", width: 0.75 } });
    dot(s, x + 0.18, y + 0.2, 0.5, [K.beacon, K.taxi, K.cobalt, K.signal][i], n.split(" ").map((w) => w[0]).join(""), i === 1 ? K.ink : K.white, 12);
    T(s, n, { x: x + 0.85, y: y + 0.18, w: 2.6, h: 0.32, fontSize: 15, bold: true, color: K.white });
    T(s, "AI & Data Science · DJSCE", { x: x + 0.85, y: y + 0.5, w: 2.6, h: 0.25, fontSize: 10, color: "B8C0CA" });
  });
  T(s, "Department of Artificial Intelligence and Data Science\nDwarkadas J. Sanghvi College of Engineering, Mumbai", { x: 0.6, y: 5.0, w: 7.4, h: 0.6, fontSize: 13, color: K.white });
  card(s, 0.6, 5.8, 7.4, 1.15, "1A212B", "Repo card");
  T(s, [
    { text: "GitHub  ", options: { bold: true, color: K.taxi } },
    { text: GH, options: { color: K.white, hyperlink: { url: GH } } },
  ], { x: 0.8, y: 5.92, w: 7.0, h: 0.3, fontSize: 14 });
  T(s, "make setup · make seed · make dev  →  open localhost:3000 and press 'Take the 90-second flight' for the narrated Autopilot demo. Demo password: cleared-for-takeoff", { x: 0.8, y: 6.28, w: 7.0, h: 0.6, fontSize: 10.5, color: "C9D0D8" });

  img(s, "tower.png", 8.4, 0.55, 4.55, 2.85, "Tower overview");
  img(s, "simulate.png", 8.4, 3.6, 4.55, 2.85, "Routing simulator");
  T(s, "Ask us for a live demo: journeys A to H run end to end in under 2 minutes", { x: 8.4, y: 6.6, w: 4.55, h: 0.4, fontSize: 10.5, color: K.taxi, italic: true });
  s.addNotes("Team, college, repository and how to run the demo.");
}

pres.writeFile({ fileName: OUT }).then(async () => {
  if (SKILL) {
    const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
});

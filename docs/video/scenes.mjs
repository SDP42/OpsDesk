// Scene list for the OpsDesk explainer video: narration, highlighted caption words and visuals.
// Shot coordinates are in the 1920x1080 screenshot space (docs/video/shots).
export const VOICE = "en-US-AndrewNeural";
export const RATE = "+4%";

export const scenes = [
  // ---------------------------------------------------------------- the problem
  { type: "kinetic", say: "It is two in the morning in Dubai. A guest has just landed, and the hotel has no record of the booking.",
    hl: ["Dubai", "no record"], lines: [["2:04 AM.", "mono"], ["The guest has landed.", ""], ["The hotel has no booking.", "accent"]] },
  { type: "cards", say: "The travel agency raises a ticket with TBO. Refund delays, lost bookings, missing vouchers. Thousands of them, every day.",
    hl: ["TBO", "every day"], kicker: "What TBO ops sees", title: "Thousands of tickets a day",
    cards: [["Refund delays", "Money stuck between supplier, TBO and agency."], ["Lost bookings", "Hotel cannot find the reservation at check-in."], ["Missing vouchers", "Guest at the counter with nothing to show."]] },
  { type: "cards", say: "But every ticket arrives with no context. The agency explains the same booking three times, to three different people.",
    hl: ["no context", "three times"], kicker: "Problem 1", title: "No memory between tickets",
    cards: [["Ticket 1", "\"Refund for TBOH-88213 not received.\""], ["Ticket 2", "\"Following up on the same refund...\""], ["Ticket 3", "\"Third time asking. Guest keeps calling.\""]] },
  { type: "stamps", say: "Routing is first come, first served. Deadlines ignore the guest's check-in. And reports stop at three thousand rows.",
    hl: ["first come", "check-in", "three thousand"], stamps: ["NO HISTORY", "NO SMART ROUTING", "NO TRAVEL DEADLINE", "3K ROW CAP"] },

  // ---------------------------------------------------------------- the solution
  { type: "brand", say: "So we built OpsDesk Control Tower. Every ticket is treated like a flight: tracked, routed, and timed to land.",
    hl: ["OpsDesk", "flight"] },
  { type: "shots", say: "It opens with a landing page that tells the story in plain words, scene by scene, so anyone understands it in a minute.",
    hl: ["landing page", "plain words"], tag: "00 · LANDING", route: "/", imgs: ["landing_0", "landing_1", "landing_2", "landing_3"] },
  { type: "shots", say: "Linked history. Explainable routing. Deadlines that count down to check-in. And real-time insight for every role.",
    hl: ["Linked", "Explainable", "check-in"], tag: "00 · LANDING", route: "/", imgs: ["landing_4", "landing_6", "landing_7", "landing_8"] },
  { type: "shot", say: "One sign-in, six personas. Role-based access means an agency can never see another agency's tickets.",
    hl: ["six personas", "never"], tag: "SIGN IN", route: "/login", img: "login",
    callouts: [{ t: "Choose your callsign", b: "Pilot, Controller, Tower Chief, Director, Supplier", box: [1180, 760] }, { t: "RBAC in one module", b: "Cross-agency reads return 404, tested", box: [190, 760] }] },

  // ---------------------------------------------------------------- persona 1: agency
  { type: "shot", say: "Meet the Pilot: the travel agency. They type what happened and the booking ID. OpsDesk instantly pulls the hotel, the check-in date, and two earlier cases on the same booking.",
    hl: ["Pilot", "booking ID", "two earlier cases"], tag: "01 · THE PILOT · AGENCY", route: "/pilot", img: "pilot_filled",
    callouts: [{ t: "Booking auto-filled", b: "Hotel, guest, check-in and last cancellation date", at: [1360, 455], box: [180, 330] }, { t: "Third-Contact Guardian", b: "\"You have 2 earlier cases\": continue one, no repeats", at: [1360, 560], box: [180, 520] }] },
  { type: "shot", say: "As they type, a pretrained MiniLM model suggests the intent, with its confidence. Then the case flies onto their departures board.",
    hl: ["MiniLM", "departures board"], tag: "01 · THE PILOT · AGENCY", route: "/pilot", img: "pilot_filled",
    callouts: [{ t: "Intent auto-suggest", b: "TF-IDF + MiniLM ensemble, 88% on hand-written text", at: [1360, 700], box: [180, 640] }, { t: "Departures board", b: "Live status and ETA for every case", at: [700, 400], box: [180, 330] }] },

  // ---------------------------------------------------------------- persona 2: agent
  { type: "shot", say: "Now the Controller, our ops agent. Their queue is sorted by fuel left: how close each guest is to check-in, not who wrote first.",
    hl: ["Controller", "fuel left"], tag: "02 · THE CONTROLLER · AGENT", route: "/tower/queue", img: "queue",
    callouts: [{ t: "Lowest fuel first", b: "Sorted by time left to the guest's check-in", box: [1240, 300] }, { t: "Wheels-Up SLA", b: "Priority × check-in: within 12 h the clock runs 4× faster", box: [1240, 520] }] },
  { type: "shot", say: "Open a flight and the whole story is on one screen. Linked history. The agency's churn risk. A wheels-up clock. And a breach forecast that asks: what if I act now?",
    hl: ["one screen", "breach forecast"], tag: "02 · THE CONTROLLER · AGENT", route: "/tower/t/OD-26434", img: "flight",
    callouts: [{ t: "Linked flights", b: "Same booking 1.00 · same agency + intent 0.80", at: [440, 330], box: [640, 640] }, { t: "Wheels-up clock", b: "Counts down to check-in, not office hours", at: [1715, 330], box: [1100, 230] }, { t: "Breach Forecast", b: "Monte Carlo on 217 past cases: escalate, reassign or call supplier?", at: [1715, 760], box: [1100, 790] }] },
  { type: "shot", say: "Every routing decision explains itself, and the Constellation draws all cases on one booking as a live star map.",
    hl: ["explains itself", "Constellation"], tag: "02 · THE CONTROLLER · AGENT", route: "/tower/links", img: "constellation",
    callouts: [{ t: "Constellation", b: "3D graph of every case linked to TBOH-88213", box: [1240, 640] }, { t: "Why this agent?", b: "Region +40 · urgency +30 · on shift +15 · lowest load +8", box: [190, 640] }] },
  { type: "shot", say: "And anyone can ask the tower in plain English, or simply talk to Tower Radio, our voice assistant.",
    hl: ["plain English", "Tower Radio"], tag: "02 · THE CONTROLLER · AGENT", route: "⌘K", img: "cmdk",
    callouts: [{ t: "Ask the Tower", b: "\"critical refunds in UAE\" becomes filters, with chips that explain them", box: [1180, 500] }, { t: "Tower Radio", b: "Browser speech in, spoken answers out", box: [1180, 720] }] },

  // ---------------------------------------------------------------- persona 3: escalation manager
  { type: "shot", say: "When an agent escalates, the Tower Chief sees it in under a second, with the reason, sorted by check-in.",
    hl: ["Tower Chief", "under a second"], tag: "03 · THE TOWER CHIEF · ESCALATIONS", route: "/tower/escalations", img: "escalations",
    callouts: [{ t: "Escalation in < 1 s", b: "Pushed live over server-sent events", box: [1240, 640] }] },
  { type: "shot", say: "If five agencies report the same hotel within an hour, Storm Cells merge them into one incident, answered with one broadcast.",
    hl: ["Storm Cells", "one broadcast"], tag: "03 · THE TOWER CHIEF · ESCALATIONS", route: "/tower/storms", img: "storms",
    callouts: [{ t: "Storm Cell", b: "5+ cases · one supplier · 60 minutes → one incident", box: [190, 700] }] },
  { type: "shot", say: "At shift end, Follow-the-Sun hands urgent cases to the region starting its day, skipping public holidays, with a written handoff brief.",
    hl: ["Follow-the-Sun", "handoff brief"], tag: "03 · THE TOWER CHIEF · ESCALATIONS", route: "/tower/handoffs", img: "handoffs",
    callouts: [{ t: "Follow-the-Sun", b: "India → UAE → UK → Singapore, holiday calendars built in", box: [1240, 700] }] },

  // ---------------------------------------------------------------- persona 4: ops lead
  { type: "shot", say: "The Director, our ops lead, sees the whole airspace: live radar, SLA risk and queue health.",
    hl: ["Director", "whole airspace"], tag: "04 · THE DIRECTOR · OPS LEAD", route: "/tower", img: "tower",
    callouts: [{ t: "Airspace radar", b: "Every open case, coloured by SLA state", box: [190, 700] }] },
  { type: "shot", say: "Crew Roster syncs leave and shifts from Darwinbox HR. Nobody on leave gets work, and their open cases are re-routed in one click.",
    hl: ["Darwinbox", "one click"], tag: "04 · THE DIRECTOR · OPS LEAD", route: "/tower/roster", img: "roster",
    callouts: [{ t: "HR-aware routing", b: "Darwinbox adapter, live or simulated", box: [1240, 640] }] },
  { type: "shot", say: "Ghost Flights predicts which bookings will turn into tickets, so the team can fix them before the agency even writes in.",
    hl: ["Ghost Flights", "before"], tag: "04 · THE DIRECTOR · OPS LEAD", route: "/tower/ghosts", img: "ghosts",
    callouts: [{ t: "Ghost Flights", b: "Gradient boosting on supplier lag, check-in and rate changes", box: [1240, 700] }] },
  { type: "shot", say: "The simulator replays a real day under four routing rules, so leads pick the winner with evidence, not guesswork.",
    hl: ["simulator", "evidence"], tag: "04 · THE DIRECTOR · OPS LEAD", route: "/tower/simulate", img: "simulate",
    callouts: [{ t: "Replay the day", b: "4 parallel lanes per controller, in-flight load", box: [190, 700] }] },
  { type: "shot", say: "And the Black Box streams exports with no three-thousand-row cap, sixty thousand rows and beyond.",
    hl: ["no", "sixty thousand"], tag: "04 · THE DIRECTOR · OPS LEAD", route: "/tower/data", img: "data",
    callouts: [{ t: "Uncapped export", b: "Keyset streaming CSV / NDJSON with a live counter", box: [1240, 700] }] },

  // ---------------------------------------------------------------- persona 5 + 6
  { type: "shot", say: "For the product team, Weather Radar turns ticket themes into a heat map and flags emerging spikes.",
    hl: ["Weather Radar", "emerging"], tag: "05 · PRODUCT · INSIGHTS", route: "/tower/insights", img: "insights",
    callouts: [{ t: "Emerging theme", b: "z-score ≥ 2.5 and 2.5× the 4-week mean", box: [1240, 720] }] },
  { type: "shot", say: "Suppliers get their own portal. They reply on the ticket itself, instead of in long email chains.",
    hl: ["Suppliers", "on the ticket"], tag: "06 · SUPPLIER PARTNER", route: "/partner", img: "partner",
    callouts: [{ t: "Partner portal", b: "Sees only its own channels, quick replies", box: [1240, 640] }] },
  { type: "shot", say: "And on the ops floor, Wall Mode puts the live board on a TV.",
    hl: ["Wall Mode"], tag: "WALL MODE", route: "/wall", img: "wall", callouts: [] },

  // ---------------------------------------------------------------- under the hood
  { type: "arch", say: "Under the hood, a Next.js front end talks to a FastAPI back end over REST, with live updates over server-sent events.",
    hl: ["Next.js", "FastAPI", "server-sent events"] },
  { type: "engines", say: "Sixteen pure engines handle routing, deadlines, linking and forecasting, and every single output carries a human-readable reason.",
    hl: ["Sixteen", "reason"] },
  { type: "stack", say: "Pretrained models run on a laptop CPU, data lives in SQLite or Postgres, and Darwinbox plugs in for HR. No paid add-ons.",
    hl: ["laptop CPU", "No paid"] },

  // ---------------------------------------------------------------- impact + close
  { type: "stats", say: "The result: zero repeat explanations, escalations in under a second, and intent accuracy up from seventy-six to eighty-eight percent.",
    hl: ["zero", "under a second", "eighty-eight"] },
  { type: "end", say: "OpsDesk Control Tower. Every ticket is a flight, and every flight lands on time. Built by Swayam Panchal, Jeevesh Bodhani, Rishit Lahoti and Shreyas Kale.",
    hl: ["OpsDesk", "on time"] },
];

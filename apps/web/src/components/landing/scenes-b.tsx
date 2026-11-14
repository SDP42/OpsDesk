"use client";

/** Scenes 6-10 (Problems 3, 5, 6 and the close), on the shared SceneGrid. */
import { clsx } from "clsx";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTowerCalls } from "@/lib/stores/tower-calls";
import { Magnetic } from "./crosshair-cursor";
import { Scene, SceneCopy, SceneGrid, useSceneProgress } from "./scene";
import { InstrumentBay } from "./scenes-a";
import { SceneBackdrop } from "./backdrop";

const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

/* ---------------------------------------------------------------- 6 */

function Waveform({ color, seed, speed }: { color: string; seed: number; speed: number }) {
  const d = useMemo(() => {
    let path = "M0 40";
    for (let x = 0; x <= 1200; x += 12) {
      const y = 40 + Math.sin(x / (30 + seed * 7)) * (14 + seed * 3) * Math.sin(x / 210 + seed);
      path += ` L${x} ${y.toFixed(1)}`;
    }
    return path;
  }, [seed]);
  return (
    <svg
      viewBox="0 0 600 80"
      preserveAspectRatio="none"
      className="h-14 w-full overflow-hidden"
      aria-hidden
    >
      <g
        className="motion-safe:animate-[wave_6s_linear_infinite]"
        style={{ animationDuration: `${speed}s` }}
      >
        <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
        <path d={d} fill="none" stroke={color} strokeWidth="8" opacity="0.12" />
      </g>
    </svg>
  );
}

const LANES = [
  { name: "Agency", color: "var(--color-ice)", chips: ["Saffron Trails ops"] },
  {
    name: "Supplier",
    color: "var(--color-beacon)",
    chips: ["Atlas Bedbank", "Crescent Rooms DMC"],
  },
  { name: "Internal", color: "var(--color-signal)", chips: ["Finance Desk", "Priya · IN-01"] },
];

export function FrequenciesScene() {
  const { progress, rich } = useSceneProgress();
  const drag = rich ? seg(progress, 0.35, 0.7) : 1;
  const diff = rich ? progress > 0.72 : true;
  return (
    <Scene index={6} length={220} label="Frequencies">
      <SceneBackdrop sequence="cockpit" callsign="FREQ 118.40" />
      <SceneGrid
        copy={
          <SceneCopy
            n={6}
            problem="3"
            eyebrow="Frequencies"
            title={
              <>
                Radio channels that <em className="text-beacon">survive a handoff.</em>
              </>
            }
          >
            A side conversation has its own explicit recipients, not the ticket group. Transfer the
            flight from Mumbai to Dubai and the supplier pills stay locked; a handoff check shows
            who stays, who joins and who drops.
            <div data-reveal className="mt-8 flex items-center gap-3 font-mono text-sm">
              <span className="sign sign-dark">OD-24817</span>
              <span>India Ops</span>
              <ArrowRight size={14} />
              <span
                className={clsx("transition-colors", drag > 0.9 ? "text-signal" : "text-text-dim")}
              >
                UAE Ops
              </span>
            </div>
          </SceneCopy>
        }
        visual={
          <div data-reveal="frame" className="flex flex-col gap-3">
            {LANES.map((lane, i) => (
              <div key={lane.name} className="hud px-5 py-4">
                <span className="hud-tr" aria-hidden />
                <span className="hud-bl" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="micro w-20 !font-semibold" style={{ color: lane.color }}>
                    {lane.name}
                  </span>
                  {lane.chips.map((c) => {
                    const dropped = c.startsWith("Priya") && drag > 0.9;
                    return (
                      <span
                        key={c}
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-all",
                          dropped && "line-through opacity-40",
                        )}
                        style={{ borderColor: lane.color, color: lane.color }}
                      >
                        {!c.startsWith("Priya") && <Lock size={10} />} {c}
                      </span>
                    );
                  })}
                  {lane.name === "Internal" && (
                    <span
                      className={clsx(
                        "bg-signal inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-white transition-all duration-500",
                        drag > 0.9 ? "scale-100 opacity-100" : "scale-75 opacity-0",
                      )}
                    >
                      + Omar · AE-01
                    </span>
                  )}
                </div>
                <Waveform color={lane.color} seed={i + 1} speed={5 + i * 2} />
              </div>
            ))}
            <div
              className={clsx(
                "hud flex items-center justify-between gap-3 p-4 transition-all duration-500",
                diff ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
            >
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <div>
                <span className="sign">Handoff check</span>
                <p className="mt-2 font-mono text-sm">4 stayed · 1 added · 1 dropped</p>
              </div>
              <span className="btn btn-signal">Confirm handoff</span>
            </div>
          </div>
        }
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 7 */

const THEMES = [
  {
    label: "Inventory sync",
    count: 36,
    delta: "+412%",
    emerging: true,
    color: "var(--color-alarm)",
  },
  { label: "Refund delay", count: 58, delta: "+8%", color: "var(--color-beacon)" },
  { label: "Voucher issue", count: 41, delta: "-3%", color: "var(--color-ice)" },
  { label: "Supplier silence", count: 29, delta: "+11%", color: "var(--color-signal)" },
];

export function WeatherScene() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? seg(progress, 0.05, 0.6) : 1;
  return (
    <Scene index={7} length={160} label="Weather radar">
      <SceneBackdrop sequence="clouds" callsign="WX · INV-SYNC" />
      <SceneGrid
        copy={
          <SceneCopy
            n={7}
            problem="5"
            eyebrow="Weather radar"
            title={
              <>
                Hear the weather <em className="text-ice">before the storm.</em>
              </>
            }
          >
            Conversations become themes with week-over-week change and an emerging badge from a
            z-score spike: a product roadmap built from what agencies actually say, with no paid AI
            add-on.
            <ul className="mt-8 flex flex-col gap-2.5">
              {THEMES.map((t) => (
                <li
                  key={t.label}
                  className="border-line grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b pb-2.5"
                >
                  <span className="text-text flex items-center gap-2 text-[15px]">
                    <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                    {t.label}
                    {t.emerging && (
                      <span className="sign !bg-alarm !py-0 !text-[10px] !text-white">
                        Emerging
                      </span>
                    )}
                  </span>
                  <span className="text-text tabular font-mono text-sm">
                    {Math.round(t.count * p)}
                  </span>
                  <span className="w-14 text-right font-mono text-[11px]">{t.delta}</span>
                </li>
              ))}
            </ul>
          </SceneCopy>
        }
        visual={<InstrumentBay caption="Themes this week" />}
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 8 */

const ROW_AGENCIES = [
  "Saffron Trails",
  "Dune & Dhow",
  "Thames Gate",
  "Lion City",
  "Monsoon Hol.",
  "Gulf Horizon",
];
const ROW_INTENTS = [
  "refund.delay",
  "voucher.not_received",
  "supplier.overbooking",
  "rates.mismatch",
  "cancellation.request",
];

export function BlackBoxScene() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? seg(progress, 0.05, 0.9) : 1;
  const rows = Math.round(60000 * p);
  const lines = useMemo(
    () =>
      Array.from({ length: 13 }, (_, k) => {
        const i = rows - k;
        if (i <= 0) return "";
        return `OD-${24000 + i},"${ROW_AGENCIES[i % 6]}",${["IN", "AE", "UK", "SEA"][i % 4]},${ROW_INTENTS[i % 5]},P${(i % 4) + 1},${["closed", "resolved", "open"][i % 3]}`;
      }),
    [rows],
  );
  return (
    <Scene index={8} length={150} label="Black box">
      <SceneBackdrop sequence="baggage" callsign="EXPORT 60K" />
      <SceneGrid
        copy={
          <SceneCopy
            n={8}
            problem="6"
            eyebrow="Black box"
            title={
              <>
                Your data, <em className="text-signal">uncapped.</em>
              </>
            }
          >
            <span className="text-text text-2xl">
              <span className="text-text-dim decoration-alarm line-through decoration-2">
                3,000-row cap
              </span>{" "}
              → no cap
            </span>
            <p className="mt-4">
              Keyset-paginated streaming CSV and NDJSON, flat memory, a live SSE feed and a written
              retention stance: hot for 90 days, then archive, then cold Parquet.
            </p>
            <p className="display text-text tabular mt-8 text-[clamp(3.4rem,7vw,6rem)]">
              {rows.toLocaleString("en-US")}
            </p>
            <p className="micro mt-1">rows streamed</p>
          </SceneCopy>
        }
        visual={
          <div
            data-reveal="frame"
            className="bg-night overflow-hidden rounded-2xl p-5 font-mono text-[11px] leading-6 text-white/60 shadow-[var(--shadow-lift)]"
          >
            <div className="mb-3 flex items-center gap-1.5">
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
              ))}
              <span className="ml-3 text-white/40">black-box · export stream</span>
            </div>
            <p className="text-taxi">$ curl -N /api/export/tickets?format=csv</p>
            {lines.map((l, i) => (
              <p key={i} className={clsx("truncate", i === 0 && "text-white")}>
                {l || " "}
              </p>
            ))}
          </div>
        }
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 9 */

const DEMO = [
  {
    n: "OD-24817",
    t: "Refund for TBOH-88213 still not received",
    a: "Saffron Trails",
    s: "critical",
    f: 0.12,
    ci: "T-9h",
  },
  {
    n: "OD-24818",
    t: "Guest walked from Palm Crescent",
    a: "Dune & Dhow",
    s: "at_risk",
    f: 0.33,
    ci: "T-1d",
  },
  {
    n: "OD-24819",
    t: "Voucher missing for Thames View",
    a: "Thames Gate",
    s: "ok",
    f: 0.81,
    ci: "T-6d",
  },
  {
    n: "OD-24820",
    t: "Rate mismatch on Raffles Quay",
    a: "Lion City",
    s: "ok",
    f: 0.64,
    ci: "T-12d",
  },
];
const C: Record<string, string> = {
  ok: "var(--color-signal)",
  at_risk: "var(--color-amber)",
  critical: "var(--color-critical)",
  escalated: "var(--color-alarm)",
};

export function TryItLiveScene() {
  const [escalated, setEscalated] = useState<string[]>([]);
  const push = useTowerCalls((s) => s.push);
  return (
    <Scene index={9} length={100} label="Try it live">
      <SceneBackdrop sequence="checkin" callsign="PILOT DESK" />
      <SceneGrid
        copy={
          <SceneCopy
            n={9}
            eyebrow="Try it live"
            title={
              <>
                Work a flight <em className="text-beacon">right here.</em>
              </>
            }
          >
            These are real Flight Strips: a fuel bar on the edge, check-in countdown and one-click
            escalation. Hit Escalate and watch the tower call come in.
          </SceneCopy>
        }
        visual={
          <div
            data-reveal="frame"
            className="border-line rounded-[22px] border bg-white p-2 shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-center gap-1.5 px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="bg-ink-700 size-2.5 rounded-full" />
              ))}
              <span className="micro ml-3">opsdesk / tower / my queue</span>
            </div>
            <div className="bg-ink-950 flex flex-col gap-2 rounded-2xl p-3">
              {DEMO.map((d) => {
                const esc = escalated.includes(d.n);
                const state = esc ? "escalated" : d.s;
                return (
                  <div
                    key={d.n}
                    className="border-line flex min-h-14 items-stretch overflow-hidden rounded-xl border bg-white"
                  >
                    <div className="bg-ink-700 relative w-1.5 shrink-0">
                      <div
                        className="absolute inset-x-0 bottom-0 transition-all duration-500"
                        style={{ background: C[state], height: `${esc ? 100 : d.f * 100}%` }}
                      />
                    </div>
                    <div className="grid flex-1 grid-cols-[86px_1fr_auto] items-center gap-3 px-3 py-2">
                      <span className="font-mono text-[13px] font-semibold">{d.n}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{d.t}</span>
                        <span className="micro">
                          {d.a} · {d.ci}
                        </span>
                      </span>
                      <button
                        className={clsx(
                          "btn !px-3 !py-1.5 !text-[10px]",
                          esc ? "!border-alarm !bg-alarm !text-white" : "btn-alarm",
                        )}
                        disabled={esc}
                        onClick={() => {
                          setEscalated((e) => [...e, d.n]);
                          push({
                            callsign: d.n,
                            message: "ESCALATED > TOWER CHIEF RAHUL KAPOOR",
                            tone: "alarm",
                          });
                        }}
                      >
                        {esc ? "Tower Chief" : "Escalate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 10 */

interface Credit {
  title: string;
  source: string;
  url: string;
  license: string;
  license_url: string;
}

const ROLES = ["Pilot", "Controller", "Tower Chief", "Airport Director"];

export function ClearedScene() {
  const [credits, setCredits] = useState<Credit[]>([]);
  useEffect(() => {
    fetch("/credits.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCredits)
      .catch(() => setCredits([]));
  }, []);
  return (
    <Scene index={10} length={150} label="Cleared for takeoff">
      <SceneBackdrop sequence="a" reverse callsign="RWY 27L" coords={[51.4775, -0.4614]} />
      <div className="relative z-[3] flex h-full flex-col">
        <SceneGrid
          copy={
            <SceneCopy
              n={10}
              eyebrow="Cleared for takeoff"
              title={
                <>
                  Every ticket is a flight. Now someone is{" "}
                  <em className="text-beacon">watching the tower.</em>
                </>
              }
            >
              <div className="mt-2 flex flex-wrap gap-2">
                <Magnetic>
                  <Link href="/login" className="btn btn-signal !px-7 !py-4 !text-[13px]">
                    Enter the Tower <ArrowRight size={15} />
                  </Link>
                </Magnetic>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <Link
                    key={r}
                    href="/login"
                    className="sign !text-text ring-line hover:!bg-taxi !bg-transparent ring-1 transition"
                  >
                    {r}
                  </Link>
                ))}
              </div>
            </SceneCopy>
          }
          visual={<div />}
        />
        <footer className="border-line mx-auto w-full max-w-[1320px] border-t px-5 py-5 sm:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ul className="text-text-dim flex flex-col gap-1 text-[12px]">
              <li className="micro">Footage credits</li>
              {credits.map((c) => (
                <li key={c.url}>
                  <a
                    href={c.url}
                    className="decoration-line hover:text-text underline underline-offset-2"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {c.title}
                  </a>{" "}
                  · {c.source} ·{" "}
                  <a
                    href={c.license_url}
                    className="hover:text-text"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {c.license}
                  </a>
                </li>
              ))}
            </ul>
            <p className="micro">OpsDesk Control Tower · built for TBO · fictional demo data</p>
          </div>
        </footer>
      </div>
    </Scene>
  );
}

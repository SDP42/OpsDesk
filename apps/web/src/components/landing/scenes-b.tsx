"use client";

/** Scenes 6-10 of the scroll story (Problems 3, 5, 6 and the close). */
import { clsx } from "clsx";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTowerCalls } from "@/lib/stores/tower-calls";
import { Magnetic } from "./crosshair-cursor";
import { FrameScrubber } from "./frame-scrubber";
import { Scene, SceneTag, useSceneProgress } from "./scene";

const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

function Title({ n, problem, eyebrow, children }: { n: number; problem?: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <SceneTag n={n} problem={problem}>
        {eyebrow}
      </SceneTag>
      <h2 className="mt-5 font-serif text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.95]">{children}</h2>
    </>
  );
}

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
    <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="h-16 w-full overflow-visible" aria-hidden>
      <g className="motion-safe:animate-[wave_6s_linear_infinite]" style={{ animationDuration: `${speed}s` }}>
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" opacity="0.9" />
        <path d={d} fill="none" stroke={color} strokeWidth="6" opacity="0.12" />
      </g>
    </svg>
  );
}

const LANES = [
  { name: "Agency", color: "var(--color-ice)", chips: ["Saffron Trails ops"] },
  { name: "Supplier", color: "var(--color-amber)", chips: ["Atlas Bedbank", "Crescent Rooms DMC"] },
  { name: "Internal", color: "var(--color-signal)", chips: ["Finance Desk", "Priya · IN-01"] },
];

export function FrequenciesScene() {
  const { progress, rich } = useSceneProgress();
  const shift = rich ? seg(progress, 0.05, 0.75) : 0;
  const drag = rich ? seg(progress, 0.55, 0.8) : 1;
  const diff = rich ? progress > 0.82 : true;
  return (
    <Scene index={6} length={300} label="Frequencies">
      <div className="flex h-full items-center">
        <div
          className={clsx("flex h-full items-center gap-[8vw] px-5 sm:px-10", rich ? "w-[220vw]" : "w-full flex-col")}
          style={{ transform: rich ? `translateX(${-shift * 120}vw)` : undefined }}
        >
          <div className="w-full max-w-xl shrink-0">
            <Title n={6} problem="3" eyebrow="Frequencies">
              Radio channels that <em className="text-amber">survive a handoff.</em>
            </Title>
            <p className="mt-6 text-lg text-text/80">
              A side conversation has its own explicit recipients, not the ticket group. Transfer the flight from Mumbai to Dubai and the
              supplier pills stay locked; a handoff check shows exactly who stays, who joins and who drops.
            </p>
          </div>
          <div className="flex w-full max-w-4xl shrink-0 flex-col gap-6">
            {LANES.map((lane, i) => (
              <div key={lane.name} className="hud px-5 py-4">
                <span className="hud-tr" aria-hidden />
                <span className="hud-bl" aria-hidden />
                <div className="flex items-center gap-3">
                  <span className="micro w-20" style={{ color: lane.color }}>
                    {lane.name}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {lane.chips.map((c) => {
                      const dropped = c.startsWith("Priya") && drag > 0.9;
                      return (
                        <span
                          key={c}
                          className={clsx("inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px]", dropped && "line-through opacity-50")}
                          style={{ borderColor: lane.color, color: lane.color }}
                        >
                          {!c.startsWith("Priya") && <Lock size={10} />} {c}
                        </span>
                      );
                    })}
                    {lane.name === "Internal" && drag > 0.9 && (
                      <span className="inline-flex items-center gap-1.5 border border-signal px-2 py-1 font-mono text-[11px] text-signal ring-1 ring-signal">
                        Omar · AE-01 · added
                      </span>
                    )}
                  </div>
                </div>
                <Waveform color={lane.color} seed={i + 1} speed={5 + i * 2} />
              </div>
            ))}
          </div>
          <div className="relative w-full max-w-md shrink-0">
            <div className="hud p-5" style={{ transform: `translateX(${drag * 40}px) rotate(${(1 - drag) * -2}deg)` }}>
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <p className="micro">Transfer</p>
              <p className="mt-2 font-mono text-lg">OD-24817</p>
              <p className="mt-1 text-sm text-text-dim">
                India Ops <ArrowRight className="inline" size={12} /> <span className={drag > 0.9 ? "text-signal" : ""}>UAE Ops</span>
              </p>
            </div>
            <div className={clsx("hud mt-4 p-5 transition-all duration-500", diff ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <p className="micro !text-amber">Handoff check</p>
              <p className="mt-2 font-mono text-sm">4 stayed · 1 added · 1 dropped</p>
              <button className="btn btn-signal mt-3" tabIndex={-1}>
                Confirm handoff
              </button>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}

/* ---------------------------------------------------------------- 7 */

const THEMES = [
  { label: "Inventory sync", count: 36, delta: "+412%", emerging: true, color: "var(--color-alarm)" },
  { label: "Refund delay", count: 58, delta: "+8%", color: "var(--color-amber)" },
  { label: "Voucher issue", count: 41, delta: "-3%", color: "var(--color-ice)" },
  { label: "Supplier silence", count: 29, delta: "+11%", color: "var(--color-signal)" },
];

export function WeatherScene() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? seg(progress, 0.05, 0.5) : 1;
  return (
    <Scene index={7} length={200} label="Weather radar" wipe>
      <div className="relative mx-auto grid h-full max-w-7xl items-center px-5 sm:px-10 lg:grid-cols-2">
        <div>
          <Title n={7} problem="5" eyebrow="Weather radar">
            Hear the weather <em className="text-ice">before the storm.</em>
          </Title>
          <p className="mt-6 max-w-xl text-lg text-text/80">
            Conversations become themes with week-over-week change and an emerging badge from a z-score spike. A product roadmap built
            from what agencies actually say, with no paid AI add-on.
          </p>
          <ul className="mt-8 flex max-w-md flex-col gap-2">
            {THEMES.map((t, i) => (
              <li key={t.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line/70 pb-2" style={{ opacity: seg(p, i * 0.15, i * 0.15 + 0.4) }}>
                <span className="flex items-center gap-2 text-sm">
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  {t.label}
                  {t.emerging && <span className="animate-pulse-alarm border border-alarm px-1.5 font-mono text-[10px] text-alarm">EMERGING</span>}
                </span>
                <span className="font-mono text-sm tabular">{Math.round(t.count * p)}</span>
                <span className="w-14 text-right font-mono text-[11px] text-text-dim">{t.delta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Scene>
  );
}

/* ---------------------------------------------------------------- 8 */

const ROW_AGENCIES = ["Saffron Trails", "Dune & Dhow", "Thames Gate", "Lion City", "Monsoon Hol.", "Gulf Horizon"];
const ROW_INTENTS = ["refund.delay", "voucher.not_received", "supplier.overbooking", "rates.mismatch", "cancellation.request"];

export function BlackBoxScene() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? seg(progress, 0.05, 0.85) : 1;
  const rows = Math.round(60000 * p);
  const lines = useMemo(
    () =>
      Array.from({ length: 14 }, (_, k) => {
        const i = rows - k;
        if (i <= 0) return "";
        return `OD-${24000 + i},"${ROW_AGENCIES[i % 6]}",${["IN", "AE", "UK", "SEA"][i % 4]},${ROW_INTENTS[i % 5]},P${(i % 4) + 1},${["closed", "resolved", "open"][i % 3]}`;
      }),
    [rows],
  );
  return (
    <Scene index={8} length={140} label="Black box">
      <div className="relative mx-auto grid h-full max-w-7xl items-center gap-10 px-5 sm:px-10 lg:grid-cols-2">
        <div>
          <Title n={8} problem="6" eyebrow="Black box">
            Your data, <em className="text-signal">uncapped.</em>
          </Title>
          <p className="mt-6 text-2xl">
            <span className="text-text-dim line-through decoration-alarm decoration-2">3,000-row cap</span>{" "}
            <span className="font-mono text-signal">→ no cap</span>
          </p>
          <p className="mt-4 max-w-lg text-lg text-text/80">
            Keyset-paginated streaming CSV and NDJSON, flat memory, a live SSE feed, and a written retention stance: hot for 90 days,
            then archive, then cold Parquet.
          </p>
          <p className="mt-8 font-mono text-[clamp(3rem,8vw,6rem)] leading-none text-signal tabular">{rows.toLocaleString("en-US")}</p>
          <p className="micro mt-2">rows streamed · GET /api/export/tickets?format=csv</p>
        </div>
        <div className="hud scanline overflow-hidden p-4 font-mono text-[11px] leading-6 text-text-dim">
          <span className="hud-tr" aria-hidden />
          <span className="hud-bl" aria-hidden />
          <p className="text-signal">$ curl -N /api/export/tickets?format=csv | tail -f</p>
          {lines.map((l, i) => (
            <p key={i} className={clsx("truncate", i === 0 && "text-text")}>
              {l || " "}
            </p>
          ))}
        </div>
      </div>
    </Scene>
  );
}

/* ---------------------------------------------------------------- 9 */

const DEMO = [
  { n: "OD-24817", t: "Refund for TBOH-88213 still not received", a: "Saffron Trails", s: "critical", f: 0.12, ci: "T-9h 04m" },
  { n: "OD-24818", t: "Guest walked from Palm Crescent, overbooked", a: "Dune & Dhow", s: "at_risk", f: 0.33, ci: "T-1d 2h" },
  { n: "OD-24819", t: "Voucher missing for Thames View booking", a: "Thames Gate", s: "ok", f: 0.81, ci: "T-6d 11h" },
  { n: "OD-24820", t: "Rate mismatch on Raffles Quay invoice", a: "Lion City", s: "ok", f: 0.64, ci: "T-12d" },
];
const C: Record<string, string> = { ok: "var(--color-signal)", at_risk: "var(--color-amber)", critical: "var(--color-critical)", escalated: "var(--color-alarm)" };

export function TryItLiveScene() {
  const [escalated, setEscalated] = useState<string[]>([]);
  const push = useTowerCalls((s) => s.push);
  return (
    <Scene index={9} length={100} label="Try it live">
      <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-5 sm:px-10">
        <Title n={9} eyebrow="Try it live">
          Work a flight <em className="text-signal">right here.</em>
        </Title>
        <div className="mt-8 rounded-[14px] border border-line bg-ink-900 p-2 shadow-[0_0_80px_-30px_var(--color-signal)]">
          <div className="flex items-center gap-1.5 px-2 pb-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-ink-700" />
            ))}
            <span className="micro ml-3">opsdesk / tower / my queue</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-ink-950 p-3">
            {DEMO.map((d) => {
              const esc = escalated.includes(d.n);
              const state = esc ? "escalated" : d.s;
              return (
                <div key={d.n} className="flex min-h-14 items-stretch border border-line bg-ink-800/80">
                  <div className="w-1 shrink-0 bg-ink-700">
                    <div className="h-full origin-bottom" style={{ background: C[state], transform: `scaleY(${esc ? 1 : d.f})` }} />
                  </div>
                  <div className="grid flex-1 grid-cols-[90px_1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[100px_1fr_90px_auto]">
                    <span className="font-mono text-sm">{d.n}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{d.t}</span>
                      <span className="micro">{d.a}</span>
                    </span>
                    <span className="hidden font-mono text-[12px] sm:block">{d.ci}</span>
                    <button
                      className={clsx("btn !py-1.5", esc ? "!border-alarm text-alarm" : "btn-alarm")}
                      disabled={esc}
                      onClick={() => {
                        setEscalated((e) => [...e, d.n]);
                        push({ callsign: d.n, message: "ESCALATED > TOWER CHIEF RAHUL KAPOOR", tone: "alarm" });
                      }}
                    >
                      {esc ? "With Tower Chief" : "Escalate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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

const ROLES = [
  { k: "Pilot", d: "Agency requester" },
  { k: "Controller", d: "Ops agent" },
  { k: "Tower Chief", d: "Escalation manager" },
  { k: "Airport Director", d: "Ops lead" },
];

export function ClearedScene() {
  const [credits, setCredits] = useState<Credit[]>([]);
  useEffect(() => {
    fetch("/credits.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCredits)
      .catch(() => setCredits([]));
  }, []);
  return (
    <Scene index={10} length={160} label="Cleared for takeoff">
      <FrameScrubber sequence="a" reverse className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-ink-950/30" />
      <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-10 sm:px-10">
        <SceneTag n={10}>Cleared for takeoff</SceneTag>
        <h2 className="mt-5 max-w-5xl font-serif text-[clamp(3rem,9vw,8rem)] leading-[0.92]">
          Every ticket is a flight, and now someone is <em className="text-signal">watching the tower.</em>
        </h2>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Magnetic>
            <Link href="/login" className="btn btn-signal !px-7 !py-4 !text-[14px]">
              Enter the Tower <ArrowRight size={16} />
            </Link>
          </Magnetic>
          {ROLES.map((r) => (
            <Link key={r.k} href="/login" className="btn !py-3">
              {r.k} <span className="text-text-dim normal-case">· {r.d}</span>
            </Link>
          ))}
        </div>
        <footer className="mt-14 grid gap-6 border-t border-line pt-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="micro">Footage credits</p>
            <ul className="mt-2 flex flex-col gap-1 text-[12px] text-text-dim">
              {credits.length === 0 && <li>Procedural night runway (GLSL)</li>}
              {credits.map((c) => (
                <li key={c.url}>
                  <a href={c.url} className="underline decoration-line underline-offset-2 hover:text-text" rel="noreferrer" target="_blank">
                    {c.title}
                  </a>{" "}
                  · {c.source} ·{" "}
                  <a href={c.license_url} className="hover:text-text" rel="noreferrer" target="_blank">
                    {c.license}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="micro self-end">OpsDesk Control Tower · built for TBO · fictional demo data</p>
        </footer>
      </div>
    </Scene>
  );
}

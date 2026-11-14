"use client";

/** Scenes 2-5 of the scroll story (Problems 1, 2 and 4). */
import { clsx } from "clsx";
import { useState } from "react";
import { FrameScrubber } from "./frame-scrubber";
import { Scene, SceneTag, useSceneProgress } from "./scene";

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

function Copy({ n, problem, eyebrow, title, children }: { n: number; problem?: string; eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative z-10 max-w-xl">
      <SceneTag n={n} problem={problem}>
        {eyebrow}
      </SceneTag>
      <h2 className="mt-5 font-serif text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.95]">{title}</h2>
      {children && <div className="mt-6 text-lg text-text/80">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- 2 */

function DriftingBlips() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? ease(progress) : 0.6;
  const blips = [
    { id: "OD-24811", day: "Mon", x: -1, y: -0.6 },
    { id: "OD-24817", day: "Wed", x: 1, y: -0.2 },
    { id: "OD-24823", day: "Fri", x: 0.1, y: 1 },
  ];
  return (
    <div className="relative h-[46vh] w-full max-w-lg">
      {blips.map((b, i) => (
        <div
          key={b.id}
          className="absolute top-1/2 left-1/2"
          style={{ transform: `translate(calc(-50% + ${b.x * p * 34}vmin), calc(-50% + ${b.y * p * 16}vmin))` }}
        >
          <span className="absolute -top-3 -left-3 size-6 animate-blip rounded-full border border-alarm" style={{ animationDelay: `${i * 0.5}s` }} />
          <span className="block size-3 rounded-full bg-alarm shadow-[0_0_16px_var(--color-alarm)]" />
          <span className="absolute top-4 left-4 font-mono text-[12px] whitespace-nowrap text-text">
            {b.id} <span className="text-text-dim">· refund · {b.day}</span>
          </span>
        </div>
      ))}
      <p className="micro absolute bottom-0 left-0" style={{ opacity: p }}>
        3 tickets · 0 links · 3 agents · 1 angry agency
      </p>
    </div>
  );
}

export function FlyingBlind() {
  return (
    <Scene index={2} length={200} label="Flying blind" wipe>
      <FrameScrubber sequence="a" className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-ink-950/20" />
      <div className="relative mx-auto grid h-full max-w-7xl items-center gap-10 px-5 sm:px-10 lg:grid-cols-2">
        <Copy n={2} problem="1" eyebrow="Flying blind" title={<>Same refund. Three tickets. <em className="text-alarm">Zero memory.</em></>}>
          An agency asks about the same refund three times. Today each contact is a brand-new problem, picked up by a different agent who
          has never seen the last two.
        </Copy>
        <DriftingBlips />
      </div>
    </Scene>
  );
}

/* ---------------------------------------------------------------- 3 */

export function ConstellationScene() {
  const { progress, rich } = useSceneProgress();
  const [mode, setMode] = useState<"tboh" | "agency" | "intent">("tboh");
  const p = rich ? seg(progress, 0.1, 0.6) : 1;
  const counter = (p * 0.2).toFixed(2);
  return (
    <Scene index={3} length={200} label="Constellation">
      <div className="relative mx-auto grid h-full max-w-7xl items-center px-5 sm:px-10 lg:grid-cols-2">
        <div>
          <Copy n={3} problem="1" eyebrow="Constellation" title={<>One booking. Every conversation. <em className="text-ice">One picture.</em></>}>
            OpsDesk links flights by TBOH, by agency and intent, and by what the words mean. The controller sees the history before
            the agency has to explain it again.
          </Copy>
          <div className="mt-8 flex gap-2" role="radiogroup" aria-label="Link by">
            {(["tboh", "agency", "intent"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={clsx("btn", mode === m && "!border-ice text-ice")}
              >
                {m === "tboh" ? "TBOH" : m === "agency" ? "Agency + intent" : "Similar text"}
              </button>
            ))}
          </div>
          <p className="mt-8 font-mono text-3xl text-signal tabular">
            {Math.round(p * 3)} prior contacts found in {counter} s
          </p>
          <p className="micro mt-2">
            {mode === "tboh" ? "link strength 1.00 · same booking TBOH-88213" : mode === "agency" ? "link strength 0.80 · same agency + Refund > Delay within 30 days" : "link strength 0.50-0.70 · TF-IDF cosine ≥ 0.35"}
          </p>
        </div>
      </div>
    </Scene>
  );
}

/* ---------------------------------------------------------------- 4 */

const PRESETS = [
  { name: "Balanced", winner: "Omar · AE-01", parts: [["Region match UAE", 40], ["P1 urgency", 30], ["on shift", 15], ["online", 10], ["refund skill", 10], ["lowest load", 8]] },
  { name: "Urgency-first", winner: "Omar · AE-01", parts: [["P1 urgency", 60], ["Region match UAE", 40], ["on shift", 30], ["online", 10], ["refund skill", 10], ["lowest load", 8]] },
  { name: "Regional affinity", winner: "Omar · AE-01", parts: [["Region match UAE", 80], ["P1 urgency", 30], ["on shift", 15], ["online", 10], ["refund skill", 10], ["load headroom", 6]] },
  { name: "Fairness", winner: "Layla · AE-02", parts: [["Region match UAE", 40], ["lowest load", 22], ["P1 urgency", 15], ["on shift", 15], ["online", 10], ["agency tier", 2]] },
] as const;

export function VectoringScene() {
  const { progress, rich } = useSceneProgress();
  const idx = rich ? Math.min(3, Math.floor(progress * 4)) : 0;
  const preset = PRESETS[idx]!;
  const total = preset.parts.reduce((a, [, v]) => a + v, 0);
  return (
    <Scene index={4} length={250} label="Vectoring">
      <div className="relative mx-auto grid h-full max-w-7xl items-center gap-10 px-5 sm:px-10 lg:grid-cols-2">
        <Copy n={4} problem="2" eyebrow="Vectoring" title={<>Vectored, <em className="text-signal">not queued.</em></>}>
          Every assignment comes with a reason. Region, shift window, priority, agency rank and availability are scored in the open,
          so a lead can see why Omar won and why Priya did not.
        </Copy>
        <div className="hud w-full max-w-md justify-self-end p-5">
          <span className="hud-tr" aria-hidden />
          <span className="hud-bl" aria-hidden />
          <div className="flex items-center justify-between">
            <span className="micro">OD-24817 · Dubai · P1 · preset</span>
            <span className="font-mono text-[12px] text-signal">{preset.name}</span>
          </div>
          <p className="mt-3 font-serif text-3xl">{preset.winner}</p>
          <div className="mt-4 flex flex-col gap-2">
            {preset.parts.map(([label, v]) => (
              <div key={label} className="grid grid-cols-[130px_1fr_40px] items-center gap-2">
                <span className="truncate font-mono text-[11px] text-text-dim">{label}</span>
                <span className="h-2 bg-ink-950">
                  <span className="block h-full bg-signal transition-[width] duration-500" style={{ width: `${(v / 80) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-[11px] tabular">+{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] text-text-dim">
            total {total} · {PRESETS.map((p, i) => (i === idx ? `[${p.name}]` : p.name)).join(" · ")}
          </p>
        </div>
      </div>
    </Scene>
  );
}

/* ---------------------------------------------------------------- 5 */

export function WheelsUpScene() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? progress : 0.7;
  const fuel = Math.max(0, 1 - p);
  const hours = (9 * fuel).toFixed(1);
  const state = fuel > 0.4 ? "ON COURSE" : fuel > 0.15 ? "AT RISK" : "CRITICAL";
  const color = fuel > 0.4 ? "var(--color-signal)" : fuel > 0.15 ? "var(--color-amber)" : "var(--color-alarm)";
  const fired = p > 0.9;
  return (
    <Scene index={5} length={200} label="Wheels-up clock" wipe>
      <FrameScrubber sequence="b" className="absolute inset-0" tint="dawn" />
      <div className="absolute inset-0 transition-colors duration-700" style={{ background: `linear-gradient(90deg, #05080d 20%, color-mix(in oklab, ${color} 18%, transparent))`, mixBlendMode: "multiply" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />
      <div className="relative mx-auto grid h-full max-w-7xl items-center px-5 sm:px-10 lg:grid-cols-2">
        <div>
          <Copy n={5} problem="4" eyebrow="Wheels-up" title={<>The clock that knows when the <em style={{ color }}>guest lands.</em></>}>
            SLAs count down to check-in and the last cancellation date, not a generic timer. When fuel runs low, escalation to the
            Tower Chief is one click and changes the owner and the queue.
          </Copy>
          <div className="mt-8 flex items-baseline gap-4 font-mono">
            <span className="text-5xl tabular" style={{ color }}>
              T-{hours}h
            </span>
            <span className="micro" style={{ color }}>
              {state}
            </span>
          </div>
          <p className={clsx("mt-4 font-mono text-sm transition-opacity duration-500", fired ? "text-alarm opacity-100" : "opacity-0")}>
            OD-24819 ESCALATED &gt; TOWER CHIEF · owner and queue changed
          </p>
        </div>
      </div>
    </Scene>
  );
}

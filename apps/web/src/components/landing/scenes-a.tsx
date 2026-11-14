"use client";

/** Scenes 2-5 (Problems 1, 2 and 4), all on the shared SceneGrid. */
import { clsx } from "clsx";
import { useState } from "react";
import { Scene, SceneCopy, SceneGrid, useSceneProgress } from "./scene";
import { SceneBackdrop } from "./backdrop";

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

/** Transparent bay in the visual column where the persistent WebGL canvas draws. */
export function InstrumentBay({
  caption,
  children,
}: {
  caption: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-reveal="frame" className="relative mx-auto aspect-square w-full max-w-[540px]">
      <span className="sign sign-dark absolute top-5 left-1/2 -translate-x-1/2">{caption}</span>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- 2 */

function DriftingBlips() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? ease(seg(progress, 0.1, 0.9)) : 0.6;
  const blips = [
    { id: "OD-24811", day: "Mon", x: -1, y: -0.7 },
    { id: "OD-24817", day: "Wed", x: 0.9, y: -0.1 },
    { id: "OD-24823", day: "Fri", x: -0.2, y: 0.85 },
  ];
  return (
    <div className="absolute inset-0">
      {blips.map((b, i) => (
        <div
          key={b.id}
          className="absolute top-1/2 left-1/2"
          style={{
            transform: `translate(calc(-50% + ${b.x * p * 30}%), calc(-50% + ${b.y * p * 140}px))`,
          }}
        >
          <span
            className="animate-blip border-taxi absolute -top-3 -left-3 size-6 rounded-full border-2"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
          <span className="bg-taxi block size-3 rounded-full shadow-[0_0_18px_var(--color-taxi)]" />
          <span className="text-night absolute top-4 left-4 rounded-md bg-white/90 px-2 py-0.5 font-mono text-[11px] whitespace-nowrap shadow">
            {b.id} · refund · {b.day}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FlyingBlind() {
  return (
    <Scene index={2} id="scene-2" length={170} label="Flying blind">
      <SceneBackdrop sequence="gate" callsign="OD-24811" coords={[19.0896, 72.8656]} />
      <SceneGrid
        copy={
          <SceneCopy
            n={2}
            problem="1"
            eyebrow="Flying blind"
            title={
              <>
                Same refund. Three tickets. <em className="text-alarm">Zero memory.</em>
              </>
            }
          >
            An agency asks about the same refund three times. Today every contact is a brand-new
            problem, picked up by a different agent who has never seen the last two.
            <p className="text-text mt-6 font-mono text-[13px]">
              3 tickets · 0 links · 3 agents · 1 frustrated agency
            </p>
          </SceneCopy>
        }
        visual={
          <div data-reveal="frame" className="relative h-[52vh]">
            <DriftingBlips />
            <span className="sign sign-dark absolute bottom-0 left-1/2 -translate-x-1/2">
              Gate 14 · same refund, third time
            </span>
          </div>
        }
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 3 */

export function ConstellationScene() {
  const { progress, rich } = useSceneProgress();
  const [mode, setMode] = useState<"tboh" | "agency" | "intent">("tboh");
  const p = rich ? seg(progress, 0.1, 0.6) : 1;
  return (
    <Scene index={3} length={160} label="Constellation">
      <SceneBackdrop sequence="city" callsign="TBOH-88213" />
      <SceneGrid
        copy={
          <SceneCopy
            n={3}
            problem="1"
            eyebrow="Constellation"
            title={
              <>
                One booking. Every conversation. <em className="text-ice">One picture.</em>
              </>
            }
          >
            OpsDesk links flights by TBOH, by agency and intent, and by what the words mean, so the
            controller sees the history before the agency explains it again.
            <div className="mt-7 flex flex-wrap gap-2" role="radiogroup" aria-label="Link by">
              {(["tboh", "agency", "intent"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={clsx("btn", mode === m && "!border-night !bg-night !text-taxi")}
                >
                  {m === "tboh" ? "TBOH" : m === "agency" ? "Agency + intent" : "Similar text"}
                </button>
              ))}
            </div>
            <p className="display text-text mt-8 text-5xl">
              {Math.round(p * 3)} prior contacts <span className="text-text-dim">in</span>{" "}
              {(p * 0.2).toFixed(2)}s
            </p>
            <p className="micro mt-2">
              {mode === "tboh"
                ? "strength 1.00 · same booking TBOH-88213"
                : mode === "agency"
                  ? "strength 0.80 · same agency + Refund > Delay, 30 days"
                  : "strength 0.50-0.70 · TF-IDF cosine ≥ 0.35"}
            </p>
          </SceneCopy>
        }
        visual={<InstrumentBay caption="Constellation · TBOH-88213" />}
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 4 */

const PRESETS = [
  {
    name: "Balanced",
    winner: "Omar · AE-01",
    parts: [
      ["Region match UAE", 40],
      ["P1 urgency", 30],
      ["on shift", 15],
      ["online", 10],
      ["refund skill", 10],
      ["lowest load", 8],
    ],
  },
  {
    name: "Urgency-first",
    winner: "Omar · AE-01",
    parts: [
      ["P1 urgency", 60],
      ["Region match UAE", 40],
      ["on shift", 30],
      ["online", 10],
      ["refund skill", 10],
      ["lowest load", 8],
    ],
  },
  {
    name: "Regional affinity",
    winner: "Omar · AE-01",
    parts: [
      ["Region match UAE", 80],
      ["P1 urgency", 30],
      ["on shift", 15],
      ["online", 10],
      ["refund skill", 10],
      ["load headroom", 6],
    ],
  },
  {
    name: "Fairness",
    winner: "Layla · AE-02",
    parts: [
      ["Region match UAE", 40],
      ["lowest load", 22],
      ["P1 urgency", 15],
      ["on shift", 15],
      ["online", 10],
      ["agency tier", 2],
    ],
  },
] as const;

export function VectoringScene() {
  const { progress, rich } = useSceneProgress();
  const idx = rich ? Math.min(3, Math.floor(seg(progress, 0.05, 0.95) * 4)) : 0;
  const preset = PRESETS[idx]!;
  const total = preset.parts.reduce((a, [, v]) => a + v, 0);
  return (
    <Scene index={4} length={220} label="Vectoring">
      <SceneBackdrop sequence="taxi" callsign="AE-01" />
      <SceneGrid
        copy={
          <SceneCopy
            n={4}
            problem="2"
            eyebrow="Vectoring"
            title={
              <>
                Vectored, <em className="text-beacon">not queued.</em>
              </>
            }
          >
            Every assignment comes with a reason. Region, shift window, priority, agency rank and
            availability are scored in the open, so a lead can see why Omar won and why Priya did
            not.
            <div data-reveal className="hud mt-8 max-w-md p-5">
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <div className="flex items-center justify-between">
                <span className="micro">OD-24817 · Dubai · P1</span>
                <span className="sign">{preset.name}</span>
              </div>
              <p className="display text-text mt-3 text-3xl">{preset.winner}</p>
              <div className="mt-4 flex flex-col gap-2">
                {preset.parts.map(([label, v]) => (
                  <div key={label} className="grid grid-cols-[130px_1fr_40px] items-center gap-2">
                    <span className="text-text-dim truncate font-mono text-[11px]">{label}</span>
                    <span className="bg-ink-700 h-2 overflow-hidden rounded-full">
                      <span
                        className="bg-night block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        style={{ width: `${(v / 80) * 100}%` }}
                      />
                    </span>
                    <span className="text-text tabular text-right font-mono text-[11px]">+{v}</span>
                  </div>
                ))}
              </div>
              <p className="border-line mt-4 border-t pt-3 font-mono text-[11px]">total {total}</p>
            </div>
          </SceneCopy>
        }
        visual={<InstrumentBay caption="Mumbai · Dubai · London · Singapore" />}
      />
    </Scene>
  );
}

/* ---------------------------------------------------------------- 5 */

function FuelRing({ fuel, color }: { fuel: number; color: string }) {
  const r = 120;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 300 300"
      className="absolute inset-0 m-auto h-[70%] w-[70%] -rotate-[225deg] drop-shadow-[0_0_24px_rgba(0,0,0,0.5)]"
      aria-hidden
    >
      <circle
        cx="150"
        cy="150"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="16"
        strokeDasharray={`${c * 0.75} ${c}`}
      />
      <circle
        cx="150"
        cy="150"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${c * 0.75 * fuel} ${c}`}
        style={{ transition: "stroke 400ms" }}
      />
    </svg>
  );
}

export function WheelsUpScene() {
  const { progress, rich } = useSceneProgress();
  const p = rich ? seg(progress, 0.05, 0.95) : 0.7;
  const fuel = Math.max(0.02, 1 - p);
  const state = fuel > 0.4 ? "On course" : fuel > 0.15 ? "At risk" : "Critical";
  const color =
    fuel > 0.4 ? "var(--color-signal)" : fuel > 0.15 ? "var(--color-taxi)" : "var(--color-alarm)";
  const fired = p > 0.9;
  return (
    <Scene index={5} length={190} label="Wheels-up clock">
      <SceneBackdrop sequence="sunrise" callsign="OD-24819" coords={[51.47, -0.4543]} />
      <SceneGrid
        copy={
          <SceneCopy
            n={5}
            problem="4"
            eyebrow="Wheels-up"
            title={
              <>
                The clock that knows when the <em className="text-critical">guest lands.</em>
              </>
            }
          >
            SLAs count down to check-in and the last cancellation date, not a generic timer. When
            fuel runs low, escalation to the Tower Chief is one click and changes the owner and the
            queue.
            <div className="mt-8 flex items-baseline gap-4">
              <span className="text-text tabular font-mono text-5xl">
                T-{(9 * fuel).toFixed(1)}h
              </span>
              <span
                className="sign"
                style={{
                  background: color,
                  color: fuel > 0.15 && fuel <= 0.4 ? "var(--color-night)" : "white",
                }}
              >
                {state}
              </span>
            </div>
            <p
              className={clsx(
                "text-alarm mt-4 font-mono text-sm transition-all duration-500",
                fired ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
            >
              OD-24819 ESCALATED &gt; TOWER CHIEF · owner and queue changed
            </p>
          </SceneCopy>
        }
        visual={
          <div data-reveal="frame" className="relative mx-auto aspect-square w-full max-w-[460px]">
            <FuelRing fuel={fuel} color={color} />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                <p className="micro !text-white/80">Wheels-up fuel</p>
                <p className="tabular font-mono text-6xl">{Math.round(fuel * 100)}%</p>
              </div>
            </div>
          </div>
        }
      />
    </Scene>
  );
}

"use client";

/**
 * Full-bleed, scroll-scrubbed footage behind a scene, with:
 * - a paper fade on the copy side so ink type stays readable,
 * - top/bottom blends into the page so scenes flow into each other,
 * - a motion-graphics HUD: target reticle tracking with scroll, scan line,
 *   live coordinates and a callsign tag.
 */
import { FrameScrubber } from "./frame-scrubber";
import { useSceneProgress } from "./scene";

export function SceneBackdrop({
  sequence,
  reverse = false,
  callsign,
  coords = [25.2532, 55.3657],
  side = "right",
}: {
  sequence: string;
  reverse?: boolean;
  callsign?: string;
  coords?: [number, number];
  side?: "right" | "full";
}) {
  const { progress } = useSceneProgress();
  const tx = 62 + Math.sin(progress * Math.PI * 1.5) * 14;
  const ty = 38 + Math.cos(progress * Math.PI) * 18;
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <FrameScrubber sequence={sequence} reverse={reverse} className="absolute inset-0 scale-[1.04]" tint="none" />
      {/* Grade: lift shadows toward paper so the footage sits in the light system */}
      <div className="absolute inset-0 bg-[#f4f1ea] mix-blend-soft-light opacity-40" />
      {side === "right" ? (
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-ink-950)_0%,color-mix(in_oklab,var(--color-ink-950)_92%,transparent)_36%,color-mix(in_oklab,var(--color-ink-950)_25%,transparent)_62%,transparent_80%)] max-lg:bg-[linear-gradient(180deg,var(--color-ink-950)_0%,color-mix(in_oklab,var(--color-ink-950)_85%,transparent)_55%,transparent_100%)]" />
      ) : (
        <div className="absolute inset-0 bg-ink-950/70" />
      )}
      <div className="absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-ink-950 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[14%] bg-gradient-to-t from-ink-950 to-transparent" />

      {/* Motion graphics HUD */}
      <div className="absolute inset-0 hidden lg:block">
        <div className="absolute inset-y-0 left-[48%] w-px bg-gradient-to-b from-transparent via-white/40 to-transparent" />
        <div className="absolute inset-x-[48%] right-0 h-px animate-[scan_5s_linear_infinite] bg-gradient-to-r from-transparent via-taxi to-transparent opacity-80 motion-reduce:hidden" />
        <div className="absolute size-24 -translate-1/2 transition-[left,top] duration-500 ease-out" style={{ left: `${tx}%`, top: `${ty}%` }}>
          <span className="absolute inset-0 rounded-full border border-white/70" />
          <span className="absolute inset-4 animate-sweep rounded-full border-t-2 border-taxi" />
          <span className="absolute top-1/2 -left-6 h-px w-6 bg-white/70" />
          <span className="absolute top-1/2 -right-6 h-px w-6 bg-white/70" />
          <span className="absolute -top-6 left-1/2 h-6 w-px bg-white/70" />
          <span className="absolute -bottom-6 left-1/2 h-6 w-px bg-white/70" />
          {callsign && (
            <span className="absolute top-full left-full mt-3 ml-3 rounded-md bg-night/85 px-2 py-1 font-mono text-[10px] whitespace-nowrap text-taxi">
              {callsign} · {(coords[0] + progress * 0.4).toFixed(4)}N {(coords[1] + progress * 0.6).toFixed(4)}E
            </span>
          )}
        </div>
        <div className="absolute right-6 bottom-6 flex flex-col items-end gap-1 font-mono text-[10px] text-white/85">
          <span className="rounded bg-night/70 px-2 py-0.5">REC ● {String(Math.round(progress * 100)).padStart(3, "0")}%</span>
          <span className="rounded bg-night/70 px-2 py-0.5">FRAME {sequence.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

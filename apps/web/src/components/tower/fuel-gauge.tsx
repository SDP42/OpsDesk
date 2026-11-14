"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import type { Sla } from "@/lib/api/client";
import { duration, SLA_COLOR, SLA_LABEL } from "@/lib/format";

/**
 * Wheels-Up fuel gauge: a 270° SVG arc whose length equals remaining SLA.
 * Colour follows the SLA state; pulses when critical or breached. Counts down live.
 */
export function FuelGauge({
  sla,
  size = 160,
  showLabel = true,
}: {
  sla: Pick<Sla, "fuel" | "state" | "remaining_seconds" | "due_at" | "elapsed_pct">;
  size?: number;
  showLabel?: boolean;
}) {
  const [remaining, setRemaining] = useState(sla.remaining_seconds);
  useEffect(() => {
    setRemaining(sla.remaining_seconds);
    const due = sla.due_at ? new Date(sla.due_at).getTime() : null;
    if (!due) return;
    const t = setInterval(() => setRemaining((due - Date.now()) / 1000), 1000);
    return () => clearInterval(t);
  }, [sla.remaining_seconds, sla.due_at, sla.state]);

  const stroke = Math.max(6, size * 0.06);
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270 degrees
  const fuel = Math.max(0, Math.min(1, sla.fuel));
  const color = SLA_COLOR[sla.state] ?? "var(--color-signal)";
  const pulsing = sla.state === "critical" || sla.state === "breached";
  const ticks = Array.from({ length: 28 });

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Fuel ${Math.round(fuel * 100)} percent, ${SLA_LABEL[sla.state] ?? sla.state}`}
        className={clsx(pulsing && "animate-pulse-alarm")}
      >
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          {ticks.map((_, i) => {
            const a = (i / (ticks.length - 1)) * sweep * 2 * Math.PI;
            const inner = r - stroke - 3;
            const outer = r - stroke + (i % 4 === 0 ? 3 : 0);
            return (
              <line
                key={i}
                x1={size / 2 + Math.cos(a) * inner}
                y1={size / 2 + Math.sin(a) * inner}
                x2={size / 2 + Math.cos(a) * outer}
                y2={size / 2 + Math.sin(a) * outer}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
            );
          })}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-ink-700)"
            strokeWidth={stroke}
            strokeDasharray={`${c * sweep} ${c}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${c * sweep * fuel} ${c}`}
            style={{ transition: "stroke-dasharray 600ms var(--ease-tower), stroke 280ms" }}
          />
        </g>
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="micro" style={{ color }}>
            {SLA_LABEL[sla.state] ?? sla.state}
          </span>
          <span className="font-mono text-xl tabular" style={{ fontSize: size * 0.13 }}>
            {sla.state === "met" ? "LANDED" : `${remaining < 0 ? "+" : ""}${duration(remaining)}`}
          </span>
          <span className="micro">{Math.round(fuel * 100)}% fuel</span>
        </div>
      )}
    </div>
  );
}

/** Thin vertical fuel bar used on the left edge of every Flight Strip. */
export function FuelBar({ fuel, state }: { fuel: number; state: string }) {
  const color = SLA_COLOR[state] ?? "var(--color-signal)";
  return (
    <div className="relative h-full w-1 shrink-0 overflow-hidden bg-ink-700" aria-hidden>
      <div
        className={clsx("absolute bottom-0 left-0 w-full", (state === "critical" || state === "breached") && "animate-pulse-alarm")}
        style={{ height: `${Math.max(4, fuel * 100)}%`, background: color, transition: "height 600ms var(--ease-tower)" }}
      />
    </div>
  );
}

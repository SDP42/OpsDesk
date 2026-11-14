"use client";

/**
 * Tower overview radar: a 2D SVG scope with a sweep line. Each open flight is a
 * blip placed in its region's sector; distance from centre = remaining fuel,
 * colour = SLA state. Breached flights sit on the rim and pulse.
 */
import Link from "next/link";
import { useMemo } from "react";
import type { Ticket } from "@/lib/api/client";
import { REGION_LABEL, SLA_COLOR } from "@/lib/format";

const SECTORS = ["IN", "AE", "UK", "SEA"] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RadarScope({ tickets, size = 420 }: { tickets: Ticket[]; size?: number }) {
  const c = size / 2;
  const R = c - 18;
  const blips = useMemo(
    () =>
      tickets.map((t) => {
        const sector = Math.max(0, SECTORS.indexOf(t.region as (typeof SECTORS)[number]));
        const h = hash(t.id);
        const angle = ((sector * 90 + 8 + (h % 74)) * Math.PI) / 180 - Math.PI / 2;
        const dist = 0.12 + (1 - Math.max(0, Math.min(1, t.sla.fuel))) * 0.85;
        return { t, x: c + Math.cos(angle) * R * dist, y: c + Math.sin(angle) * R * dist, h };
      }),
    [tickets, c, R],
  );

  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full"
        role="img"
        aria-label={`Radar with ${tickets.length} open flights`}
      >
        <defs>
          <radialGradient id="scope" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d1c22" />
            <stop offset="100%" stopColor="#05080d" />
          </radialGradient>
          <linearGradient id="sweepGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={R} fill="url(#scope)" stroke="var(--color-line)" />
        {[0.25, 0.5, 0.75].map((f) => (
          <circle
            key={f}
            cx={c}
            cy={c}
            r={R * f}
            fill="none"
            stroke="var(--color-line)"
            strokeDasharray="2 4"
          />
        ))}
        {SECTORS.map((s, i) => {
          const a = (i * 90 * Math.PI) / 180 - Math.PI / 2;
          const la = ((i * 90 + 45) * Math.PI) / 180 - Math.PI / 2;
          return (
            <g key={s}>
              <line
                x1={c}
                y1={c}
                x2={c + Math.cos(a) * R}
                y2={c + Math.sin(a) * R}
                stroke="var(--color-line)"
              />
              <text
                x={c + Math.cos(la) * (R + 2) * 0.93}
                y={c + Math.sin(la) * (R + 2) * 0.93}
                textAnchor="middle"
                className="fill-text-dim font-mono"
                fontSize="10"
                letterSpacing="1.4"
              >
                {(REGION_LABEL[s] ?? s).toUpperCase()}
              </text>
            </g>
          );
        })}
        <g
          className="animate-sweep origin-center motion-reduce:hidden"
          style={{ transformOrigin: `${c}px ${c}px`, transformBox: "view-box" }}
        >
          <path
            d={`M ${c} ${c} L ${c} ${c - R} A ${R} ${R} 0 0 1 ${c + R * Math.sin(Math.PI / 5)} ${c - R * Math.cos(Math.PI / 5)} Z`}
            fill="url(#sweepGrad)"
            opacity="0.7"
          />
          <line x1={c} y1={c} x2={c} y2={c - R} stroke="var(--color-signal)" strokeWidth="1.2" />
        </g>
        {blips.map(({ t, x, y, h }) => {
          const color = SLA_COLOR[t.sla.state] ?? "var(--color-signal)";
          const hot = t.sla.state === "breached" || t.sla.state === "critical";
          return (
            <Link
              key={t.id}
              href={`/tower/t/${t.number}`}
              aria-label={`${t.number} ${t.sla.state}`}
            >
              {hot && (
                <circle
                  cx={x}
                  cy={y}
                  r={4}
                  fill="none"
                  stroke={color}
                  className="animate-blip"
                  style={{
                    transformOrigin: `${x}px ${y}px`,
                    transformBox: "view-box",
                    animationDelay: `${(h % 20) / 10}s`,
                  }}
                />
              )}
              <circle cx={x} cy={y} r={t.priority === "P1" ? 3.6 : 2.6} fill={color}>
                <title>{`${t.number} · ${t.agency.name} · ${t.sla.state}`}</title>
              </circle>
            </Link>
          );
        })}
        <circle cx={c} cy={c} r={3} fill="var(--color-signal)" />
      </svg>
    </div>
  );
}

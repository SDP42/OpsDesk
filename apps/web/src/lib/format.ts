/** Formatting helpers: durations, countdowns and ATC-style labels. */

export const REGION_LABEL: Record<string, string> = {
  IN: "India",
  AE: "UAE",
  UK: "UK",
  SEA: "SE Asia",
};

export const SLA_COLOR: Record<string, string> = {
  ok: "var(--color-signal)",
  met: "var(--color-signal)",
  at_risk: "var(--color-amber)",
  critical: "var(--color-critical)",
  breached: "var(--color-alarm)",
  paused: "var(--color-ice)",
};

export const SLA_LABEL: Record<string, string> = {
  ok: "On course",
  met: "Landed",
  at_risk: "At risk",
  critical: "Critical",
  breached: "Breached",
  paused: "Holding",
};

export const STATUS_LABEL: Record<string, string> = {
  new: "Boarding",
  open: "En route",
  pending: "Holding",
  escalated: "Tower Chief",
  resolved: "Landed",
  closed: "At gate",
};

/** "3h 12m", "45m", "2d 4h" from seconds (absolute value). */
export function duration(seconds: number): string {
  const s = Math.abs(Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

/** Time until a date, e.g. "T-9h 02m" or "T+2h" once passed. */
export function tMinus(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const diff = (new Date(iso).getTime() - now) / 1000;
  return `${diff >= 0 ? "T-" : "T+"}${duration(diff)}`;
}

export function ago(iso: string, now = Date.now()): string {
  const diff = (now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  return `${duration(diff)} ago`;
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

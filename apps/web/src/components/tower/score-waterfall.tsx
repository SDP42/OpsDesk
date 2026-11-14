import { clsx } from "clsx";

export interface ScorePart {
  key: string;
  label: string;
  raw: number;
  weight: number;
  points: number;
}

export interface RunnerUp {
  id: string;
  name: string;
  total: number;
  gap: number;
  lost_on: string;
  lost_by: number;
  why: string;
}

/** Horizontal waterfall of routing score parts, with the winning reason highlighted. */
export function ScoreWaterfall({
  parts,
  total,
  runnersUp = [],
}: {
  parts: ScorePart[];
  total: number;
  runnersUp?: RunnerUp[];
}) {
  const positive = parts.filter((p) => p.points > 0).sort((a, b) => b.points - a.points);
  const top = new Set(positive.slice(0, 4).map((p) => p.key));
  const max = Math.max(total, 1);
  let offset = 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {positive.map((p) => {
          const left = (offset / max) * 100;
          const width = (p.points / max) * 100;
          offset += p.points;
          return (
            <div key={p.key} className="grid grid-cols-[minmax(120px,40%)_1fr_44px] items-center gap-2">
              <span className={clsx("truncate font-mono text-[11px]", top.has(p.key) ? "text-text" : "text-text-dim")}>
                {p.label}
              </span>
              <div className="relative h-3 bg-ink-950">
                <div
                  className={clsx("absolute top-0 h-full", top.has(p.key) ? "bg-signal" : "bg-ice/50")}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <span className="text-right font-mono text-[11px] text-signal tabular">+{p.points}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(120px,40%)_1fr_44px] items-center gap-2 border-t border-line pt-1.5">
          <span className="micro">total</span>
          <span />
          <span className="text-right font-mono text-[12px] tabular">{total}</span>
        </div>
      </div>
      {runnersUp.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="micro">Why not…</span>
          {runnersUp.map((r) => (
            <p key={r.id} className="font-mono text-[11px] text-text-dim">
              <span className="text-text">{r.name}</span> −{r.gap} · {r.why.split("; ")[1] ?? r.why}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

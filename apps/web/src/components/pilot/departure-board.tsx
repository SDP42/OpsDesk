"use client";

/** Split-flap departures board for the Pilot portal. Characters roll in like a real board. */
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import type { PilotTicket } from "@/lib/api/client";
import { clock, STATUS_LABEL } from "@/lib/format";

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:>.";

export function SplitFlap({ text, className }: { text: string; className?: string }) {
  const target = text.toUpperCase();
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setShown(
        target
          .split("")
          .map((ch, i) =>
            frame > i * 0.6 + 6 ? ch : CHARS[Math.floor(Math.random() * CHARS.length)],
          )
          .join(""),
      );
      if (frame > target.length * 0.6 + 8) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [target]);
  return (
    <span className={clsx("inline-flex gap-[2px] font-mono", className)} aria-label={text}>
      {shown.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="bg-ink-950 after:bg-ink-800 relative inline-grid min-w-[0.78em] place-items-center px-[1px] text-center leading-[1.5] after:absolute after:inset-x-0 after:top-1/2 after:h-px"
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  new: "text-ice",
  open: "text-signal",
  pending: "text-amber",
  escalated: "text-alarm",
  resolved: "text-signal",
  closed: "text-text-dim",
};

export function DepartureBoard({
  tickets,
  selected,
  onSelect,
}: {
  tickets: PilotTicket[];
  selected?: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5 text-left">
        <thead>
          <tr className="micro">
            <th className="px-3 font-normal">Flight</th>
            <th className="px-3 font-normal">Destination · case</th>
            <th className="px-3 font-normal">Booking</th>
            <th className="px-3 font-normal">Status</th>
            <th className="px-3 font-normal">ETA</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr
              key={t.id}
              tabIndex={0}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(t.id)}
              data-testid="departure-row"
              className={clsx(
                "bg-ink-800/80 hover:bg-ink-700 focus-visible:ring-ice cursor-pointer transition-colors outline-none focus-visible:ring-1",
                selected === t.id && "ring-signal ring-1",
              )}
            >
              <td className="px-3 py-2.5">
                <SplitFlap text={t.number} className="text-amber text-[15px]" />
              </td>
              <td className="max-w-[320px] px-3 py-2.5">
                <p className="truncate text-sm">{t.title}</p>
                <p className="micro mt-0.5">{t.intent?.label ?? "Classifying"}</p>
              </td>
              <td className="text-text-dim px-3 py-2.5 font-mono text-[12px]">{t.tboh ?? "—"}</td>
              <td className={clsx("px-3 py-2.5", STATUS_TONE[t.status])}>
                <SplitFlap text={STATUS_LABEL[t.status] ?? t.status} className="text-[12px]" />
              </td>
              <td className="tabular px-3 py-2.5 font-mono text-[12px]">
                {t.status === "resolved" || t.status === "closed" ? "LANDED" : clock(t.eta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

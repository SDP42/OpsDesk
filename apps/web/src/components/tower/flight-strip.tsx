"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { forwardRef } from "react";
import type { Ticket } from "@/lib/api/client";
import { REGION_LABEL, SLA_COLOR, SLA_LABEL, STATUS_LABEL, tMinus } from "@/lib/format";
import { ConstellationGlyph } from "@/components/ui/glyphs";
import { FuelBar } from "./fuel-gauge";

const PRIORITY_TONE: Record<string, string> = {
  P1: "border-alarm/70 text-alarm",
  P2: "border-amber/70 text-amber",
  P3: "border-ice/50 text-ice",
  P4: "border-line text-text-dim",
};

/**
 * A real ATC flight strip: callsign, agency, TBOH, region, intent chip,
 * time-to-check-in and a thin SLA fuel bar on the left edge. Never a plain table row.
 */
export const FlightStrip = forwardRef<
  HTMLAnchorElement,
  { ticket: Ticket; active?: boolean; fresh?: boolean; onFocus?: () => void }
>(function FlightStrip({ ticket: t, active, fresh, onFocus }, ref) {
  const slaColor = SLA_COLOR[t.sla.state] ?? "var(--color-signal)";
  return (
    <Link
      ref={ref}
      href={`/tower/t/${t.number}`}
      onFocus={onFocus}
      data-testid="flight-strip"
      className={clsx(
        "group bg-ink-800/80 relative flex min-h-[68px] items-stretch border transition-colors duration-150 outline-none",
        active ? "border-ice" : "border-line hover:border-signal/50",
        fresh && "animate-flash",
      )}
    >
      <FuelBar fuel={t.sla.fuel} state={t.sla.state} />
      <div className="grid flex-1 grid-cols-[minmax(92px,auto)_1fr] gap-x-4 px-3 py-2 md:grid-cols-[110px_1fr_150px_120px_110px]">
        <div className="flex flex-col justify-center">
          <span className="text-text font-mono text-[15px] font-semibold tracking-wide">
            {t.number}
          </span>
          <span
            className={clsx(
              "mt-1 w-fit border px-1.5 font-mono text-[10px]",
              PRIORITY_TONE[t.priority],
            )}
          >
            {t.priority}
          </span>
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <span className="text-text truncate text-[14px]">{t.title}</span>
          <span className="micro mt-1 truncate">
            {t.agency.name} · {t.agency.city}
            {t.tboh ? ` · ${t.tboh}` : ""}
          </span>
        </div>
        <div className="hidden flex-col justify-center md:flex">
          {t.intent ? (
            <span className="border-line text-ice w-fit max-w-full truncate border px-2 py-0.5 font-mono text-[11px]">
              {t.intent.label}
            </span>
          ) : (
            <span className="micro">no intent</span>
          )}
          <span className="micro mt-1">
            {REGION_LABEL[t.region] ?? t.region} · {t.owner?.callsign ?? "TRIAGE"}
          </span>
        </div>
        <div className="hidden flex-col justify-center md:flex">
          <span className="micro">check-in</span>
          <span className="tabular font-mono text-[13px]">{tMinus(t.check_in)}</span>
        </div>
        <div className="hidden flex-col items-end justify-center md:flex">
          <span className="micro" style={{ color: slaColor }}>
            {SLA_LABEL[t.sla.state]}
          </span>
          <span className="text-text-dim font-mono text-[11px]">
            {STATUS_LABEL[t.status] ?? t.status}
          </span>
        </div>
      </div>
      {t.link_count > 0 && (
        <span
          title={`${t.link_count} linked flights`}
          className="text-text-dim absolute top-1.5 right-2 flex items-center gap-1 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        >
          <ConstellationGlyph size={12} /> {t.link_count}
        </span>
      )}
      {t.guardian_flag && (
        <span className="text-amber absolute right-2 bottom-1.5 font-mono text-[10px]">
          3RD CONTACT
        </span>
      )}
    </Link>
  );
});

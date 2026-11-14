"use client";

/** Append-only activity timeline with a basic scrubber (full replay arrives with Time-travel). */
import { clsx } from "clsx";
import { useState } from "react";
import type { TimelineEvent } from "@/lib/api/client";
import { clock } from "@/lib/format";

const LABEL: Record<string, string> = {
  created: "Flight filed",
  intent_classified: "Intent classified",
  linked: "Linked to history",
  guardian_triggered: "Third-Contact Guardian",
  sla_set: "Wheels-up clock set",
  routed: "Vectored",
  status_changed: "Status change",
  assigned: "Assigned",
  unassigned: "Returned to triage",
  reassigned: "Transferred",
  handoff_check: "Handoff check confirmed",
  escalated: "Escalated to Tower Chief",
  internal_note: "Internal note",
  external_reply: "External reply",
  frequency_opened: "Frequency opened",
  frequency_message: "Frequency message",
  recipient_added: "Recipient added",
  recipient_removed: "Recipient removed",
  sla_state_changed: "SLA state change",
  priority_changed: "Priority change",
  intent_overridden: "Intent overridden",
  title_changed: "Title change",
  note: "Note",
};

const TONE: Record<string, string> = {
  escalated: "bg-alarm",
  guardian_triggered: "bg-amber",
  sla_state_changed: "bg-critical",
  routed: "bg-signal",
  linked: "bg-ice",
  handoff_check: "bg-ice",
  internal_note: "bg-amber",
};

function summary(e: TimelineEvent): string | null {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "routed":
      return `${String(p.owner_name ?? "Triage")}: ${String(p.reason ?? "")}`;
    case "intent_classified":
      return `${String(p.code ?? "?")} · ${p.confidence ? Math.round(Number(p.confidence) * 100) + "%" : ""} (${String(p.source ?? "")})`;
    case "linked":
      return `${String(p.count ?? "")} linked flight(s)`;
    case "guardian_triggered":
    case "escalated":
      return String(p.reason ?? "");
    case "status_changed":
      return `${String(p.from)} → ${String(p.to)}`;
    case "sla_state_changed":
      return `${String(p.from)} → ${String(p.to)}`;
    case "priority_changed":
      return `${String(p.from)} → ${String(p.to)}`;
    case "handoff_check": {
      const n = (k: string) => (Array.isArray(p[k]) ? (p[k] as unknown[]).length : 0);
      return `${n("stayed")} stayed · ${n("added")} added · ${n("dropped")} dropped`;
    }
    case "internal_note":
    case "external_reply":
    case "frequency_message":
      return String(p.preview ?? "");
    default:
      return null;
  }
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [upTo, setUpTo] = useState(events.length);
  const shown = events.slice(0, Math.min(upTo, events.length));
  return (
    <div className="flex flex-col gap-3">
      {events.length > 1 && (
        <label className="flex items-center gap-3">
          <span className="micro">Scrub</span>
          <input
            type="range"
            min={1}
            max={events.length}
            value={Math.min(upTo, events.length)}
            onChange={(e) => setUpTo(Number(e.target.value))}
            className="flex-1 accent-[var(--color-signal)]"
            aria-label="Replay timeline"
          />
          <span className="text-text-dim tabular font-mono text-[11px]">
            {Math.min(upTo, events.length)}/{events.length}
          </span>
        </label>
      )}
      <ol className="border-line relative flex flex-col gap-3 border-l pl-4">
        {shown.map((e) => {
          const s = summary(e);
          return (
            <li key={e.id} className="relative">
              <span
                className={clsx(
                  "absolute top-1.5 -left-[21px] size-2 rounded-full",
                  TONE[e.type] ?? "bg-text-dim",
                )}
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px]">{LABEL[e.type] ?? e.type}</span>
                <span className="micro shrink-0">{clock(e.at)}</span>
              </div>
              {s && <p className="text-text-dim mt-0.5 font-mono text-[11px] break-words">{s}</p>}
              {e.actor && <p className="micro mt-0.5">by {e.actor.callsign ?? e.actor.name}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

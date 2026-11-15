"use client";

/** Frustration Radar and Promise Tracker for one flight. */
import { useQuery } from "@tanstack/react-query";
import { Flame, Handshake } from "lucide-react";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { clock } from "@/lib/format";

const BAND: Record<string, string> = {
  calm: "bg-signal",
  warm: "bg-taxi",
  heated: "bg-critical",
  boiling: "bg-alarm",
};

export function SignalsPanel({ ticketId }: { ticketId: string }) {
  const q = useQuery({
    queryKey: ["ticket", ticketId, "signals"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/tickets/{ticket_id}/signals", {
          params: { path: { ticket_id: ticketId } },
        }),
      ),
  });
  if (q.isLoading) return <div className="skeleton h-32" />;
  if (!q.data) return null;
  const f = q.data.frustration;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm">
            <Flame size={14} className="text-critical" /> Agency mood:{" "}
            <strong className="capitalize">{f.band}</strong>
          </span>
          <span className="tabular font-mono text-sm">{Math.round(f.score * 100)}</span>
        </div>
        <div className="bg-ink-700 mt-1.5 h-2 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              BAND[f.band] ?? "bg-signal",
            )}
            style={{ width: `${Math.max(4, f.score * 100)}%` }}
          />
        </div>
        {f.signals.length > 0 && (
          <p className="micro mt-1.5">signals: {f.signals.slice(0, 4).join(" · ")}</p>
        )}
        <p className="bg-ink-900 text-text-dim mt-2 rounded-lg p-2.5 text-[13px]">
          Suggested tone: “{f.calm_reply}”
        </p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm">
          <Handshake size={14} className="text-ice" /> Promises made · {q.data.promises.length}
        </p>
        {q.data.promises.length === 0 ? (
          <p className="text-text-dim mt-1 text-[13px]">No commitments found in replies yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {q.data.promises.map((p, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[13px]",
                  p.overdue ? "border-alarm/50 bg-alarm/5" : "border-line",
                )}
              >
                “{p.text}”
                <span className={cn("micro mt-0.5 block", p.overdue && "!text-alarm")}>
                  {p.overdue ? "Overdue · " : "Due "} {p.due_at ? clock(p.due_at) : "no date"} ·{" "}
                  {p.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

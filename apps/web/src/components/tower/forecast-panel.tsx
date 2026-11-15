"use client";

/** Breach Forecast: "what if I escalate now?" Monte Carlo histograms per action. */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";

export function ForecastPanel({
  ticketId,
  minutesLeft,
}: {
  ticketId: string;
  minutesLeft: number;
}) {
  const q = useQuery({
    queryKey: ["ticket", ticketId, "forecast"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/tickets/{ticket_id}/forecast", {
          params: { path: { ticket_id: ticketId } },
        }),
      ),
  });
  const [pick, setPick] = useState<string | null>(null);
  if (q.isLoading) return <div className="skeleton h-48" />;
  if (!q.data) return <p className="text-text-dim text-sm">Forecast unavailable.</p>;
  const action =
    q.data.actions.find((a) => a.action === (pick ?? q.data.best_action)) ?? q.data.actions[0]!;
  const data = action.histogram.map((n, i) => ({ m: Math.round(q.data.bin_edges[i] ?? 0), n }));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        {q.data.actions.map((a) => (
          <button
            key={a.action}
            onClick={() => setPick(a.action)}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-left transition",
              a.action === action.action
                ? "border-night bg-taxi/25"
                : "border-line hover:border-text/40",
            )}
          >
            <span className="micro block">{a.action.replace("_", " ")}</span>
            <span
              className={cn(
                "tabular font-mono text-lg",
                a.breach_probability > 0.5
                  ? "text-alarm"
                  : a.breach_probability > 0.25
                    ? "text-amber"
                    : "text-signal",
              )}
            >
              {Math.round(a.breach_probability * 100)}%
            </span>
          </button>
        ))}
      </div>
      <p className="text-[13px]">{action.label}</p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="m"
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              interval={4}
              unit="m"
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              formatter={(v) => [`${v} runs`, "simulations"]}
              labelFormatter={(l) => `${l} min to resolve`}
            />
            <ReferenceLine
              x={data.reduce(
                (best, d) =>
                  Math.abs(d.m - minutesLeft) < Math.abs(best - minutesLeft) ? d.m : best,
                0,
              )}
              stroke="var(--color-alarm)"
              strokeDasharray="4 3"
            />
            <Bar dataKey="n" fill="var(--color-night)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-text-dim font-mono text-[11px]">{q.data.reason}</p>
    </div>
  );
}

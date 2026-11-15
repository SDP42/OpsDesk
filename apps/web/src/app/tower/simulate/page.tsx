"use client";

/** Routing What-If Simulator: replay recent flights under every preset and compare. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Check, Play, Trophy } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/ops/page-header";
import { Hud } from "@/components/ui/hud";
import { Num, Sign } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useTowerCalls } from "@/lib/stores/tower-calls";

type Result = Schemas["SimulationResult"];
const NAMES: Record<string, string> = {
  balanced: "Balanced",
  urgency_first: "Urgency-first",
  regional_affinity: "Regional affinity",
  fairness: "Fairness",
};
const PLAIN: Record<string, string> = {
  balanced: "Weighs region, urgency, shift, skill and load equally.",
  urgency_first: "P1s and on-shift people count double.",
  regional_affinity: "Keeps cases inside their own region.",
  fairness: "Spreads work evenly so nobody drowns.",
};

export default function SimulatePage() {
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const [hours, setHours] = useState(24);
  const [focus, setFocus] = useState<string | null>(null);
  const sim = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/routing/simulate", { body: { hours } })),
    onSuccess: (r) => setFocus(r.best_preset),
  });
  const apply = useMutation({
    mutationFn: async (preset: string) =>
      unwrap(await api.PUT("/api/routing/preset", { body: { preset } })),
    onSuccess: (d) => {
      push({
        callsign: "VECTORING",
        message: `PRESET > ${NAMES[d.preset]?.toUpperCase()} · NEW FLIGHTS ROUTE THIS WAY`,
        tone: "ice",
      });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  const r: Result | undefined = sim.data;
  const chosen = r?.outcomes.find((o) => o.preset === (focus ?? r.best_preset));
  const chart = chosen
    ? Object.entries(chosen.load).map(([name, n]) => ({ name: name.split(" ")[0], n }))
    : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="F3"
        eyebrow="Routing simulator"
        title={
          <>
            Replay the day. <em className="text-beacon">Pick the winner.</em>
          </>
        }
        plain="Before changing how cases are assigned, test it. The simulator replays the real cases from the last hours under each routing style, as if each had been live, and counts how many would have missed their deadline, how long cases waited and how evenly the work was shared."
        action={
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="micro">Replay window</span>
              <select
                className="field !py-2"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              >
                {[6, 12, 24, 48, 72, 168].map((h) => (
                  <option key={h} value={h}>
                    Last {h < 48 ? `${h} hours` : `${h / 24} days`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-signal !py-2.5"
              onClick={() => sim.mutate()}
              disabled={sim.isPending}
            >
              <Play size={14} /> {sim.isPending ? "Replaying…" : "Run simulation"}
            </button>
          </div>
        }
      />

      {sim.error ? (
        <ErrorState message={(sim.error as Error).message} onRetry={() => sim.mutate()} />
      ) : !r ? (
        <EmptyState
          title="Ready for replay"
          body="Choose a window and press Run simulation. Only the Airport Director can run it."
        />
      ) : (
        <>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-night text-taxi rounded-2xl px-5 py-4 font-mono text-[13px]"
          >
            <Trophy size={14} className="mr-2 inline" /> {r.reason}
          </motion.p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnimatePresence>
              {r.outcomes.map((o, i) => {
                const best = o.preset === r.best_preset;
                return (
                  <motion.button
                    key={o.preset}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 26 }}
                    onClick={() => setFocus(o.preset)}
                    className={cn(
                      "hud flex flex-col gap-3 p-5 text-left transition",
                      (focus ?? r.best_preset) === o.preset && "!border-night ring-taxi ring-2",
                    )}
                  >
                    <span className="hud-tr" aria-hidden />
                    <span className="hud-bl" aria-hidden />
                    <div className="flex items-center justify-between">
                      <p className="display text-2xl">{NAMES[o.preset]}</p>
                      {best && (
                        <Sign tone="signal">
                          <Trophy size={11} /> Best
                        </Sign>
                      )}
                    </div>
                    <p className="text-text-dim text-[13px]">{PLAIN[o.preset]}</p>
                    <div>
                      <p className="micro">Missed deadlines</p>
                      <p
                        className={cn(
                          "display text-5xl",
                          o.breach_rate > 0.3
                            ? "text-alarm"
                            : o.breach_rate > 0.15
                              ? "text-amber"
                              : "text-signal",
                        )}
                      >
                        <Num value={o.breaches} />
                        <span className="text-text-dim ml-3 align-middle font-mono text-base">
                          {Math.round(o.breach_rate * 100)}%
                        </span>
                      </p>
                    </div>
                    <dl className="border-line grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                      <div>
                        <dt className="micro">Avg wait</dt>
                        <dd className="font-mono">{o.avg_wait_minutes}m</dd>
                      </div>
                      <div>
                        <dt className="micro">In region</dt>
                        <dd className="font-mono">{o.region_match_pct}%</dd>
                      </div>
                      <div>
                        <dt className="micro">Spread</dt>
                        <dd className="font-mono">±{o.load_spread}</dd>
                      </div>
                    </dl>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {chosen && (
            <Hud title={`Who would have carried the load · ${NAMES[chosen.preset]}`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                      formatter={(v) => [`${v} flights`, "assigned"]}
                    />
                    <Bar
                      dataKey="n"
                      fill="var(--color-night)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={700}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-text-dim font-mono text-[12px]">{chosen.reason}</p>
                <button
                  className="btn btn-beacon"
                  onClick={() => apply.mutate(chosen.preset)}
                  disabled={apply.isPending}
                >
                  {apply.isSuccess && apply.variables === chosen.preset ? (
                    <Check size={14} />
                  ) : null}{" "}
                  Apply {NAMES[chosen.preset]} to live routing
                </button>
              </div>
            </Hud>
          )}
        </>
      )}
    </div>
  );
}

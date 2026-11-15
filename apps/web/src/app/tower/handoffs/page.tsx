"use client";

/** Follow-the-Sun: urgent flights move to the region whose working day is starting, with a Handoff Brief. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, Sun, SunMoon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ops/page-header";
import { Hud } from "@/components/ui/hud";
import { Sign } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap } from "@/lib/api/client";
import { REGION_LABEL } from "@/lib/format";
import { useTowerCalls } from "@/lib/stores/tower-calls";

export default function HandoffsPage() {
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const q = useQuery({
    queryKey: ["handoffs"],
    queryFn: async () => unwrap(await api.GET("/api/handoffs/plan")),
    refetchInterval: 60_000,
  });
  const apply = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/handoffs/apply")),
    onSuccess: (r) => {
      push({
        callsign: "FOLLOW THE SUN",
        message: `${r.moved} FLIGHTS HANDED OVER WITH BRIEFS`,
        tone: "signal",
      });
      void qc.invalidateQueries({ queryKey: ["handoffs"] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
  const plans = q.data?.plans ?? [];
  const ready = plans.filter((p) => p.to_user_id);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="E3"
        eyebrow="Follow the sun"
        title={
          <>
            Urgent work never <em className="text-beacon">sleeps.</em>
          </>
        }
        plain="When a controller's shift ends, urgent cases close to check-in should not wait until morning. OpsDesk hands them to someone whose working day is starting, skips regions on a public holiday or weekend, and writes a short Handoff Brief so the next person knows exactly where things stand."
        action={
          <button
            className="btn btn-signal"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || ready.length === 0}
          >
            <Sun size={14} /> Hand over {ready.length} flights
          </button>
        }
      />
      {q.isLoading ? (
        <LoadingStrips rows={5} />
      ) : q.error || !q.data ? (
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(q.data.regions).map(([r, off]) => (
              <div key={r} className="hud flex items-center gap-3 p-4">
                <span className="hud-tr" aria-hidden />
                <span className="hud-bl" aria-hidden />
                {off ? (
                  <SunMoon className="text-text-dim" size={22} />
                ) : (
                  <Sun className="text-beacon" size={22} />
                )}
                <div>
                  <p className="display text-2xl">{REGION_LABEL[r] ?? r}</p>
                  <p className="micro">{off ?? "Working day"}</p>
                </div>
              </div>
            ))}
          </div>
          {plans.length === 0 ? (
            <EmptyState
              title="Nothing to hand over"
              body="Every urgent flight has an owner who is on shift right now."
            />
          ) : (
            <Hud title={`Handoff plan · ${plans.length} urgent flights with an off-shift owner`}>
              <ul className="flex flex-col gap-3">
                {plans.map((p, i) => (
                  <motion.li
                    key={p.ticket_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-line rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/tower/t/${p.number}`}
                        className="font-mono font-semibold hover:underline"
                      >
                        {p.number}
                      </Link>
                      <ArrowRight size={14} className="text-text-dim" />
                      {p.to_name ? (
                        <Sign tone="dark">{p.to_name}</Sign>
                      ) : (
                        <Sign tone="alarm">No one available</Sign>
                      )}
                      <span className="micro">{p.reason}</span>
                    </div>
                    {p.brief && (
                      <p className="bg-ink-900 mt-2 rounded-lg p-3 text-[13px]">{p.brief}</p>
                    )}
                  </motion.li>
                ))}
              </ul>
            </Hud>
          )}
        </>
      )}
    </div>
  );
}

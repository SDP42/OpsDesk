"use client";

/** Supplier Scorecard: reliability of every partner organisation, worst first. */
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ops/page-header";
import { Num, Sign, Tip } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap } from "@/lib/api/client";

const tone = (r: number) =>
  r >= 75 ? "var(--color-signal)" : r >= 50 ? "var(--color-amber)" : "var(--color-alarm)";

export default function SuppliersPage() {
  const q = useQuery({
    queryKey: ["scorecard"],
    queryFn: async () => unwrap(await api.GET("/api/suppliers/scorecard")),
  });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="E2"
        eyebrow="Supplier scorecard"
        title={
          <>
            Know which partner <em className="text-beacon">will answer.</em>
          </>
        }
        plain="Every hotel, bedbank and DMC we work with is scored from how fast they reply on side conversations, how many bookings they still have not confirmed and how many tickets their bookings cause. The weakest partners are at the top, with the best contact to chase."
      />
      {q.isLoading ? (
        <LoadingStrips rows={5} />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="No suppliers yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((s, i) => (
            <motion.article
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="hud flex flex-col gap-4 p-5"
            >
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="display text-2xl">{s.name}</p>
                  <Sign tone="outline" className="mt-1">
                    {s.region}
                  </Sign>
                </div>
                <Tip label={s.reason}>
                  <div className="relative grid size-20 place-items-center">
                    <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="var(--color-ink-700)"
                        strokeWidth="7"
                      />
                      <motion.circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke={tone(s.reliability)}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 34}
                        initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - s.reliability / 100) }}
                        transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </svg>
                    <span className="tabular font-mono text-lg">
                      <Num value={Math.round(s.reliability)} />
                    </span>
                  </div>
                </Tip>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  [
                    "Median reply",
                    s.median_reply_minutes != null ? `${s.median_reply_minutes} min` : "n/a",
                  ],
                  ["Awaiting reply", s.awaiting_reply],
                  ["Unconfirmed bookings", s.unconfirmed_bookings],
                  ["Tickets (30 days)", s.tickets_30d],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="micro">{k}</dt>
                    <dd className="mt-0.5 font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
              <a href={`mailto:${s.best_contact}`} className="btn mt-auto self-start !py-1.5">
                <Mail size={13} /> {s.best_contact}
              </a>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/** Ghost Flights: bookings predicted to become tickets, handled before the agency writes in. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Ghost, Send } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/ops/page-header";
import { Num, Sign } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { clock, tMinus } from "@/lib/format";
import { useTowerCalls } from "@/lib/stores/tower-calls";

type G = Schemas["GhostOut"];
const BAND = {
  high: "var(--color-alarm)",
  medium: "var(--color-amber)",
  low: "var(--color-signal)",
} as const;

function GhostCard({ g }: { g: G }) {
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const [msg, setMsg] = useState(g.recommended_message);
  const send = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/api/ghosts/{tboh}/preempt", {
          params: { path: { tboh: g.tboh } },
          body: { message: msg },
        }),
      ),
    onSuccess: (r) => {
      push({
        callsign: g.tboh,
        message: `GHOST DISSOLVED · MESSAGE SENT TO ${(r.sent_to ?? "agency").toUpperCase()}`,
        tone: "signal",
      });
      void qc.invalidateQueries({ queryKey: ["ghosts"] });
    },
  });
  const color = BAND[g.band as keyof typeof BAND] ?? "var(--color-amber)";
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="hud flex flex-col gap-4 p-5"
      style={{ borderStyle: "dashed" }}
    >
      <span className="hud-tr" aria-hidden />
      <span className="hud-bl" aria-hidden />
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] font-semibold">{g.tboh}</p>
          <p className="display mt-1 text-2xl">{g.hotel}</p>
          <p className="micro mt-1">
            {g.agency} · {g.supplier} · check-in {clock(g.check_in)} ({tMinus(g.check_in)})
          </p>
        </div>
        <div className="text-right">
          <p className="display text-5xl" style={{ color }}>
            <Num value={Math.round(g.risk * 100)} />%
          </p>
          <p className="micro" style={{ color }}>
            {g.band} risk
          </p>
        </div>
      </header>
      <div className="bg-ink-700 h-1.5 overflow-hidden rounded-full">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${g.risk * 100}%` }}
          transition={{ duration: 1 }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {g.drivers.map((d) => (
          <Sign key={d.feature} tone="outline">
            {d.label} +{Math.round(d.impact * 100)}%
          </Sign>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="micro">Pre-emptive message to the agency</span>
        <textarea
          className="field min-h-20 text-sm"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
      </label>
      <button
        className="btn btn-signal self-start"
        onClick={() => send.mutate()}
        disabled={send.isPending || msg.length < 5}
      >
        <Send size={13} /> Send and dissolve ghost
      </button>
    </motion.article>
  );
}

export default function GhostsPage() {
  const q = useQuery({
    queryKey: ["ghosts"],
    queryFn: async () => unwrap(await api.GET("/api/ghosts")),
    refetchInterval: 60_000,
  });
  const data = q.data ?? [];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="D1"
        eyebrow="Ghost flights"
        title={
          <>
            Fix it <em className="text-beacon">before</em> they write in.
          </>
        }
        plain="These bookings have not raised a ticket yet, but a model trained on past bookings says they probably will (unconfirmed supplier, close check-in, rate changes). Send a short heads-up now and the problem never becomes a ticket."
        action={
          <div className="hud flex items-center gap-4 px-5 py-3">
            <Ghost className="text-violet" size={22} />
            <div>
              <p className="micro">On the radar</p>
              <p className="display text-4xl">
                <Num value={data.length} />
              </p>
            </div>
          </div>
        }
      />
      {q.isLoading ? (
        <LoadingStrips rows={4} />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No ghosts on the radar"
          body="Every upcoming booking looks healthy. The model re-scores as check-ins approach."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {data.map((g) => (
              <GhostCard key={g.tboh} g={g} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

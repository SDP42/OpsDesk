"use client";

/** Storm Cells: many flights about one hotel or supplier, answered with a single broadcast. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { CloudLightning, Megaphone, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ops/page-header";
import { Num, Sign } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { useMe } from "@/lib/hooks/use-me";
import { useTowerCalls } from "@/lib/stores/tower-calls";

type Storm = Schemas["StormOut"];

function StormCard({ s }: { s: Storm }) {
  const qc = useQueryClient();
  const push = useTowerCalls((x) => x.push);
  const [msg, setMsg] = useState(
    `We are aware of the issue at ${s.label.replace(/ (disruption|outage|wave)$/i, "")} and are rebooking every affected guest at an equivalent property tonight, transfers on us. Your controller will confirm each booking within 2 hours.`,
  );
  const send = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/api/storms/broadcast", { body: { key: s.key, message: msg } })),
    onSuccess: (r) => {
      push({
        callsign: "STORM CELL",
        message: `ONE BROADCAST > ${r.replied} FLIGHTS · ${r.agencies} AGENCIES`,
        tone: "signal",
      });
      void qc.invalidateQueries({ queryKey: ["storms"] });
    },
  });
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="hud overflow-hidden"
    >
      <span className="hud-tr" aria-hidden />
      <span className="hud-bl" aria-hidden />
      <div className="bg-night relative p-6 text-white">
        <div className="animate-pulse-alarm bg-alarm/30 absolute -top-10 -right-10 size-48 rounded-full blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <Sign tone="alarm">
              <CloudLightning size={12} /> Storm cell
            </Sign>
            <h2 className="display mt-3 text-4xl">{s.label}</h2>
            <p className="mt-1 font-mono text-[12px] text-white/60">{s.reason}</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="display text-taxi text-5xl">
                <Num value={s.ticket_ids.length} />
              </p>
              <p className="micro !text-white/60">flights</p>
            </div>
            <div>
              <p className="display text-taxi text-5xl">
                <Num value={s.agencies} />
              </p>
              <p className="micro !text-white/60">agencies</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr]">
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
          {s.tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tower/t/${t.number}`}
                className="border-line hover:border-night flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="font-mono text-[12px] font-semibold">{t.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                <span className="micro shrink-0">{t.agency}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          {s.broadcast_at || send.isSuccess ? (
            <p className="bg-signal/10 text-signal rounded-xl p-4 text-sm">
              Broadcast already sent to every agency in this cell.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="micro">One approved reply to every affected agency</span>
                <textarea
                  className="field min-h-36 text-sm"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                />
              </label>
              <button
                className="btn btn-beacon self-start"
                onClick={() => send.mutate()}
                disabled={send.isPending || msg.length < 10}
              >
                <Megaphone size={14} /> Broadcast to {s.ticket_ids.length} flights
              </button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function StormsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["storms"],
    queryFn: async () => unwrap(await api.GET("/api/storms")),
    refetchInterval: 20_000,
  });
  const chaos = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/api/admin/chaos", { params: { query: { count: 40 } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["storms"] }),
  });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="D2"
        eyebrow="Storm cells"
        title={
          <>
            One incident. <em className="text-alarm">One reply.</em>
          </>
        }
        plain="When five or more cases about the same hotel, supplier or problem arrive within an hour, OpsDesk groups them into one incident. Write one approved message and it goes to every affected agency at once, instead of forty copy-pastes."
        action={
          me.data?.role === "lead" ? (
            <button
              className="btn btn-alarm"
              onClick={() => chaos.mutate()}
              disabled={chaos.isPending}
            >
              <Zap size={14} /> {chaos.isPending ? "Injecting…" : "Run chaos mode"}
            </button>
          ) : undefined
        }
      />
      {q.isLoading ? (
        <LoadingStrips rows={3} />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          title="Clear weather"
          body="No clusters right now. The Airport Director can run Chaos Mode to see a storm form live."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {q.data.map((s) => (
            <StormCard key={s.key} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

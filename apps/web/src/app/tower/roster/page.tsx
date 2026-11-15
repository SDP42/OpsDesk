"use client";

/** Crew Roster: HRMS (Darwinbox-style) leave and shifts flow straight into routing. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { CalendarOff, RefreshCw, Shuffle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ops/page-header";
import { Hud } from "@/components/ui/hud";
import { Sign } from "@/components/ui/primitives";
import { ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { clock } from "@/lib/format";
import { useMe } from "@/lib/hooks/use-me";
import { useTowerCalls } from "@/lib/stores/tower-calls";

const AVAIL = { online: "bg-signal", busy: "bg-amber", away: "bg-alarm" } as const;

export default function RosterPage() {
  const me = useMe();
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const q = useQuery({
    queryKey: ["roster"],
    queryFn: async () => unwrap(await api.GET("/api/roster")),
  });
  const [form, setForm] = useState({
    user_id: "",
    kind: "leave" as "leave" | "weekly_off" | "shift_change",
    start: "",
    end: "",
    note: "",
  });
  const sync = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/roster/sync")),
    onSuccess: (r) => {
      push({
        callsign: "DARWINBOX",
        message: `${r.imported} RECORDS IMPORTED (${r.mode.toUpperCase()})`,
        tone: "ice",
      });
      void qc.invalidateQueries({ queryKey: ["roster"] });
    },
  });
  const rebalance = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/roster/rebalance")),
    onSuccess: (r) => {
      push({
        callsign: "CREW ROSTER",
        message: `${r.moved} ORPHANED FLIGHTS RE-VECTORED`,
        tone: "ice",
      });
      void qc.invalidateQueries({ queryKey: ["roster"] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/api/roster/records", {
          body: { ...form, note: form.note || "Added by Airport Director" },
        }),
      ),
    onSuccess: (d) => qc.setQueryData(["roster"], d),
  });

  if (q.isLoading) return <LoadingStrips rows={6} />;
  if (q.error || !q.data)
    return <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />;
  const d = q.data;
  const isLead = me.data?.role === "lead";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="E1"
        eyebrow="Crew roster · HRMS sync"
        title={
          <>
            Nobody gets a case <em className="text-beacon">on their day off.</em>
          </>
        }
        plain="Leave, weekly offs and shift changes come straight from the HR system (Darwinbox-style feed). OpsDesk stops routing to anyone who is away and spots cases still owned by someone on leave, so they can be handed over before the guest is affected."
        action={
          <div className="flex flex-col items-end gap-2">
            <Sign tone="dark">
              <RefreshCw size={11} /> {d.source} · synced {clock(d.synced_at)}
            </Sign>
            {isLead && (
              <button
                className="btn !py-1.5"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
              >
                <RefreshCw size={13} className={sync.isPending ? "animate-spin" : ""} /> Sync from
                Darwinbox
              </button>
            )}
            {sync.data && (
              <p className="text-text-dim font-mono text-[11px]">
                {sync.data.mode} · {sync.data.imported} imported · {sync.data.skipped} skipped
                {sync.data.errors.length ? ` · ${sync.data.errors.length} warnings` : ""}
              </p>
            )}
          </div>
        }
      />

      {d.orphans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hud border-alarm/40 bg-alarm/5 p-5"
        >
          <span className="hud-tr" aria-hidden />
          <span className="hud-bl" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro !text-alarm">Orphan risk · {d.orphans.length} flights</p>
              <p className="mt-1 text-[15px]">
                These cases belong to someone the HR system says is away today.
              </p>
            </div>
            <button
              className="btn btn-signal"
              onClick={() => rebalance.mutate()}
              disabled={rebalance.isPending}
            >
              <Shuffle size={14} /> Re-vector all now
            </button>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {d.orphans.slice(0, 18).map((o) => (
              <li key={o.ticket_id}>
                <Link
                  href={`/tower/t/${o.number}`}
                  className="sign !text-night ring-alarm/40 hover:!bg-taxi !bg-white ring-1"
                  title={o.reason}
                >
                  {o.number}
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Hud title="Today's crew">
          <ul className="grid gap-3 sm:grid-cols-2">
            {d.crew.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "rounded-xl border p-4",
                  c.on_leave ? "border-alarm/30 bg-alarm/5" : "border-line bg-ink-900",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-night text-taxi relative grid size-10 place-items-center rounded-full font-mono text-[12px]">
                    {c.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                    <span
                      className={cn(
                        "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-white",
                        AVAIL[c.availability as keyof typeof AVAIL] ?? "bg-line",
                      )}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{c.name}</p>
                    <p className="micro">
                      {c.shift_start ? `${c.shift_start}-${c.shift_end}` : "flexible"} ·{" "}
                      {c.source === "hrms" ? "HRMS" : "presence"}
                    </p>
                  </div>
                  {c.on_leave && <CalendarOff size={16} className="text-alarm" />}
                </div>
                <p className="text-text-dim mt-2 text-[13px]">{c.reason}</p>
              </motion.li>
            ))}
          </ul>
        </Hud>
        <div className="flex flex-col gap-6">
          <Hud title="Upcoming from HRMS">
            {d.upcoming.length === 0 ? (
              <p className="text-text-dim text-sm">No upcoming leave.</p>
            ) : (
              <ol className="border-line relative flex flex-col gap-3 border-l pl-4">
                {d.upcoming.map((u, i) => (
                  <li key={i} className="relative">
                    <span className="bg-beacon absolute top-1.5 -left-[21px] size-2 rounded-full" />
                    <p className="text-sm">
                      {u.user} ·{" "}
                      <span className="text-text-dim">{(u.kind ?? "").replace("_", " ")}</span>
                    </p>
                    <p className="micro">
                      {u.start} → {u.end} {u.note && `· ${u.note}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Hud>
          {isLead && (
            <Hud title="Add an HRMS record">
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  add.mutate();
                }}
              >
                <select
                  className="field"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  required
                  aria-label="Controller"
                >
                  <option value="">Controller…</option>
                  {d.crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
                  aria-label="Type"
                >
                  <option value="leave">Leave</option>
                  <option value="weekly_off">Weekly off</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="field"
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                    required
                    aria-label="Start"
                  />
                  <input
                    type="date"
                    className="field"
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                    required
                    aria-label="End"
                  />
                </div>
                <input
                  className="field"
                  placeholder="Note (optional)"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
                <button className="btn btn-signal justify-self-start" disabled={add.isPending}>
                  Save record
                </button>
              </form>
            </Hud>
          )}
        </div>
      </div>
    </div>
  );
}

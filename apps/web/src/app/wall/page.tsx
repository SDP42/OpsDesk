"use client";

/**
 * Wall Mode: a full-screen big board for the ops-floor TV. Live radar, big counters,
 * rotating panels (SLA risk, storms, ghosts, crew, emerging themes) and a tower-call
 * ticker fed by the same SSE stream as the app.
 */
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RadarScope } from "@/components/tower/radar-scope";
import { Num } from "@/components/ui/primitives";
import { api, unwrap, type Ticket } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SLA_COLOR, tMinus } from "@/lib/format";
import { STAFF_ROLES, useRequireRole } from "@/lib/hooks/use-me";
import { useTowerStream } from "@/lib/hooks/use-tower-stream";
import { useTowerCalls, type TowerCall } from "@/lib/stores/tower-calls";

const PANELS = ["risk", "storms", "ghosts", "crew", "weather"] as const;
const TITLES: Record<(typeof PANELS)[number], string> = {
  risk: "Lowest fuel on the board",
  storms: "Storm cells",
  ghosts: "Ghost flights",
  crew: "Crew on leave today",
  weather: "Emerging themes",
};

function useClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const t = () => setNow(new Date().toISOString().slice(11, 19));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function WallPage() {
  const me = useRequireRole(STAFF_ROLES);
  const ok = !!me.data && STAFF_ROLES.includes(me.data.role as (typeof STAFF_ROLES)[number]);
  const stream = useTowerStream(ok);
  const clock = useClock();
  const [panel, setPanel] = useState(0);
  const [log, setLog] = useState<TowerCall[]>([]);

  useEffect(() => {
    const id = setInterval(() => setPanel((p) => (p + 1) % PANELS.length), 10_000);
    return () => clearInterval(id);
  }, []);
  useEffect(
    () =>
      useTowerCalls.subscribe((s, prev) => {
        const fresh = s.calls.filter((c) => !prev.calls.some((p) => p.id === c.id));
        if (fresh.length) setLog((l) => [...fresh, ...l].slice(0, 30));
      }),
    [],
  );

  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: async () => unwrap(await api.GET("/api/stats/overview")),
    enabled: ok,
    refetchInterval: 20_000,
  });
  const radar = useQuery({
    queryKey: ["tickets", "wall"],
    queryFn: async () => {
      const r = await api.GET("/api/tickets", {
        params: { query: { view: "open", limit: 200, sort: "sla_asc" } },
      });
      return (r.data as unknown as { data: Ticket[] } | undefined)?.data ?? [];
    },
    enabled: ok,
    refetchInterval: 30_000,
  });
  const storms = useQuery({
    queryKey: ["storms"],
    queryFn: async () => unwrap(await api.GET("/api/storms")),
    enabled: ok,
    refetchInterval: 30_000,
  });
  const ghosts = useQuery({
    queryKey: ["ghosts"],
    queryFn: async () => unwrap(await api.GET("/api/ghosts")),
    enabled: ok,
    refetchInterval: 60_000,
  });
  const roster = useQuery({
    queryKey: ["roster"],
    queryFn: async () => unwrap(await api.GET("/api/roster")),
    enabled: ok,
    refetchInterval: 60_000,
  });
  const heat = useQuery({
    queryKey: ["heatmap"],
    queryFn: async () => unwrap(await api.GET("/api/insights/heatmap")),
    enabled: ok && me.data?.role !== "escalation_manager",
  });

  if (!ok) {
    return (
      <div className="bg-night grid min-h-dvh place-items-center font-mono text-white/60">
        Establishing contact…
      </div>
    );
  }
  const o = overview.data;
  const key = PANELS[panel]!;
  const risk = (radar.data ?? [])
    .filter((t) => ["breached", "critical", "at_risk"].includes(t.sla.state))
    .slice(0, 7);

  return (
    <div className="bg-night relative min-h-dvh overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:64px_64px] opacity-[0.07]" />
      <header className="relative flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4">
          <Link href="/tower" className="text-white/50 hover:text-white" aria-label="Back to tower">
            <ArrowLeft size={18} />
          </Link>
          <span className="sign">Wall mode</span>
          <span className="font-serif text-3xl">OpsDesk Control Tower</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-mono text-xs tracking-widest text-white/60 uppercase">
            <span
              className={cn(
                "size-2 rounded-full",
                stream.connected ? "bg-signal" : "bg-alarm animate-pulse-alarm",
              )}
            />
            {stream.connected ? "Live" : "Reconnecting"}
          </span>
          <span className="text-taxi tabular font-mono text-4xl tracking-wider">{clock}Z</span>
          <button
            className="text-white/50 hover:text-white"
            aria-label="Full screen"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </header>

      <div className="relative grid grid-cols-2 gap-4 px-8 lg:grid-cols-5">
        {(
          [
            ["Open flights", o?.open, "text-white"],
            ["Unassigned", o?.unassigned, "text-taxi"],
            ["With Tower Chief", o?.escalated, "text-beacon"],
            ["Breached", o?.by_sla?.breached, "text-alarm"],
            ["Storm cells", storms.data?.length, "text-alarm"],
          ] as const
        ).map(([label, v, cls]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4">
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">
              {label}
            </p>
            <p className={cn("display mt-1 text-7xl", cls)}>
              <Num value={v ?? 0} />
            </p>
          </div>
        ))}
      </div>

      <div className="relative grid gap-6 px-8 py-6 xl:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <RadarScope tickets={radar.data ?? []} size={560} />
        </div>
        <div className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <h2 className="display text-4xl">{TITLES[key]}</h2>
            <div className="flex gap-1.5">
              {PANELS.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setPanel(i)}
                  aria-label={TITLES[p]}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === panel ? "bg-taxi w-8" : "w-3 bg-white/25",
                  )}
                />
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.ul
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="mt-5 flex flex-1 flex-col gap-2.5"
            >
              {key === "risk" &&
                risk.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-4 rounded-xl bg-white/[0.05] px-4 py-3"
                  >
                    <span
                      className="h-10 w-1.5 rounded-full"
                      style={{ background: SLA_COLOR[t.sla.state] }}
                    />
                    <span className="w-28 font-mono text-lg">{t.number}</span>
                    <span className="min-w-0 flex-1 truncate text-lg">{t.title}</span>
                    <span className="font-mono text-white/60">{tMinus(t.check_in)}</span>
                  </li>
                ))}
              {key === "storms" &&
                (storms.data?.length ? storms.data : []).map((s) => (
                  <li key={s.key} className="rounded-xl bg-white/[0.05] px-4 py-3">
                    <p className="text-2xl">{s.label}</p>
                    <p className="font-mono text-sm text-white/60">{s.reason}</p>
                  </li>
                ))}
              {key === "ghosts" &&
                (ghosts.data ?? []).slice(0, 6).map((g) => (
                  <li
                    key={g.tboh}
                    className="flex items-center gap-4 rounded-xl bg-white/[0.05] px-4 py-3"
                  >
                    <span className="text-violet w-20 font-mono text-2xl">
                      {Math.round(g.risk * 100)}%
                    </span>
                    <span className="min-w-0 flex-1 truncate text-lg">
                      {g.hotel} · {g.agency}
                    </span>
                    <span className="font-mono text-white/60">{g.tboh}</span>
                  </li>
                ))}
              {key === "crew" &&
                (roster.data?.crew ?? [])
                  .filter((c) => c.on_leave)
                  .map((c) => (
                    <li key={c.id} className="rounded-xl bg-white/[0.05] px-4 py-3">
                      <p className="text-2xl">{c.name}</p>
                      <p className="font-mono text-sm text-white/60">{c.reason}</p>
                    </li>
                  ))}
              {key === "weather" &&
                (heat.data?.themes ?? []).slice(0, 6).map((t) => (
                  <li
                    key={String(t.code)}
                    className="flex items-center gap-4 rounded-xl bg-white/[0.05] px-4 py-3"
                  >
                    <span className="flex-1 text-lg">{String(t.label)}</span>
                    {t.emerging ? (
                      <span className="sign !bg-alarm animate-pulse-alarm !text-white">
                        Emerging
                      </span>
                    ) : null}
                    <span className="flex h-8 items-end gap-0.5">
                      {(t.counts as number[]).map((v, i, arr) => (
                        <span
                          key={i}
                          className="bg-taxi w-2 rounded-sm"
                          style={{ height: `${Math.max(8, (v / Math.max(...arr, 1)) * 100)}%` }}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              {key === "storms" && !storms.data?.length && (
                <li className="text-white/50">Clear weather: no clusters right now.</li>
              )}
              {key === "crew" && !roster.data?.crew.some((c) => c.on_leave) && (
                <li className="text-white/50">Everyone is on duty.</li>
              )}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>

      <footer className="bg-taxi text-night absolute inset-x-0 bottom-0 overflow-hidden py-3">
        <div className="flex w-max animate-[ticker_60s_linear_infinite] gap-12 font-mono text-sm font-semibold tracking-wider uppercase">
          {(log.length
            ? [...log, ...log]
            : [
                {
                  id: 0,
                  callsign: "TOWER",
                  message: "Listening on 118.40 · live tower calls appear here",
                  tone: "signal",
                },
              ]
          ).map((c, i) => (
            <span key={`${c.id}-${i}`} className="whitespace-nowrap">
              ✈ {c.callsign} {c.message}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}

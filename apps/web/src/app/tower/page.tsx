"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Zap } from "lucide-react";
import { RadarScope } from "@/components/tower/radar-scope";
import { StripList } from "@/components/tower/strip-list";
import { Hud } from "@/components/ui/hud";
import { ErrorState } from "@/components/ui/states";
import { api, unwrap, type Ticket } from "@/lib/api/client";
import { REGION_LABEL, SLA_COLOR, SLA_LABEL } from "@/lib/format";
import { useMe } from "@/lib/hooks/use-me";
import { useTowerCalls } from "@/lib/stores/tower-calls";

const PRESETS = [
  { id: "balanced", label: "Balanced" },
  { id: "urgency_first", label: "Urgency-first" },
  { id: "regional_affinity", label: "Regional affinity" },
  { id: "fairness", label: "Fairness" },
] as const;

export default function TowerOverview() {
  const me = useMe();
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: async () => unwrap(await api.GET("/api/stats/overview")),
    refetchInterval: 30_000,
  });
  const radar = useQuery({
    queryKey: ["tickets", "radar"],
    queryFn: async () => {
      const r = await api.GET("/api/tickets", { params: { query: { view: "open", limit: 200, sort: "sla_asc" } } });
      return (r.data as unknown as { data: Ticket[] } | undefined)?.data ?? [];
    },
    refetchInterval: 60_000,
  });
  const setPreset = useMutation({
    mutationFn: async (preset: string) => unwrap(await api.PUT("/api/routing/preset", { body: { preset } })),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["overview"] });
      push({ callsign: "VECTORING", message: `PRESET > ${d.preset.replace("_", " ").toUpperCase()}`, tone: "ice" });
    },
  });

  const o = overview.data;
  const isLead = me.data?.role === "lead";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro text-signal">Tower overview</p>
          <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
            {o ? o.open : "—"} flights in <em>the air</em>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-line" role="radiogroup" aria-label="Routing preset">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={o?.preset === p.id}
                disabled={!isLead || setPreset.isPending}
                title={isLead ? `Route new flights with ${p.label}` : "Only the Airport Director can switch presets"}
                onClick={() => setPreset.mutate(p.id)}
                className={clsx(
                  "px-3 py-2 font-mono text-[11px] tracking-wider uppercase transition-colors",
                  o?.preset === p.id ? "bg-signal text-ink-950" : "text-text-dim hover:text-text disabled:hover:text-text-dim",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn btn-alarm" disabled title="Chaos Mode lands in Phase 4 (use `make chaos` meanwhile)">
            <Zap size={14} strokeWidth={1.5} /> Chaos mode
          </button>
        </div>
      </div>

      {overview.error ? (
        <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Open flights" value={o?.open} />
          <Tile label="Unassigned (triage)" value={o?.unassigned} tone="amber" />
          <Tile label="With Tower Chief" value={o?.escalated} tone="alarm" />
          <Tile label="Breached" value={o?.by_sla?.breached ?? (o ? 0 : undefined)} tone="alarm" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,460px)_1fr]">
        <Hud title="Radar · open flights by region" bodyClassName="p-5">
          {radar.isLoading ? (
            <div className="skeleton mx-auto aspect-square w-full max-w-[420px] rounded-full" />
          ) : (
            <RadarScope tickets={radar.data ?? []} />
          )}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(REGION_LABEL).map(([code, label]) => (
              <div key={code} className="flex items-center justify-between border-b border-line/60 pb-1">
                <span className="micro">{label}</span>
                <span className="font-mono text-sm tabular">{o?.by_region?.[code] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {["ok", "at_risk", "critical", "breached"].map((s) => (
              <span key={s} className="micro flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: SLA_COLOR[s] }} />
                {SLA_LABEL[s]} {o?.by_sla?.[s] ?? 0}
              </span>
            ))}
          </div>
        </Hud>

        <Hud title="SLA risk board · lowest fuel first" bodyClassName="p-3">
          <StripList
            query={{ view: "open", sort: "sla_asc", sla_state: ["breached", "critical", "at_risk"], limit: 12 }}
            emptyTitle="All flights on course"
            emptyBody="Nothing is at risk right now. The board fills as check-in or LCD approaches."
          />
        </Hud>
      </div>
    </div>
  );
}

function Tile({ label, value, tone = "signal" }: { label: string; value?: number; tone?: "signal" | "amber" | "alarm" }) {
  const color = { signal: "text-signal", amber: "text-amber", alarm: "text-alarm" }[tone];
  return (
    <div className="hud px-4 py-3">
      <span className="hud-tr" aria-hidden />
      <span className="hud-bl" aria-hidden />
      <p className="micro">{label}</p>
      {value === undefined ? (
        <div className="skeleton mt-2 h-9 w-16" />
      ) : (
        <p className={clsx("mt-1 font-mono text-4xl tabular", color)}>{value}</p>
      )}
    </div>
  );
}

"use client";

/** Weather Radar: themes from conversations, as a heat map with emerging spikes and product links. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Link2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ops/page-header";
import { Hud } from "@/components/ui/hud";
import { Num, Sign, Tip } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap } from "@/lib/api/client";
import { useMe } from "@/lib/hooks/use-me";

function cellColor(v: number, max: number): string {
  if (v === 0) return "var(--color-ink-700)";
  const t = Math.min(1, v / Math.max(max, 1));
  // paper -> signage yellow -> beacon orange -> alarm red
  if (t < 0.34) return `color-mix(in oklab, var(--color-taxi) ${Math.round(30 + t * 180)}%, white)`;
  if (t < 0.67)
    return `color-mix(in oklab, var(--color-beacon) ${Math.round((t - 0.33) * 260)}%, var(--color-taxi))`;
  return `color-mix(in oklab, var(--color-alarm) ${Math.round((t - 0.66) * 290)}%, var(--color-beacon))`;
}

function ProductLink({
  code,
  value,
  editable,
}: {
  code: string;
  value: string | null;
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.PATCH("/api/insights/themes/{code}", {
          params: { path: { code } },
          body: { product_link: v },
        }),
      ),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["heatmap"] });
    },
  });
  if (!editable)
    return value ? (
      <Sign tone="outline">
        <Link2 size={11} /> {value}
      </Sign>
    ) : null;
  return editing ? (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <input
        autoFocus
        className="field !py-1 text-xs"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="JIRA-123 or roadmap link"
        aria-label="Product link"
      />
      <button className="btn !px-2 !py-1">Save</button>
    </form>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="sign !text-text-dim ring-line hover:!text-text !bg-transparent ring-1"
    >
      <Link2 size={11} /> {value || "Add product link"}
    </button>
  );
}

export default function InsightsPage() {
  const me = useMe();
  const heat = useQuery({
    queryKey: ["heatmap"],
    queryFn: async () =>
      unwrap(await api.GET("/api/insights/heatmap", { params: { query: { weeks: 8 } } })),
  });
  const week = useQuery({
    queryKey: ["insights"],
    queryFn: async () => unwrap(await api.GET("/api/insights/themes")),
  });
  const isLead = me.data?.role === "lead";

  if (heat.isLoading || week.isLoading) return <LoadingStrips rows={6} />;
  if (heat.error || week.error || !heat.data || !week.data)
    return (
      <ErrorState
        onRetry={() => {
          void heat.refetch();
          void week.refetch();
        }}
      />
    );
  const max = Math.max(1, ...heat.data.themes.flatMap((t) => t.counts as number[]));
  const emerging = heat.data.themes.filter((t) => t.emerging);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        gate="F1"
        eyebrow="Weather radar"
        title={
          <>
            Hear the weather <em className="text-ice">before the storm.</em>
          </>
        }
        plain="Every case is tagged with what it is really about (refund delays, inventory sync, overbooking…). This screen shows which problems are growing week by week, flags sudden spikes as 'emerging', and lets you attach a product ticket so engineering fixes the cause instead of ops answering it forever."
        action={
          <div className="flex gap-3">
            <div className="hud px-5 py-3">
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <p className="micro">Tickets this week</p>
              <p className="display text-4xl">
                <Num value={week.data.total_tickets} />
              </p>
            </div>
            <div className="hud px-5 py-3">
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <p className="micro !text-alarm">Emerging</p>
              <p className="display text-alarm text-4xl">
                <Num value={emerging.length} />
              </p>
            </div>
          </div>
        }
      />

      <Hud title="Theme heat map · last 8 weeks">
        {heat.data.themes.length === 0 ? (
          <EmptyState title="No themes yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="micro text-left font-normal">Theme</th>
                  {heat.data.weeks.map((w) => (
                    <th key={w} className="micro font-normal">
                      {w.slice(5)}
                    </th>
                  ))}
                  <th className="micro text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {heat.data.themes.map((t, row) => (
                  <tr key={String(t.code)}>
                    <td className="pr-3 text-sm whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {String(t.label)}
                        {t.emerging ? (
                          <Sign tone="alarm" className="animate-pulse-alarm !py-0 !text-[9px]">
                            Emerging
                          </Sign>
                        ) : null}
                      </span>
                    </td>
                    {(t.counts as number[]).map((v, i) => (
                      <td key={i} className="p-0">
                        <Tip label={`${String(t.label)} · ${heat.data!.weeks[i]} · ${v} tickets`}>
                          <motion.div
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: row * 0.03 + i * 0.02 }}
                            className="tabular grid h-9 min-w-12 place-items-center rounded-md font-mono text-[11px]"
                            style={{
                              background: cellColor(v, max),
                              color: v / max > 0.6 ? "white" : "var(--color-text)",
                            }}
                          >
                            {v || ""}
                          </motion.div>
                        </Tip>
                      </td>
                    ))}
                    <td className="tabular text-right font-mono text-sm">{Number(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Hud>

      <div className="grid gap-4 md:grid-cols-2">
        {week.data.themes.slice(0, 6).map((t, i) => {
          const linkRow = heat.data!.themes.find((h) => h.code === t.theme);
          const up = (t.wow_change_pct ?? 0) >= 0;
          return (
            <motion.article
              key={t.theme}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="hud flex flex-col gap-3 p-5"
            >
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="display text-3xl">{t.label}</p>
                  <p className="micro mt-1">
                    {t.agencies} agencies affected · {t.reason}
                  </p>
                </div>
                <div className="text-right">
                  <p className="display text-4xl">
                    <Num value={t.count} />
                  </p>
                  {t.wow_change_pct != null && (
                    <p
                      className={`flex items-center justify-end gap-1 font-mono text-[12px] ${up ? "text-alarm" : "text-signal"}`}
                    >
                      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{" "}
                      {Math.abs(t.wow_change_pct)}% vs last week
                    </p>
                  )}
                </div>
              </div>
              <ul className="flex flex-col gap-1">
                {t.samples.slice(0, 3).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/tower/t/${s.number}`}
                      className="hover:bg-ink-900 flex gap-2 rounded-lg px-2 py-1 text-[13px]"
                    >
                      <span className="font-mono font-semibold">{s.number}</span>
                      <span className="text-text-dim truncate">{s.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <ProductLink
                code={t.theme}
                value={(linkRow?.product_link as string | null) ?? t.product_link}
                editable={isLead}
              />
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

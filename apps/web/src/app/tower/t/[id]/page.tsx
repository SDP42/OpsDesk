"use client";

import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { Conversation, Frequencies } from "@/components/tower/conversation";
import { FuelGauge } from "@/components/tower/fuel-gauge";
import { ScoreWaterfall, type RunnerUp, type ScorePart } from "@/components/tower/score-waterfall";
import { TicketActions } from "@/components/tower/ticket-actions";
import { Timeline } from "@/components/tower/timeline";
import { Hud } from "@/components/ui/hud";
import { ConstellationGlyph } from "@/components/ui/glyphs";
import { ErrorState } from "@/components/ui/states";
import { api, ApiError, unwrap, type PilotTicketDetail, type TicketDetail } from "@/lib/api/client";
import { clock, REGION_LABEL, SLA_COLOR, STATUS_LABEL, tMinus } from "@/lib/format";
import { useMe } from "@/lib/hooks/use-me";

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const [mirror, setMirror] = useState(false);
  const q = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => unwrap(await api.GET("/api/tickets/{ticket_id}", { params: { path: { ticket_id: id } } })),
  });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.error) {
    const e = q.error as ApiError;
    return (
      <ErrorState
        title={e.status === 404 ? "Flight not on radar" : "Lost contact"}
        message={e.status === 404 ? `${id} does not exist or is outside your airspace.` : e.message}
        onRetry={e.status === 404 ? undefined : () => q.refetch()}
      />
    );
  }
  if (!q.data || !("guardian" in q.data)) return <ErrorState message="Unexpected response" />;
  const detail = q.data as TicketDetail;
  const t = detail.ticket;
  const scores = (detail.routing?.scores ?? {}) as { breakdown?: ScorePart[]; total?: number; runners_up?: RunnerUp[] };
  const staff = me.data?.role !== "requester";

  return (
    <div className="flex flex-col gap-5">
      {/* Header strip */}
      <div className="flex flex-col gap-3">
        <Link href="/tower" className="micro flex w-fit items-center gap-1.5 hover:text-text">
          <ArrowLeft size={12} /> Tower
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-semibold text-signal">{t.number}</span>
              <span className="border border-line px-2 py-0.5 font-mono text-xs">{t.priority}</span>
              <span className="micro">{STATUS_LABEL[t.status] ?? t.status}</span>
              <span className="micro" style={{ color: SLA_COLOR[t.sla.state] }}>
                {t.sla.state.replace("_", " ")}
              </span>
            </div>
            <h1 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">{t.title}</h1>
            {t.routing_reason && (
              <p className="mt-2 font-mono text-[12px] text-text-dim">
                <span className="text-signal">VECTORED</span> {String((t.routing_reason as { reason?: string }).reason ?? "")}
              </p>
            )}
          </div>
          <button className={clsx("btn", mirror && "border-ice text-ice")} onClick={() => setMirror((m) => !m)} aria-pressed={mirror}>
            <Eye size={14} strokeWidth={1.5} /> Agency mirror
          </button>
        </div>
        {detail.guardian.triggered && (
          <div role="status" className="flex items-center gap-3 border border-amber/50 bg-amber/5 px-4 py-2.5 text-amber">
            <AlertTriangle size={16} strokeWidth={1.5} />
            <span className="font-mono text-[12px] tracking-wide uppercase">
              Third-contact guardian · contact #{detail.guardian.contact_count} · priority raised, Tower Chief notified
            </span>
          </div>
        )}
      </div>

      {mirror ? (
        <AgencyMirror ticketId={t.id} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          {/* Left: linked history + agency profile */}
          <div className="flex flex-col gap-5">
            <Hud title={<span className="flex items-center gap-2"><ConstellationGlyph size={14} /> Linked flights · {detail.links.length}</span>}>
              {detail.links.length === 0 ? (
                <p className="text-sm text-text-dim">No linked history. This is the first contact on this booking and intent.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.links.map((l) => (
                    <li key={l.id}>
                      <Link href={`/tower/t/${l.other_number}`} className="block border border-line px-3 py-2 hover:border-ice">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[13px] text-ice">{l.other_number}</span>
                          <span className="micro">{l.link_type} · {l.strength.toFixed(2)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px]">{l.other_title}</p>
                        <p className="micro mt-1">{l.reason} · {l.other_status}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Hud>
            <Hud title="Airport · agency">
              <p className="font-serif text-2xl">{t.agency.name}</p>
              <p className="micro mt-1">
                {t.agency.city} · {REGION_LABEL[t.agency.region] ?? t.agency.region} · tier {t.agency.tier}
              </p>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="micro">Turbulence (churn risk)</span>
                  <span className="font-mono text-sm tabular">{Math.round(t.agency.turbulence_score)}</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-ink-700">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, t.agency.turbulence_score)}%`,
                      background: t.agency.turbulence_score >= 70 ? "var(--color-alarm)" : t.agency.turbulence_score >= 40 ? "var(--color-amber)" : "var(--color-signal)",
                    }}
                  />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="micro">TBOH</dt>
                <dd className="font-mono">{t.tboh ?? "—"}</dd>
                <dt className="micro">Check-in</dt>
                <dd className="font-mono">{tMinus(t.check_in)}</dd>
                <dt className="micro">LCD</dt>
                <dd className="font-mono">{tMinus(t.lcd)}</dd>
                <dt className="micro">Contacts</dt>
                <dd className="font-mono">{t.contact_count}</dd>
              </dl>
            </Hud>
          </div>

          {/* Centre: conversation */}
          <div className="flex min-w-0 flex-col gap-5">
            <Hud title="Description">
              <p className="text-[15px] whitespace-pre-wrap text-text/90">{t.description || "No description."}</p>
              <p className="micro mt-3">Filed {clock(t.created_at)}</p>
            </Hud>
            <Hud title="Conversation">
              <Conversation ticketId={t.id} staff={staff} />
            </Hud>
            {staff && (
              <Hud title="Frequencies · side conversations">
                <Frequencies ticketId={t.id} />
              </Hud>
            )}
            <Hud title="Co-pilot brief" className="opacity-80">
              <p className="text-sm text-text-dim">
                One-click case summary from linked history arrives in Phase 4 (rule-based by default, optional LLM via env).
              </p>
            </Hud>
          </div>

          {/* Right: wheels-up, routing, intent, actions, timeline */}
          <div className="flex flex-col gap-5">
            <Hud title="Wheels-up clock">
              <div className="flex justify-center">
                <FuelGauge sla={t.sla} size={190} />
              </div>
              <p className="mt-3 text-center font-mono text-[11px] text-text-dim">{t.sla.reason}</p>
              {t.sla.propose_escalation && t.status !== "escalated" && (
                <p className="mt-2 border border-alarm/50 px-3 py-2 text-center font-mono text-[11px] text-alarm">
                  Critical near check-in · escalation proposed
                </p>
              )}
            </Hud>
            <Hud title="Actions">
              <TicketActions ticket={t} role={me.data?.role ?? "agent"} />
            </Hud>
            <Hud title="Vectoring · why this controller">
              {scores.breakdown ? (
                <>
                  <p className="mb-3 text-sm">
                    <span className="text-signal">{detail.routing?.chosen?.name ?? "Triage"}</span>{" "}
                    <span className="micro">preset {detail.routing?.preset}</span>
                  </p>
                  <ScoreWaterfall parts={scores.breakdown} total={scores.total ?? 0} runnersUp={scores.runners_up ?? []} />
                </>
              ) : (
                <p className="text-sm text-text-dim">{t.owner ? `Assigned to ${t.owner.name} manually.` : "Not yet vectored."}</p>
              )}
            </Hud>
            <Hud title="Intent">
              {t.intent ? (
                <>
                  <p className="text-sm">{t.intent.label}</p>
                  <div className="mt-2 h-1.5 bg-ink-700">
                    <div className="h-full bg-violet" style={{ width: `${Math.round((t.intent.confidence ?? 0) * 100)}%` }} />
                  </div>
                  <p className="micro mt-1.5">
                    {Math.round((t.intent.confidence ?? 0) * 100)}% · {t.intent.source}
                    {(t.intent.confidence ?? 1) < 0.55 && <span className="text-amber"> · needs a human</span>}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-dim">Unclassified</p>
              )}
            </Hud>
            <Hud title={`Timeline · ${detail.timeline.length}`}>
              <Timeline events={detail.timeline} />
            </Hud>
          </div>
        </div>
      )}
    </div>
  );
}

/** Exactly what the Pilot sees (same serializer as /pilot via ?as=requester). */
function AgencyMirror({ ticketId }: { ticketId: string }) {
  const q = useQuery({
    queryKey: ["ticket", ticketId, "mirror"],
    queryFn: async () =>
      unwrap(await api.GET("/api/tickets/{ticket_id}", { params: { path: { ticket_id: ticketId }, query: { as: "requester" } } })),
  });
  if (q.isLoading) return <div className="skeleton h-60" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} />;
  const d = q.data as PilotTicketDetail;
  return (
    <Hud title="Agency mirror · what the pilot sees" className="border-ice/60">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Flight" value={d.ticket.number} />
        <Field label="Status" value={STATUS_LABEL[d.ticket.status] ?? d.ticket.status} />
        <Field label="ETA to resolution" value={clock(d.ticket.eta)} />
        <Field label="Controller" value={d.ticket.controller_callsign ?? "Assigning"} />
      </div>
      <p className="micro mt-5">Visible events</p>
      <ul className="mt-2 flex flex-col gap-1 font-mono text-[12px] text-text-dim">
        {d.timeline.map((e) => (
          <li key={e.id}>
            {clock(e.at)} · {e.type.replace("_", " ")}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-text-dim">Internal notes, routing scores and owner identity are never serialised here.</p>
    </Hud>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading flight">
      <div className="skeleton h-24" />
      <div className="grid gap-5 xl:grid-cols-[300px_1fr_340px]">
        <div className="skeleton h-96" />
        <div className="skeleton h-96" />
        <div className="skeleton h-96" />
      </div>
    </div>
  );
}

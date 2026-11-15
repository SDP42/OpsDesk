"use client";

import { Term } from "@/components/ui/term";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { Conversation, Frequencies } from "@/components/tower/conversation";
import { CopilotBrief } from "@/components/tower/copilot-brief";
import { ForecastPanel } from "@/components/tower/forecast-panel";
import { SignalsPanel } from "@/components/tower/signals-panel";
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
    queryFn: async () =>
      unwrap(await api.GET("/api/tickets/{ticket_id}", { params: { path: { ticket_id: id } } })),
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
  const scores = (detail.routing?.scores ?? {}) as {
    breakdown?: ScorePart[];
    total?: number;
    runners_up?: RunnerUp[];
  };
  const staff = me.data?.role !== "requester";

  return (
    <div className="flex flex-col gap-5">
      {/* Header strip */}
      <div className="flex flex-col gap-3">
        <Link href="/tower" className="micro hover:text-text flex w-fit items-center gap-1.5">
          <ArrowLeft size={12} /> Tower
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-signal font-mono text-2xl font-semibold">{t.number}</span>
              <span className="border-line border px-2 py-0.5 font-mono text-xs">{t.priority}</span>
              <span className="micro">{STATUS_LABEL[t.status] ?? t.status}</span>
              <span className="micro" style={{ color: SLA_COLOR[t.sla.state] }}>
                {t.sla.state.replace("_", " ")}
              </span>
            </div>
            <h1 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">
              {t.title}
            </h1>
            {t.routing_reason && (
              <p className="text-text-dim mt-2 font-mono text-[12px]">
                <span className="text-signal">VECTORED</span>{" "}
                {String((t.routing_reason as { reason?: string }).reason ?? "")}
              </p>
            )}
          </div>
          <button
            className={clsx("btn", mirror && "border-ice text-ice")}
            onClick={() => setMirror((m) => !m)}
            aria-pressed={mirror}
          >
            <Eye size={14} strokeWidth={1.5} />{" "}
            <Term k="agency mirror" hint={false}>
              Agency mirror
            </Term>
          </button>
        </div>
        {detail.guardian.triggered && (
          <div
            role="status"
            className="border-amber/50 bg-amber/5 text-amber flex items-center gap-3 border px-4 py-2.5"
          >
            <AlertTriangle size={16} strokeWidth={1.5} />
            <span className="font-mono text-[12px] tracking-wide uppercase">
              Third-contact guardian · contact #{detail.guardian.contact_count} · priority raised,
              Tower Chief notified
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
            <Hud
              title={
                <span className="flex items-center gap-2">
                  <ConstellationGlyph size={14} /> Linked flights · {detail.links.length}
                </span>
              }
            >
              {detail.links.length === 0 ? (
                <p className="text-text-dim text-sm">
                  No linked history. This is the first contact on this booking and intent.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.links.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/tower/t/${l.other_number}`}
                        className="border-line hover:border-ice block border px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-ice font-mono text-[13px]">{l.other_number}</span>
                          <span className="micro">
                            {l.link_type} · {l.strength.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px]">{l.other_title}</p>
                        <p className="micro mt-1">
                          {l.reason} · {l.other_status}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Hud>
            <Hud title="Airport · agency">
              <p className="font-serif text-2xl">{t.agency.name}</p>
              <p className="micro mt-1">
                {t.agency.city} · {REGION_LABEL[t.agency.region] ?? t.agency.region} · tier{" "}
                {t.agency.tier}
              </p>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="micro">
                    <Term k="turbulence">Turbulence (churn risk)</Term>
                  </span>
                  <span className="tabular font-mono text-sm">
                    {Math.round(t.agency.turbulence_score)}
                  </span>
                </div>
                <div className="bg-ink-700 mt-1.5 h-1.5">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, t.agency.turbulence_score)}%`,
                      background:
                        t.agency.turbulence_score >= 70
                          ? "var(--color-alarm)"
                          : t.agency.turbulence_score >= 40
                            ? "var(--color-amber)"
                            : "var(--color-signal)",
                    }}
                  />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="micro">
                  <Term k="tboh">TBOH</Term>
                </dt>
                <dd className="font-mono">
                  {t.tboh ? (
                    <Link
                      href={`/tower/links?tboh=${t.tboh}`}
                      className="hover:text-ice underline decoration-dotted underline-offset-4"
                    >
                      {t.tboh} ↗
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt className="micro">Check-in</dt>
                <dd className="font-mono">{tMinus(t.check_in)}</dd>
                <dt className="micro">
                  <Term k="lcd">LCD</Term>
                </dt>
                <dd className="font-mono">{tMinus(t.lcd)}</dd>
                <dt className="micro">Contacts</dt>
                <dd className="font-mono">{t.contact_count}</dd>
              </dl>
            </Hud>
          </div>

          {/* Centre: conversation */}
          <div className="flex min-w-0 flex-col gap-5">
            <Hud title="Description">
              <p className="text-text/90 text-[15px] whitespace-pre-wrap">
                {t.description || "No description."}
              </p>
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
            <Hud title="Agency mood and promises">
              <SignalsPanel ticketId={t.id} />
            </Hud>
            <Hud title="Co-pilot brief">
              <CopilotBrief ticketId={t.id} />
            </Hud>
          </div>

          {/* Right: wheels-up, routing, intent, actions, timeline */}
          <div className="flex flex-col gap-5">
            <Hud title={<Term k="wheels-up">Wheels-up clock · time left</Term>}>
              <div className="flex justify-center">
                <FuelGauge sla={t.sla} size={190} />
              </div>
              <p className="text-text-dim mt-3 text-center font-mono text-[11px]">{t.sla.reason}</p>
              {t.sla.propose_escalation && t.status !== "escalated" && (
                <p className="border-alarm/50 text-alarm mt-2 border px-3 py-2 text-center font-mono text-[11px]">
                  Critical near check-in · escalation proposed
                </p>
              )}
            </Hud>
            <Hud title={<Term k="sla">Breach forecast · what if I act now?</Term>}>
              <ForecastPanel
                ticketId={t.id}
                minutesLeft={Math.max(1, t.sla.remaining_seconds / 60)}
              />
            </Hud>
            <Hud title="Actions">
              <TicketActions ticket={t} role={me.data?.role ?? "agent"} />
            </Hud>
            <Hud title={<Term k="vectoring">Vectoring · why this person got it</Term>}>
              {scores.breakdown ? (
                <>
                  <p className="mb-3 text-sm">
                    <span className="text-signal">{detail.routing?.chosen?.name ?? "Triage"}</span>{" "}
                    <span className="micro">preset {detail.routing?.preset}</span>
                  </p>
                  <ScoreWaterfall
                    parts={scores.breakdown}
                    total={scores.total ?? 0}
                    runnersUp={scores.runners_up ?? []}
                  />
                </>
              ) : (
                <p className="text-text-dim text-sm">
                  {t.owner ? `Assigned to ${t.owner.name} manually.` : "Not yet vectored."}
                </p>
              )}
            </Hud>
            <Hud title={<Term k="intent">Intent · what it is about</Term>}>
              {t.intent ? (
                <>
                  <p className="text-sm">{t.intent.label}</p>
                  <div className="bg-ink-700 mt-2 h-1.5">
                    <div
                      className="bg-violet h-full"
                      style={{ width: `${Math.round((t.intent.confidence ?? 0) * 100)}%` }}
                    />
                  </div>
                  <p className="micro mt-1.5">
                    {Math.round((t.intent.confidence ?? 0) * 100)}% · {t.intent.source}
                    {(t.intent.confidence ?? 1) < 0.55 && (
                      <span className="text-amber"> · needs a human</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-text-dim text-sm">Unclassified</p>
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
      unwrap(
        await api.GET("/api/tickets/{ticket_id}", {
          params: { path: { ticket_id: ticketId }, query: { as: "requester" } },
        }),
      ),
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
      <ul className="text-text-dim mt-2 flex flex-col gap-1 font-mono text-[12px]">
        {d.timeline.map((e) => (
          <li key={e.id}>
            {clock(e.at)} · {e.type.replace("_", " ")}
          </li>
        ))}
      </ul>
      <p className="text-text-dim mt-4 text-xs">
        Internal notes, routing scores and owner identity are never serialised here.
      </p>
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

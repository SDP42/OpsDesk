"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { TowerRadio } from "@/components/assistant/tower-radio";
import { CreateFlight } from "@/components/pilot/create-flight";
import { DepartureBoard } from "@/components/pilot/departure-board";
import { Brand } from "@/components/tower/app-shell";
import { Conversation } from "@/components/tower/conversation";
import { Hud } from "@/components/ui/hud";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { api, unwrap, type PilotTicket, type PilotTicketDetail } from "@/lib/api/client";
import { clock, STATUS_LABEL } from "@/lib/format";
import { useLogout, useRequireRole } from "@/lib/hooks/use-me";

const PILOT = ["requester"] as const;

export default function PilotPage() {
  const me = useRequireRole(PILOT);
  const logout = useLogout();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);

  const board = useInfiniteQuery({
    queryKey: ["tickets", "pilot"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const r = await api.GET("/api/tickets", {
        params: { query: { limit: 30, cursor: pageParam } },
      });
      if (!r.data) throw new Error("Could not load your flights");
      return r.data as unknown as { data: PilotTicket[]; meta: { next_cursor: string | null } };
    },
    getNextPageParam: (p) => p.meta.next_cursor ?? undefined,
    enabled: me.data?.role === "requester",
    refetchInterval: 30_000,
  });
  const tickets = board.data?.pages.flatMap((p) => p.data) ?? [];

  if (!me.data || me.data.role !== "requester") {
    return (
      <div className="relative z-10 grid min-h-dvh place-items-center">
        <p className="micro">Establishing contact…</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-dvh">
      <header className="border-line flex items-center justify-between border-b px-4 py-3 sm:px-8">
        <Brand />
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm">{me.data.agency?.name}</p>
            <p className="micro">Pilot · {me.data.agency?.city}</p>
          </div>
          <button onClick={logout} aria-label="Sign out" className="text-text-dim hover:text-alarm">
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="micro text-amber">Departures · {me.data.agency?.code}</p>
              <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
                Your <em>flight</em> board
              </h1>
            </div>
            <button
              className="btn btn-signal"
              onClick={() => {
                setCreating(true);
                setSelected(null);
              }}
            >
              <Plus size={14} /> New flight
            </button>
          </div>
          <Hud className="mt-5" bodyClassName="p-3">
            {board.isLoading ? (
              <LoadingStrips rows={5} />
            ) : board.error ? (
              <ErrorState
                message={(board.error as Error).message}
                onRetry={() => board.refetch()}
              />
            ) : tickets.length === 0 ? (
              <EmptyState
                title="No departures"
                body="File your first flight and track it here in real time."
              />
            ) : (
              <>
                <DepartureBoard
                  tickets={tickets}
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setCreating(false);
                  }}
                />
                {board.hasNextPage && (
                  <button className="btn mx-auto mt-3 flex" onClick={() => board.fetchNextPage()}>
                    Earlier flights
                  </button>
                )}
              </>
            )}
          </Hud>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {creating || !selected ? (
            <Hud title="File a flight">
              <CreateFlight
                onCreated={(id) => {
                  setSelected(id);
                  setCreating(false);
                }}
                onContinue={(id) => {
                  setSelected(id);
                  setCreating(false);
                }}
              />
            </Hud>
          ) : (
            <PilotFlight id={selected} />
          )}
        </aside>
      </main>
      <TowerRadio persona="Pilot" />
    </div>
  );
}

function PilotFlight({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () =>
      unwrap(await api.GET("/api/tickets/{ticket_id}", { params: { path: { ticket_id: id } } })),
  });
  if (q.isLoading) return <div className="skeleton h-96" />;
  if (q.error)
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const d = q.data as PilotTicketDetail;
  const t = d.ticket;
  return (
    <Hud title={`Flight ${t.number}`}>
      <p className="font-serif text-2xl leading-tight">{t.title}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="micro">Status</dt>
          <dd className="mt-0.5">{STATUS_LABEL[t.status] ?? t.status}</dd>
        </div>
        <div>
          <dt className="micro">ETA to resolution</dt>
          <dd className="mt-0.5 font-mono">
            {t.status === "resolved" || t.status === "closed" ? "Landed" : clock(t.eta)}
          </dd>
        </div>
        <div>
          <dt className="micro">Controller</dt>
          <dd className="mt-0.5 font-mono">{t.controller_callsign ?? "Assigning"}</dd>
        </div>
        <div>
          <dt className="micro">Linked cases</dt>
          <dd className="mt-0.5 font-mono">{t.link_count}</dd>
        </div>
      </dl>
      <div className="mt-5">
        <Conversation ticketId={t.id} staff={false} />
      </div>
    </Hud>
  );
}

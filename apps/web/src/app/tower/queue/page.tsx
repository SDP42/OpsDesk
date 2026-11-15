"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { QueuePage } from "@/components/tower/queue-page";
import type { StripQuery } from "@/components/tower/strip-list";

function Queue() {
  const params = useSearchParams();
  const tboh = params.get("tboh") ?? undefined;
  const asked = params.get("ask");
  const filters: StripQuery = {};
  for (const k of ["region", "priority", "intent", "q"] as const) {
    const v = params.get(k);
    if (v) filters[k] = v;
  }
  const status = params.get("status");
  if (status) filters.status = [status];
  const days = params.get("checkin_within_days");
  if (days) filters.checkin_within_days = Number(days);
  const sla = params.get("sla_state");
  const view = (params.get("view") as StripQuery["view"]) ?? undefined;

  if (asked || Object.keys(filters).length || sla || view) {
    return (
      <QueuePage
        eyebrow="Ask the tower"
        title={
          <>
            {asked ? (
              <em>“{asked}”</em>
            ) : (
              <>
                Filtered <em>flights</em>
              </>
            )}
          </>
        }
        query={{
          view: view ?? "all",
          sort: "sla_asc",
          ...filters,
          ...(sla ? { sla_state: [sla] } : {}),
          ...(tboh ? { tboh } : {}),
        }}
        emptyTitle="No flights match"
        emptyBody="Try fewer words, or another region or SLA state."
      />
    );
  }
  return tboh ? (
    <QueuePage
      eyebrow={`Flight path ${tboh}`}
      title={
        <>
          Every flight on <em>{tboh}</em>
        </>
      }
      query={{ view: "all", tboh }}
      emptyTitle="No flights on this booking"
      emptyBody="Nothing has been filed against this TBOH yet."
    />
  ) : (
    <QueuePage
      eyebrow="My queue"
      title={
        <>
          Your <em>flights</em>, lowest fuel first
        </>
      }
      query={{ view: "mine", sort: "sla_asc" }}
      emptyTitle="Queue clear"
      emptyBody="No flights are assigned to you. Triage holds anything unassigned."
    />
  );
}

export default function QueueRoute() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}

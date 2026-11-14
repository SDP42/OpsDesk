"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { QueuePage } from "@/components/tower/queue-page";

function Queue() {
  const tboh = useSearchParams().get("tboh") ?? undefined;
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

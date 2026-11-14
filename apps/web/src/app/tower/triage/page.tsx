"use client";

import { QueuePage } from "@/components/tower/queue-page";

export default function TriagePage() {
  return (
    <QueuePage
      eyebrow="Triage"
      title={
        <>
          Unassigned flights awaiting <em>vectoring</em>
        </>
      }
      query={{ view: "triage", sort: "sla_asc" }}
      emptyTitle="Nothing in triage"
      emptyBody="Every open flight has a controller."
    />
  );
}

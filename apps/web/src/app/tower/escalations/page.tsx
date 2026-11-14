"use client";

import { QueuePage } from "@/components/tower/queue-page";

export default function EscalationsPage() {
  return (
    <QueuePage
      eyebrow="Tower Chief"
      title={<>Escalation queue, <em>check-in first</em></>}
      query={{ view: "escalations", sort: "sla_asc" }}
      emptyTitle="No escalations"
      emptyBody="Escalated flights land here within a second, with the controller's reason."
    />
  );
}

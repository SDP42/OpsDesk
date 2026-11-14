"use client";

import { Hud } from "@/components/ui/hud";
import { StripList, type StripQuery } from "./strip-list";

export function QueuePage({
  eyebrow,
  title,
  query,
  emptyTitle,
  emptyBody,
}: {
  eyebrow: string;
  title: React.ReactNode;
  query: StripQuery;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="micro text-signal">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl">{title}</h1>
      </div>
      <Hud bodyClassName="p-3">
        <StripList query={query} emptyTitle={emptyTitle} emptyBody={emptyBody} />
      </Hud>
    </div>
  );
}

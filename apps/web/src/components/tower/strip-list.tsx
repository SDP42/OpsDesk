"use client";

/** Live list of Flight Strips with J/K keyboard navigation and cursor paging. */
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, unwrap, type Ticket } from "@/lib/api/client";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { FlightStrip } from "./flight-strip";

export type StripQuery = {
  view?: "all" | "triage" | "mine" | "escalations" | "open";
  sort?: "created_desc" | "sla_asc";
  tboh?: string;
  region?: string;
  sla_state?: string[];
  limit?: number;
};

export function StripList({
  query,
  emptyTitle,
  emptyBody,
  keyboard = true,
}: {
  query: StripQuery;
  emptyTitle?: string;
  emptyBody?: string;
  keyboard?: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const q = useInfiniteQuery({
    queryKey: ["tickets", query],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.GET("/api/tickets", {
        params: { query: { ...query, limit: query.limit ?? 40, cursor: pageParam } },
      });
      if (res.error || !res.data) {
        unwrap(res as never);
      }
      return res.data as unknown as { data: Ticket[]; meta: { next_cursor: string | null } };
    },
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
    refetchInterval: 60_000,
  });
  const tickets = q.data?.pages.flatMap((p) => p.data) ?? [];

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || e.metaKey || e.ctrlKey)
        return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setActive((i) => {
          const next = e.key === "j" ? Math.min(i + 1, tickets.length - 1) : Math.max(i - 1, 0);
          refs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "Enter" && tickets[active]) {
        router.push(`/tower/t/${tickets[active].number}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, tickets, active, router]);

  if (q.isLoading) return <LoadingStrips />;
  if (q.error)
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (tickets.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;

  return (
    <div className="flex flex-col gap-2">
      {tickets.map((t, i) => (
        <FlightStrip
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          ticket={t}
          active={i === active}
          onFocus={() => setActive(i)}
        />
      ))}
      {q.hasNextPage && (
        <button
          className="btn mx-auto mt-2"
          onClick={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
        >
          {q.isFetchingNextPage ? "Receiving…" : "Load more flights"}
        </button>
      )}
      {keyboard && (
        <p className="micro mt-2 text-center">
          <kbd>J</kbd>/<kbd>K</kbd> to move · <kbd>Enter</kbd> to open
        </p>
      )}
    </div>
  );
}

"use client";

/** Centre pane: internal notes and external replies (separate tabs, routes and colours) + Frequencies. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Lock, Send } from "lucide-react";
import { useState } from "react";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { ago } from "@/lib/format";
import { FrequencyGlyph } from "@/components/ui/glyphs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { FrequencyChip } from "./frequency-chip";

export function Conversation({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"external" | "internal">("external");
  const [body, setBody] = useState("");
  const comments = useQuery({
    queryKey: ["ticket", ticketId, "comments"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/tickets/{ticket_id}/comments", {
          params: { path: { ticket_id: ticketId } },
        }),
      ),
  });
  const post = useMutation({
    mutationFn: async () => {
      const path = { params: { path: { ticket_id: ticketId } }, body: { body } };
      return unwrap(
        tab === "internal"
          ? await api.POST("/api/tickets/{ticket_id}/comments/internal", path)
          : await api.POST("/api/tickets/{ticket_id}/comments/external", path),
      );
    },
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });

  const internal = tab === "internal";
  return (
    <div className="flex flex-col gap-4">
      {staff && (
        <div className="border-line flex border-b" role="tablist">
          {(["external", "internal"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex items-center gap-2 border-b-2 px-4 py-2 font-mono text-[11px] tracking-wider uppercase",
                tab === t
                  ? t === "internal"
                    ? "border-amber text-amber"
                    : "border-signal text-signal"
                  : "text-text-dim border-transparent",
              )}
            >
              {t === "internal" && <Lock size={12} strokeWidth={1.5} />}
              {t === "external" ? "Reply to pilot" : "Internal note"}
            </button>
          ))}
        </div>
      )}

      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
        {comments.isLoading && <div className="skeleton h-24" />}
        {comments.error && (
          <ErrorState
            message={(comments.error as Error).message}
            onRetry={() => comments.refetch()}
          />
        )}
        {comments.data?.length === 0 && (
          <EmptyState title="Silent channel" body="No messages on this flight yet." />
        )}
        {comments.data?.map((c) => (
          <article
            key={c.id}
            className={clsx(
              "border-l-2 px-4 py-3",
              c.visibility === "internal"
                ? "border-amber bg-amber/5"
                : "border-signal/60 bg-ink-800/60",
            )}
          >
            <header className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm">
                {c.visibility === "internal" && (
                  <Lock size={12} className="text-amber" aria-label="Internal note" />
                )}
                {c.author?.name ?? "Tower"}
              </span>
              <span className="micro">{ago(c.created_at)}</span>
            </header>
            <p className="text-text/90 mt-1.5 text-[14px] whitespace-pre-wrap">{c.body}</p>
          </article>
        ))}
      </div>

      <form
        className={clsx(
          "flex flex-col gap-2 border p-3",
          internal ? "border-amber/50" : "border-line",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) post.mutate();
        }}
      >
        <textarea
          className="placeholder:text-text-dim min-h-20 resize-y bg-transparent text-sm outline-none"
          placeholder={
            internal ? "Internal note: never visible to the agency" : "Reply the pilot will see"
          }
          value={body}
          maxLength={5000}
          onChange={(e) => setBody(e.target.value)}
          aria-label={internal ? "Internal note" : "External reply"}
        />
        <div className="flex items-center justify-between">
          <span className={clsx("micro", internal && "!text-amber")}>
            {internal ? "Internal · lock" : "External · visible to pilot"}
          </span>
          <button
            className={clsx("btn", internal ? "border-amber/60 text-amber" : "btn-signal")}
            disabled={!body.trim() || post.isPending}
          >
            <Send size={13} strokeWidth={1.5} /> Send
          </button>
        </div>
        {post.error && (
          <p className="text-alarm font-mono text-xs">{(post.error as ApiError).message}</p>
        )}
      </form>
    </div>
  );
}

export function Frequencies({ ticketId }: { ticketId: string }) {
  const q = useQuery({
    queryKey: ["ticket", ticketId, "frequencies"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/tickets/{ticket_id}/frequencies", {
          params: { path: { ticket_id: ticketId } },
        }),
      ),
  });
  if (q.isLoading) return <div className="skeleton h-20" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} />;
  if (!q.data?.length)
    return (
      <p className="text-text-dim text-sm">
        No side conversations. Open a Frequency to loop in a supplier with explicit recipients.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      {q.data.map((f) => (
        <div key={f.id} className="border-line border p-3">
          <div className="flex items-center gap-2">
            <FrequencyGlyph className="text-amber" />
            <span className="text-sm">{f.subject}</span>
            <span className="micro ml-auto">{f.status}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.recipients
              .filter((r) => !r.removed_at)
              .map((r) => (
                <FrequencyChip
                  key={r.id}
                  name={r.name}
                  email={r.email}
                  partyType={r.party_type}
                  locked={r.locked}
                />
              ))}
          </div>
          <ol className="border-line mt-3 flex flex-col gap-2 border-l pl-3">
            {f.messages.map((m) => (
              <li key={m.id} className="text-[13px]">
                <span
                  className={clsx(
                    "font-mono text-[11px]",
                    m.sender_type === "supplier" ? "text-amber" : "text-signal",
                  )}
                >
                  {m.sender_name}
                </span>{" "}
                <span className="micro">{ago(m.at)}</span>
                <p className="text-text/85">{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

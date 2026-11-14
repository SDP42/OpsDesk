"use client";

/** Supplier Partner portal: an external organisation works its Frequencies with TBO ops. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Clock, LogOut, Send } from "lucide-react";
import { useState } from "react";
import { TowerRadio } from "@/components/assistant/tower-radio";
import { Brand } from "@/components/tower/app-shell";
import { Hud } from "@/components/ui/hud";
import { Num, Sign } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingStrips } from "@/components/ui/states";
import { Term } from "@/components/ui/term";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ago, clock, tMinus } from "@/lib/format";
import { useLogout, useRequireRole } from "@/lib/hooks/use-me";

const SUPPLIER = ["supplier"] as const;
const QUICK = [
  "Confirmed. Reservation is live; hotel confirmation number to follow within the hour.",
  "Rebooked the guest at an equivalent property nearby, transfer arranged at our cost.",
  "Please share the guest's passport name and arrival time so we can confirm.",
  "Refund approved on our side; funds release in 3 working days.",
];

export default function PartnerPage() {
  const me = useRequireRole(SUPPLIER);
  const logout = useLogout();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const enabled = me.data?.role === "supplier";
  const channels = useQuery({
    queryKey: ["partner", "channels"],
    queryFn: async () => unwrap(await api.GET("/api/partner/channels")),
    enabled,
    refetchInterval: 20_000,
  });
  const stats = useQuery({
    queryKey: ["partner", "stats"],
    queryFn: async () => unwrap(await api.GET("/api/partner/stats")),
    enabled,
  });
  const active = selected ?? channels.data?.[0]?.id ?? null;
  const thread = useQuery({
    queryKey: ["partner", "channel", active],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/partner/channels/{channel_id}", {
          params: { path: { channel_id: active! } },
        }),
      ),
    enabled: !!active,
  });
  const reply = useMutation({
    mutationFn: async (text: string) =>
      unwrap(
        await api.POST("/api/partner/channels/{channel_id}/messages", {
          params: { path: { channel_id: active! } },
          body: { body: text },
        }),
      ),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["partner"] });
    },
  });

  if (!me.data || me.data.role !== "supplier") {
    return (
      <div className="relative z-10 grid min-h-dvh place-items-center">
        <p className="micro">Establishing contact…</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-dvh">
      <header className="border-line bg-ink-900/80 flex items-center justify-between border-b px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center gap-4">
          <Brand />
          <Sign tone="dark">Partner portal</Sign>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm">{stats.data?.supplier ?? me.data.name}</p>
            <p className="micro">{me.data.name}</p>
          </div>
          <button onClick={logout} aria-label="Sign out" className="text-text-dim hover:text-alarm">
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <p className="micro !text-beacon">Supplier partner</p>
        <h1 className="display mt-2 text-5xl sm:text-6xl">
          Your <em>channels</em> with TBO operations
        </h1>
        <p className="text-text-dim mt-3 max-w-2xl">
          Each card is a <Term k="frequency">Frequency</Term>: a side conversation the TBO
          controller opened with you about one booking. Reply here and it lands on their screen
          instantly, even if the case is transferred to another team.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            [
              "Open channels",
              stats.data?.open_channels ?? 0,
              "Conversations TBO has open with you",
            ],
            [
              "Awaiting your reply",
              stats.data?.awaiting_reply ?? 0,
              "TBO wrote last and is waiting on you",
            ],
            [
              "Median response",
              stats.data?.median_response_minutes ?? 0,
              "Minutes from TBO's message to your reply",
            ],
          ].map(([label, v, hint]) => (
            <div key={label as string} className="hud p-5">
              <span className="hud-tr" aria-hidden />
              <span className="hud-bl" aria-hidden />
              <p className="micro">{label}</p>
              <p className="display mt-2 text-5xl">
                <Num value={Number(v)} />
                {label === "Median response" && (
                  <span className="text-text-dim ml-1 text-xl">min</span>
                )}
              </p>
              <p className="text-text-dim mt-1 text-[12px]">{hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <Hud title="Inbox" bodyClassName="p-2">
            {channels.isLoading ? (
              <LoadingStrips rows={3} />
            ) : channels.error ? (
              <ErrorState
                message={(channels.error as Error).message}
                onRetry={() => channels.refetch()}
              />
            ) : !channels.data?.length ? (
              <EmptyState
                title="No open channels"
                body="When TBO needs you on a booking, the conversation appears here."
              />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {channels.data.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelected(c.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        active === c.id
                          ? "border-night bg-taxi/25"
                          : "hover:bg-ink-700/50 border-transparent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] font-semibold">
                          {c.tboh ?? c.ticket_number}
                        </span>
                        {c.awaiting_reply ? (
                          <Sign tone="beacon" className="!py-0 !text-[9px]">
                            Your turn
                          </Sign>
                        ) : (
                          <Sign tone="outline" className="!py-0 !text-[9px]">
                            Replied
                          </Sign>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm">{c.subject}</p>
                      <p className="micro mt-1">
                        {c.last_at ? ago(c.last_at) : "new"} · {c.hotel ?? "hotel"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Hud>

          <Hud
            title={
              thread.data
                ? `${thread.data.ticket_number} · ${thread.data.tboh ?? ""}`
                : "Conversation"
            }
          >
            {!thread.data ? (
              <div className="skeleton h-64" />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="display text-2xl">{thread.data.subject}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Sign tone="dark">{thread.data.hotel ?? "Hotel"}</Sign>
                  <Sign tone="outline">
                    <Clock size={11} /> Check-in {clock(thread.data.check_in)} (
                    {tMinus(thread.data.check_in)})
                  </Sign>
                </div>
                <ol className="flex max-h-[380px] flex-col gap-3 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {thread.data.messages.map((m) => (
                      <motion.li
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex",
                          m.sender_type === "supplier" ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2.5",
                            m.sender_type === "supplier"
                              ? "bg-night text-white"
                              : "border-line bg-ink-800 border",
                          )}
                        >
                          <p
                            className={cn(
                              "font-mono text-[10px] tracking-wider uppercase",
                              m.sender_type === "supplier" ? "text-taxi" : "text-text-dim",
                            )}
                          >
                            {m.sender_name} · {ago(m.at)}
                          </p>
                          <p className="mt-1 text-[14px]">{m.body}</p>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      onClick={() => setBody(q)}
                      className="border-line bg-ink-800 hover:border-night rounded-full border px-3 py-1 text-[12px]"
                    >
                      {q.split(".")[0]}
                    </button>
                  ))}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (body.trim()) reply.mutate(body);
                  }}
                >
                  <input
                    className="field !rounded-full"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Reply to TBO operations"
                    aria-label="Reply"
                  />
                  <button className="btn btn-signal" disabled={!body.trim() || reply.isPending}>
                    <Send size={13} /> Send
                  </button>
                </form>
              </div>
            )}
          </Hud>
        </div>
      </main>
      <TowerRadio persona="Supplier Partner" />
    </div>
  );
}

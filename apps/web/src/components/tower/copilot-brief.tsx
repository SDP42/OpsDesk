"use client";

/** Co-pilot Brief: one click summarises the case from linked history, with a Why on every line. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Sparkles } from "lucide-react";
import { api, unwrap } from "@/lib/api/client";
import { Tip } from "@/components/ui/primitives";

export function CopilotBrief({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const brief = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.GET("/api/tickets/{ticket_id}/brief", {
          params: { path: { ticket_id: ticketId } },
        }),
      ),
  });
  const send = useMutation({
    mutationFn: async (body: string) =>
      unwrap(
        await api.POST("/api/tickets/{ticket_id}/comments/external", {
          params: { path: { ticket_id: ticketId } },
          body: { body },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });
  const b = brief.data;
  return (
    <div>
      {!b && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-text-dim text-sm">
            Summarise this case from its linked history, supplier thread and clock. Free,
            rule-based, no paid AI.
          </p>
          <button
            className="btn !border-violet !text-violet"
            onClick={() => brief.mutate()}
            disabled={brief.isPending}
          >
            {brief.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}{" "}
            Generate brief
          </button>
        </div>
      )}
      <AnimatePresence>
        {b && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <p className="text-violet font-mono text-[12px]">{b.headline}</p>
            <ul className="flex flex-col gap-2">
              {b.lines.map((l, i) => (
                <motion.li
                  key={l.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="grid grid-cols-[110px_1fr_auto] gap-3 text-sm"
                >
                  <span className="micro pt-0.5">{l.label}</span>
                  <span>{l.text}</span>
                  <Tip label={`Why: ${l.why}`}>
                    <button className="text-text-dim font-mono text-[10px] underline decoration-dotted">
                      why
                    </button>
                  </Tip>
                </motion.li>
              ))}
            </ul>
            <div className="bg-violet/10 rounded-xl p-3">
              <p className="micro !text-violet">Next best action</p>
              <p className="mt-1 text-[15px]">{b.next_action}</p>
            </div>
            <div className="border-line rounded-xl border p-3">
              <p className="micro">Reply draft</p>
              <p className="mt-1 text-sm">{b.reply_draft}</p>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn btn-signal !py-1.5"
                  disabled={send.isPending || send.isSuccess}
                  onClick={() => send.mutate(b.reply_draft)}
                >
                  {send.isSuccess ? "Sent to agency" : "Send to agency"}
                </button>
                <button className="btn !py-1.5" onClick={() => brief.mutate()}>
                  Refresh
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

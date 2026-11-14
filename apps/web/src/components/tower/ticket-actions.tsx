"use client";

/** Status controls, escalate (reason required) and reassign with the HandoffDiff check. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { api, ApiError, unwrap, type HandoffDiff, type Ticket } from "@/lib/api/client";
import { useTowerCalls } from "@/lib/stores/tower-calls";
import { FrequencyChip } from "./frequency-chip";

const NEXT: Record<string, string[]> = {
  new: ["open", "pending", "resolved"],
  open: ["pending", "resolved"],
  pending: ["open", "resolved"],
  escalated: ["open", "pending", "resolved"],
  resolved: ["closed", "open"],
  closed: [],
};

export function TicketActions({ ticket, role }: { ticket: Ticket; role: string }) {
  const qc = useQueryClient();
  const push = useTowerCalls((s) => s.push);
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [diff, setDiff] = useState<HandoffDiff | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ticket", ticket.number] });
    void qc.invalidateQueries({ queryKey: ["tickets"] });
  };
  const onError = (e: unknown) => setErr(e instanceof ApiError ? e.message : "Action failed");

  const status = useMutation({
    mutationFn: async (s: string) =>
      unwrap(
        await api.PATCH("/api/tickets/{ticket_id}", {
          params: { path: { ticket_id: ticket.id } },
          body: { status: s as "open" },
        }),
      ),
    onSuccess: (t) => {
      push({ callsign: t.number, message: `STATUS > ${t.status.toUpperCase()}`, tone: "signal" });
      refresh();
    },
    onError,
  });

  const escalate = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/api/tickets/{ticket_id}/escalate", {
          params: { path: { ticket_id: ticket.id } },
          body: { reason },
        }),
      ),
    onSuccess: (t) => {
      setEscalating(false);
      setReason("");
      push({
        callsign: t.number,
        message: `ESCALATED > TOWER CHIEF ${t.owner?.name ?? ""}`,
        tone: "alarm",
      });
      refresh();
    },
    onError,
  });

  const controllers = useQuery({
    queryKey: ["controllers"],
    queryFn: async () => unwrap(await api.GET("/api/controllers")),
    enabled: role !== "requester",
  });

  const reassign = useMutation({
    mutationFn: async (confirmed: boolean) =>
      unwrap(
        await api.POST("/api/tickets/{ticket_id}/reassign", {
          params: { path: { ticket_id: ticket.id } },
          body: { to_user_id: reassignTo, handoff_confirmed: confirmed },
        }),
      ),
    onSuccess: (t) => {
      setDiff(null);
      setReassignTo("");
      push({
        callsign: t.number,
        message: `HANDED OFF > ${t.owner?.callsign ?? t.owner?.name ?? ""}`,
        tone: "ice",
      });
      refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "handoff_confirmation_required")
        setDiff(e.details as HandoffDiff);
      else onError(e);
    },
  });

  useEffect(() => setErr(null), [ticket.status, ticket.owner?.id]);

  // Keyboard: E opens escalate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || e.metaKey || e.ctrlKey) return;
      if (e.key === "e" && ticket.status !== "escalated") setEscalating(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ticket.status]);

  const canEscalate = !["resolved", "closed", "escalated"].includes(ticket.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(NEXT[ticket.status] ?? []).map((s) => (
          <button
            key={s}
            className="btn"
            disabled={status.isPending}
            onClick={() => status.mutate(s)}
          >
            {s === "resolved"
              ? "Land (resolve)"
              : s === "closed"
                ? "Close at gate"
                : s === "pending"
                  ? "Hold"
                  : "Reopen"}
          </button>
        ))}
        {canEscalate && (
          <button
            className="btn btn-alarm"
            onClick={() => setEscalating((v) => !v)}
            aria-expanded={escalating}
          >
            Escalate <kbd className="opacity-60">E</kbd>
          </button>
        )}
      </div>

      <AnimatePresence>
        {escalating && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              escalate.mutate();
            }}
          >
            <label className="micro" htmlFor="esc-reason">
              Reason for the Tower Chief (required)
            </label>
            <textarea
              id="esc-reason"
              autoFocus
              className="field min-h-20"
              value={reason}
              minLength={5}
              required
              onChange={(e) => setReason(e.target.value)}
              placeholder="Check-in in 9 hours and the hotel has no record…"
            />
            <button
              className="btn btn-alarm self-start"
              disabled={reason.trim().length < 5 || escalate.isPending}
            >
              Send to Tower Chief
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {role !== "requester" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reassignTo) reassign.mutate(false);
          }}
        >
          <select
            className="field flex-1 !py-2 text-sm"
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            aria-label="Transfer to controller"
          >
            <option value="">Transfer to…</option>
            {controllers.data
              ?.filter((c) => c.id !== ticket.owner?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.callsign ?? ""} {c.name} · {c.region ?? c.role} · {c.open_tickets} open
                  {c.on_shift ? "" : " · off shift"}
                </option>
              ))}
          </select>
          <button className="btn" disabled={!reassignTo || reassign.isPending}>
            Transfer
          </button>
        </form>
      )}

      {err && (
        <p role="alert" className="text-alarm font-mono text-xs">
          {err}
        </p>
      )}

      <AnimatePresence>
        {diff && (
          <HandoffDiffModal
            diff={diff}
            busy={reassign.isPending}
            onCancel={() => setDiff(null)}
            onConfirm={() => reassign.mutate(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Modal listing recipients that stay, are added or are dropped; requires a confirmation click. */
export function HandoffDiffModal({
  diff,
  busy,
  onCancel,
  onConfirm,
}: {
  diff: HandoffDiff;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      className="bg-ink-950/75 fixed inset-0 z-[80] grid place-items-center p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-title"
        className="hud w-full max-w-lg p-6"
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <span className="hud-tr" aria-hidden />
        <span className="hud-bl" aria-hidden />
        <p className="micro text-amber">Handoff check</p>
        <h3 id="handoff-title" className="mt-1 font-serif text-3xl">
          Frequencies survive the transfer
        </h3>
        <p className="text-text-dim mt-2 text-sm">
          {diff.from_owner?.name ?? "Triage"} →{" "}
          <span className="text-text">{diff.to_owner.name}</span>. External parties and locked
          recipients stay on every open Frequency.
        </p>
        {(
          [
            ["Stays", diff.stayed, "stay"],
            ["Added", diff.added, "added"],
            ["Dropped", diff.dropped, "dropped"],
          ] as const
        ).map(([label, list, state]) => (
          <div key={label} className="mt-4">
            <p className="micro">
              {label} · {list.length}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {list.length === 0 && <span className="text-text-dim text-xs">none</span>}
              {list.map((r) => (
                <FrequencyChip
                  key={`${r.frequency_id}-${r.email}`}
                  name={r.name}
                  email={r.email}
                  partyType={r.party_type}
                  locked={r.locked}
                  handoff={state}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-signal"
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-handoff"
          >
            Confirm handoff
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

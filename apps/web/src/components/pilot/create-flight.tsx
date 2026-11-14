"use client";

/**
 * Journey A create flow: as the pilot types, the intent suggestion updates with a
 * confidence bar; the TBOH validates against bookings and fills check-in and LCD;
 * a panel shows earlier cases on the booking with "Continue existing case".
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { clock, tMinus } from "@/lib/format";

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Created = Awaited<ReturnType<typeof createCall>>;
async function createCall(body: { title: string; description: string; tboh?: string; priority: "P1" | "P2" | "P3" | "P4"; intent_code?: string }) {
  return unwrap(await api.POST("/api/tickets", { body }));
}

export function CreateFlight({ onCreated, onContinue }: { onCreated: (id: string) => void; onContinue: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tboh, setTboh] = useState("");
  const [priority, setPriority] = useState<"P1" | "P2" | "P3" | "P4">("P3");
  const [intentCode, setIntentCode] = useState<string | null>(null);
  const [result, setResult] = useState<Created | null>(null);

  const text = useDebounced(`${title}. ${description}`.trim());
  const tbohValid = /^TBOH-\d{3,10}$/.test(tboh.trim().toUpperCase());
  const tbohKey = useDebounced(tbohValid ? tboh.trim().toUpperCase() : "");

  const suggestion = useQuery({
    queryKey: ["suggest", text],
    queryFn: async () => unwrap(await api.POST("/api/intents/suggest", { body: { text } })),
    enabled: text.length > 8,
    placeholderData: (prev) => prev,
  });
  const booking = useQuery({
    queryKey: ["booking", tbohKey],
    queryFn: async () => unwrap(await api.GET("/api/bookings/{tboh}", { params: { path: { tboh: tbohKey } } })),
    enabled: !!tbohKey,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      createCall({
        title,
        description,
        priority,
        ...(tbohValid ? { tboh: tboh.trim().toUpperCase() } : {}),
        ...(intentCode ? { intent_code: intentCode } : {}),
      }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  const top = suggestion.data?.top ?? [];
  const chosen = intentCode ?? top[0]?.code;

  if (result) {
    const t = result.ticket as { id: string; number: string; controller_callsign?: string | null; intent?: { label: string } | null };
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4" data-testid="flight-filed">
        <div className="flex items-center gap-3 text-signal">
          <CheckCircle2 size={20} strokeWidth={1.5} />
          <span className="font-mono text-sm tracking-wider uppercase">Flight filed · {t.number}</span>
        </div>
        <p className="text-sm text-text-dim">
          Classified as <span className="text-text">{t.intent?.label ?? "pending"}</span>
          {t.controller_callsign ? (
            <>
              , vectored to controller <span className="font-mono text-text">{t.controller_callsign}</span>.
            </>
          ) : (
            ", waiting in triage."
          )}
        </p>
        {result.links.length > 0 && (
          <p className="text-sm text-ice">Linked to {result.links.length} earlier case(s): no need to explain again.</p>
        )}
        {result.guardian.triggered && (
          <p className="border border-amber/50 px-3 py-2 font-mono text-[12px] text-amber">
            {result.guardian.reason}. We raised the priority and alerted the Tower Chief.
          </p>
        )}
        <div className="flex gap-2">
          <button className="btn btn-signal" onClick={() => onCreated(t.id)}>
            Track this flight
          </button>
          <button
            className="btn"
            onClick={() => {
              setResult(null);
              setTitle("");
              setDescription("");
              setTboh("");
              setIntentCode(null);
            }}
          >
            File another
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="micro">What happened?</span>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Refund for TBOH-88213 still not received"
          minLength={4}
          maxLength={200}
          required
          name="title"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="micro">Details</span>
        <textarea
          className="field min-h-24"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          placeholder="Anything the controller should know"
          name="description"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <label className="flex flex-col gap-1.5">
          <span className="micro">Booking (TBOH)</span>
          <input
            className={clsx("field font-mono uppercase", tboh && !tbohValid && "!border-amber")}
            value={tboh}
            onChange={(e) => setTboh(e.target.value)}
            placeholder="TBOH-88213"
            name="tboh"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="micro">Urgency</span>
          <select className="field" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} name="priority">
            <option value="P1">P1 · guest stranded</option>
            <option value="P2">P2 · urgent</option>
            <option value="P3">P3 · normal</option>
            <option value="P4">P4 · low</option>
          </select>
        </label>
      </div>

      <AnimatePresence>
        {booking.data && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border border-ice/40 bg-ice/5 p-3"
            data-testid="booking-panel"
          >
            <p className="text-sm">
              {booking.data.hotel_name}, {booking.data.destination} · guest {booking.data.guest_name}
            </p>
            <p className="micro mt-1">
              Check-in {clock(booking.data.check_in)} ({tMinus(booking.data.check_in)}) · LCD {clock(booking.data.lcd)}
            </p>
            {booking.data.earlier_cases.length > 0 && (
              <div className="mt-3 border-t border-ice/30 pt-3">
                <p className="text-sm text-ice">
                  You have {booking.data.earlier_cases.length} earlier case{booking.data.earlier_cases.length > 1 ? "s" : ""} on this booking.
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {booking.data.earlier_cases.slice(0, 3).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 font-mono text-[12px]">
                      <span className="truncate">
                        {c.number} · {c.title}
                      </span>
                      <button type="button" className="btn shrink-0 !px-2 !py-1" onClick={() => onContinue(c.id ?? "")}>
                        Continue existing case
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
        {booking.error && tbohKey && (
          <p className="font-mono text-xs text-amber">{tbohKey} is not one of your bookings.</p>
        )}
      </AnimatePresence>

      <div className="border border-line p-3" data-testid="intent-suggest">
        <div className="flex items-center gap-2">
          <Sparkles size={14} strokeWidth={1.5} className="text-violet" />
          <span className="micro">Intent auto-suggest</span>
          {suggestion.isFetching && <Loader2 size={12} className="animate-spin text-text-dim" />}
        </div>
        {top.length === 0 ? (
          <p className="mt-2 text-sm text-text-dim">Start typing and the tower will classify your case.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5" role="radiogroup" aria-label="Suggested intent">
            {top.map((c) => (
              <button
                type="button"
                role="radio"
                aria-checked={chosen === c.code}
                key={c.code}
                onClick={() => setIntentCode(c.code === intentCode ? null : c.code)}
                className={clsx("grid grid-cols-[1fr_120px_44px] items-center gap-3 px-2 py-1 text-left", chosen === c.code && "bg-ink-800")}
              >
                <span className="truncate text-sm">{c.label}</span>
                <span className="h-1.5 bg-ink-700">
                  <span className="block h-full bg-violet" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
                </span>
                <span className="text-right font-mono text-[11px] tabular">{Math.round(c.confidence * 100)}%</span>
              </button>
            ))}
            {suggestion.data?.needs_human && <p className="micro !text-amber">Low confidence: a controller will confirm the intent.</p>}
          </div>
        )}
      </div>

      {create.error && <p role="alert" className="font-mono text-xs text-alarm">{(create.error as ApiError).message}</p>}
      <button className="btn btn-signal self-start" disabled={create.isPending || title.trim().length < 4}>
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : null} File flight
      </button>
    </form>
  );
}

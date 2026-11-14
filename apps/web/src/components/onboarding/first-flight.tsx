"use client";

/**
 * First-flight onboarding for someone using OpsDesk for the very first time:
 * 1) welcome + choose the demo airspace (seeded data) or a live tower (real data only),
 * 2) a pre-flight checklist for their role, 3) a guided driver.js tour of the screen.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { motion } from "motion/react";
import { Check, Database, Radio, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, unwrap, type Me } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Modal, Sign } from "@/components/ui/primitives";

const CHECKLIST: Record<string, string[]> = {
  requester: [
    "File a flight with your TBOH: we pull check-in and LCD from the booking",
    "We link earlier cases on the same booking so you never explain twice",
    "Track status and ETA on your departures board in real time",
  ],
  agent: [
    "Your queue is sorted by wheels-up fuel: lowest first",
    "Every flight shows linked history, intent and why it was routed to you",
    "Escalate to the Tower Chief in one click (E), with a reason",
  ],
  escalation_manager: [
    "Escalations land in your queue within a second",
    "Check-in and LCD countdowns tell you what to work first",
    "Accept, reassign or resolve with a note",
  ],
  lead: [
    "Watch queue health, SLA risk and every region on the radar",
    "Switch routing presets and see the reason behind each assignment",
    "Insights and uncapped exports live in the Black Box",
  ],
};

const TOUR: Record<string, DriveStep[]> = {
  staff: [
    {
      element: "[data-tour=nav]",
      popover: {
        title: "Your airspace",
        description:
          "Overview, your queue, triage and escalations. Every list is built from Flight Strips.",
      },
    },
    {
      element: "[data-tour=mode]",
      popover: {
        title: "Demo or live",
        description: "Flip between the seeded demo airspace and your real flights at any time.",
      },
    },
    {
      element: "[data-tour=tiles]",
      popover: {
        title: "Queue health",
        description: "Open flights, triage, Tower Chief load and breaches, updated live over SSE.",
      },
    },
    {
      element: "[data-tour=radar]",
      popover: {
        title: "The radar",
        description:
          "Each blip is an open flight. Distance from centre is how much SLA fuel has burned.",
      },
    },
    {
      element: "[data-tour=risk]",
      popover: {
        title: "SLA risk board",
        description: "Lowest fuel first. Press J/K to move and Enter to open a flight.",
      },
    },
    {
      element: "[data-tour=command]",
      popover: {
        title: "Command palette",
        description: "Press ⌘K to jump to any callsign or TBOH.",
      },
    },
  ],
  requester: [
    {
      element: "[data-tour=board]",
      popover: {
        title: "Departures board",
        description: "All your flights, with status and ETA to resolution.",
      },
    },
    {
      element: "[data-tour=create]",
      popover: {
        title: "File a flight",
        description:
          "Type what happened. The tower suggests the intent and finds earlier cases on your booking.",
      },
    },
  ],
};

export function startTour(role: string, onDone?: () => void) {
  const steps = (role === "requester" ? TOUR.requester : TOUR.staff)!.filter(
    (s) => !s.element || document.querySelector(s.element as string),
  );
  const d = driver({
    showProgress: true,
    animate: true,
    overlayColor: "#0d1117",
    overlayOpacity: 0.45,
    stagePadding: 6,
    stageRadius: 14,
    popoverClass: "opsdesk-tour",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Cleared for takeoff",
    steps,
    onDestroyed: () => onDone?.(),
  });
  d.drive();
}

export function FirstFlight({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(!me.onboarded);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"demo" | "live">((me.data_mode as "demo" | "live") ?? "demo");

  const save = useMutation({
    mutationFn: async (body: { data_mode?: "demo" | "live"; onboarded?: boolean }) =>
      unwrap(await api.PATCH("/api/me/preferences", { body })),
    onSuccess: (next) => {
      qc.setQueryData(["me"], next);
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
  });

  useEffect(() => setOpen(!me.onboarded), [me.onboarded]);

  const finish = useCallback(
    (tour: boolean) => {
      setOpen(false);
      save.mutate({ data_mode: mode, onboarded: true });
      if (tour) setTimeout(() => startTour(me.role), 450);
    },
    [mode, me.role, save],
  );

  const first = me.name.split(" ")[0];
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && finish(false)}
      title={
        step === 0 ? (
          <>
            Welcome aboard, <em className="text-beacon">{first}</em>.
          </>
        ) : (
          "Pre-flight checklist"
        )
      }
      description={
        step === 0
          ? "First time in the tower? Choose the airspace you want to start in. You can switch any time from the top bar."
          : "Three things to know before your first flight."
      }
      hideClose
    >
      {step === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                id: "demo",
                icon: <Sparkles size={18} />,
                title: "Demo airspace",
                body: "3,000 realistic flights across 12 agencies and 4 regions. Best for a first look.",
                sign: "Recommended",
              },
              {
                id: "live",
                icon: <Database size={18} />,
                title: "Live tower",
                body: "Only real flights your team files. Starts quiet and fills as agencies write in.",
                sign: "Current data",
              },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setMode(o.id)}
              aria-pressed={mode === o.id}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                mode === o.id
                  ? "border-night bg-taxi/25 shadow-[var(--shadow-card)]"
                  : "border-line hover:border-text/40",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="bg-night text-taxi grid size-9 place-items-center rounded-full">
                  {o.icon}
                </span>
                <Sign tone={mode === o.id ? "dark" : "outline"}>{o.sign}</Sign>
              </div>
              <span className="display mt-2 text-2xl">{o.title}</span>
              <span className="text-text-dim text-sm">{o.body}</span>
              {mode === o.id && (
                <motion.span layoutId="pick" className="absolute top-3 right-3 hidden">
                  <Check size={14} />
                </motion.span>
              )}
            </button>
          ))}
          <div className="mt-3 flex justify-end sm:col-span-2">
            <button className="btn btn-signal" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div>
          <ol className="flex flex-col gap-3">
            {(CHECKLIST[me.role] ?? CHECKLIST.agent!).map((item, i) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                className="border-line bg-ink-900 flex items-start gap-3 rounded-xl border p-3"
              >
                <span className="bg-signal grid size-7 shrink-0 place-items-center rounded-full text-white">
                  <Check size={14} />
                </span>
                <span className="text-[15px]">{item}</span>
              </motion.li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span className="micro flex items-center gap-2">
              <Radio size={12} /> Starting in {mode === "demo" ? "demo airspace" : "live tower"}
            </span>
            <div className="flex gap-2">
              <button className="btn" onClick={() => finish(false)}>
                Skip tour
              </button>
              <button className="btn btn-beacon" onClick={() => finish(true)}>
                Take the 30-second tour
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

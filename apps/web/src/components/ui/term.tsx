"use client";

/**
 * Plain-language hints: keep the technical Control Tower term, add a one-line
 * everyday explanation on hover/focus so non-technical users understand it.
 */
import { HelpCircle } from "lucide-react";
import { Tip } from "./primitives";

export const GLOSSARY: Record<string, string> = {
  flight: "A flight is one support case (ticket), numbered like OD-24817.",
  tboh: "TBOH is the booking reference. Every case about the same booking shares it.",
  "wheels-up":
    "Time left to answer before it hurts the guest. It shrinks as their check-in date gets closer.",
  fuel: "How much time is left on this case's deadline. Full = plenty, empty = overdue.",
  vectoring: "How the system picks the best person for a case, with the reason shown.",
  "tower chief": "The escalation manager who takes over urgent or stuck cases.",
  frequency: "A side conversation with a supplier or partner, with its own fixed list of people.",
  triage: "Cases nobody owns yet. Pick one or let the system assign it.",
  "linked flights": "Earlier cases about the same booking or problem, so nobody explains twice.",
  turbulence:
    "How unhappy this agency is likely to be, from repeat contacts and delays (0 calm, 100 severe).",
  intent: "What the case is about, e.g. Refund > Delay. Suggested automatically, editable.",
  "third contact":
    "The agency has raised the same issue 3 times in 14 days, so priority was raised.",
  escalate: "Hand the case to the Tower Chief with a short reason. It moves within a second.",
  lcd: "Last cancellation date: after this, cancelling the booking costs money.",
  sla: "The promised response time for this case.",
  "agency mirror": "Preview exactly what the agency sees, so internal notes never leak.",
  "demo airspace":
    "Practice data with 3,000 realistic cases. Switch to Live to see only real cases.",
};

export function Term({
  k,
  children,
  hint = true,
}: {
  k: keyof typeof GLOSSARY | string;
  children?: React.ReactNode;
  hint?: boolean;
}) {
  const text = GLOSSARY[k.toLowerCase()];
  if (!text) return <>{children ?? k}</>;
  return (
    <Tip label={text}>
      <span
        tabIndex={0}
        className="decoration-text-dim/40 inline-flex cursor-help items-center gap-1 underline decoration-dotted underline-offset-4 outline-none"
      >
        {children ?? k}
        {hint && <HelpCircle size={11} className="shrink-0 opacity-50" aria-hidden />}
      </span>
    </Tip>
  );
}

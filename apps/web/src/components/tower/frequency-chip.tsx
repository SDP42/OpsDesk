import { clsx } from "clsx";
import { Lock } from "lucide-react";

const PARTY = {
  supplier: "border-amber/50 text-amber",
  agency: "border-ice/50 text-ice",
  internal: "border-signal/50 text-signal",
} as const;

export type HandoffState = "stay" | "added" | "dropped" | undefined;

/** Recipient pill: lock icon, party-type colour and an optional handoff state. */
export function FrequencyChip({
  name,
  email,
  partyType,
  locked,
  handoff,
}: {
  name: string;
  email?: string;
  partyType: string;
  locked?: boolean;
  handoff?: HandoffState;
}) {
  return (
    <span
      title={email}
      className={clsx(
        "inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px]",
        PARTY[partyType as keyof typeof PARTY] ?? "border-line text-text-dim",
        handoff === "dropped" && "line-through opacity-60",
        handoff === "added" && "ring-signal ring-1",
      )}
    >
      {locked && <Lock size={11} strokeWidth={1.5} aria-label="locked" />}
      <span className="micro !text-[9px] !text-current opacity-70">{partyType.slice(0, 3)}</span>
      {name}
      {handoff && <span className="micro !text-[9px] !text-current">· {handoff}</span>}
    </span>
  );
}

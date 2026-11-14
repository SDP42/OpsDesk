import { AlertTriangle, RotateCcw } from "lucide-react";
import { RadarGlyph } from "./glyphs";

/** Skeleton flight strips that shimmer like a radar sweep. */
export function LoadingStrips({
  rows = 6,
  label = "Acquiring targets",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="micro sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton border-line/60 h-[68px] border"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title = "Clear skies",
  body = "No flights match this view.",
  action,
}: {
  title?: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="border-line relative grid size-20 place-items-center rounded-full border">
        <div className="border-line/60 absolute inset-2 rounded-full border" />
        <div
          className="animate-sweep absolute inset-0 origin-center rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0 300deg, color-mix(in oklab, var(--color-signal) 30%, transparent) 360deg)",
          }}
        />
        <RadarGlyph className="text-signal relative" size={22} />
      </div>
      <p className="font-serif text-2xl">{title}</p>
      <p className="text-text-dim max-w-sm text-sm">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Lost contact",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle className="text-alarm" strokeWidth={1.5} size={28} />
      <p className="font-serif text-2xl">{title}</p>
      <p className="text-text-dim max-w-md font-mono text-xs">
        {message ?? "The tower could not reach the API."}
      </p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          <RotateCcw size={14} strokeWidth={1.5} /> Re-establish contact
        </button>
      )}
    </div>
  );
}

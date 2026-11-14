import { AlertTriangle, RotateCcw } from "lucide-react";
import { RadarGlyph } from "./glyphs";

/** Skeleton flight strips that shimmer like a radar sweep. */
export function LoadingStrips({ rows = 6, label = "Acquiring targets" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="micro sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-[68px] border border-line/60" style={{ opacity: 1 - i * 0.12 }} />
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
      <div className="relative grid size-20 place-items-center rounded-full border border-line">
        <div className="absolute inset-2 rounded-full border border-line/60" />
        <div
          className="absolute inset-0 origin-center animate-sweep rounded-full"
          style={{ background: "conic-gradient(from 0deg, transparent 0 300deg, color-mix(in oklab, var(--color-signal) 30%, transparent) 360deg)" }}
        />
        <RadarGlyph className="relative text-signal" size={22} />
      </div>
      <p className="font-serif text-2xl">{title}</p>
      <p className="max-w-sm text-sm text-text-dim">{body}</p>
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
      <p className="max-w-md font-mono text-xs text-text-dim">{message ?? "The tower could not reach the API."}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          <RotateCcw size={14} strokeWidth={1.5} /> Re-establish contact
        </button>
      )}
    </div>
  );
}

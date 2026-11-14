"use client";

/**
 * Airplane-window frame: the one consistent container for every visual on the
 * landing page (footage, gauges, cards). Rounded cabin-window shape, inner bezel,
 * soft depth, optional caption sign.
 */
import { cn } from "@/lib/cn";

export function WindowFrame({
  children,
  caption,
  className,
  tone = "dark",
}: {
  children: React.ReactNode;
  caption?: React.ReactNode;
  className?: string;
  tone?: "dark" | "paper";
}) {
  return (
    <figure data-reveal="frame" className={cn("relative mx-auto w-full", className)}>
      <div className="rounded-[44%/34%] bg-gradient-to-b from-[#ece7dc] to-[#d9d2c3] p-3 shadow-[var(--shadow-lift)] sm:p-4">
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden rounded-[42%/32%] ring-1 ring-black/10",
            tone === "dark" ? "bg-night" : "bg-ink-900",
          )}
        >
          {children}
          {/* Cabin glass glare */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.18)_0%,transparent_35%,transparent_70%,rgba(255,255,255,0.06)_100%)]" />
          <div className="pointer-events-none absolute inset-0 rounded-[42%/32%] shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]" />
        </div>
      </div>
      {caption && <figcaption className="mt-4 flex justify-center">{caption}</figcaption>}
    </figure>
  );
}

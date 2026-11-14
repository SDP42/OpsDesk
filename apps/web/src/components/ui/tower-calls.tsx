"use client";

import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { useTowerCalls } from "@/lib/stores/tower-calls";

const tone = {
  signal: "border-signal/50 text-signal",
  amber: "border-amber/50 text-amber",
  alarm: "border-alarm/60 text-alarm",
  ice: "border-ice/50 text-ice",
};

export function TowerCalls() {
  const { calls, dismiss } = useTowerCalls();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {calls.map((c) => (
          <motion.button
            key={c.id}
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={() => dismiss(c.id)}
            className={clsx(
              "hud pointer-events-auto px-4 py-3 text-left font-mono text-[12px] tracking-wider uppercase",
              tone[c.tone],
            )}
          >
            <span className="font-semibold">{c.callsign}</span>{" "}
            <span className="text-text">{c.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

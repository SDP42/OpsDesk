"use client";

import { motion } from "motion/react";
import { Sign } from "@/components/ui/primitives";

/** Consistent page header: wayfinding gate sign, editorial title, and a plain-language "what this is". */
export function PageHeader({
  gate,
  eyebrow,
  title,
  plain,
  action,
}: {
  gate: string;
  eyebrow: string;
  title: React.ReactNode;
  plain: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Sign tone="dark">{gate}</Sign>
          <Sign>{eyebrow}</Sign>
        </div>
        <h1 className="display mt-4 text-5xl sm:text-6xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-dim">
          <span className="font-mono text-[11px] tracking-wider text-text uppercase">In plain words · </span>
          {plain}
        </p>
      </div>
      {action}
    </motion.div>
  );
}

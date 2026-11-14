"use client";

/** "ESTABLISHING CONTACT": radar sweep and a mono percentage while the first frames and poster load; iris open on ready. */
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import { getStore } from "@/lib/landing/frames";
import { detectCaps, useLanding } from "@/lib/landing/motion";

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);
  const set = useLanding((s) => s.set);

  useEffect(() => {
    let cancelled = false;
    const caps = detectCaps();
    const start = performance.now();
    const poster = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = "/video/hero-poster.webp";
    });

    const run = async () => {
      setPct(10);
      await poster;
      setPct(35);
      const store = await getStore("a");
      if (store) {
        const off = store.onProgress((r) => setPct((p) => Math.max(p, Math.round(35 + Math.min(1, r / (24 / store.seq.count)) * 60))));
        await store.load(caps.rich ? 24 : 1);
        off();
      }
      const elapsed = performance.now() - start;
      await new Promise((r) => setTimeout(r, Math.max(0, (caps.reduced ? 0 : 900) - elapsed)));
      if (cancelled) return;
      setPct(100);
      set({ ready: true });
      if (caps.reduced || !root.current) {
        setGone(true);
        return;
      }
      gsap.fromTo(
        root.current,
        { clipPath: "circle(150% at 50% 50%)" },
        {
          clipPath: "circle(0% at 50% 50%)",
          duration: 1.2,
          ease: "power3.inOut",
          delay: 0.2,
          onComplete: () => setGone(true),
        },
      );
    };
    // Safety: never block the page for more than 6 s.
    const timeout = setTimeout(() => {
      set({ ready: true });
      setGone(true);
    }, 6000);
    void run().finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [set]);

  if (gone) return null;
  return (
    <div ref={root} className="fixed inset-0 z-[90] grid place-items-center bg-ink-950" role="status" aria-live="polite">
      <div className="relative grid size-56 place-items-center">
        {[0, 18, 36].map((i) => (
          <div key={i} className="absolute rounded-full border border-line" style={{ inset: `${i}%` }} />
        ))}
        <div
          className="absolute inset-0 animate-sweep rounded-full"
          style={{ background: "conic-gradient(from 0deg, transparent 0 300deg, color-mix(in oklab, var(--color-signal) 45%, transparent) 360deg)", animationDuration: "1.6s" }}
        />
        <span className="relative font-mono text-3xl text-signal tabular">{String(pct).padStart(3, "0")}%</span>
      </div>
      <p className="micro absolute bottom-[22%] !text-signal">Establishing contact</p>
    </div>
  );
}

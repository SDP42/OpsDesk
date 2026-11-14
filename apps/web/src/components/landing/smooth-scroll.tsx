"use client";

/** Lenis inertia scrolling feeding GSAP ScrollTrigger (disabled for reduced motion / mobile). */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";
import { detectCaps, useLanding } from "@/lib/landing/motion";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const set = useLanding((s) => s.set);

  useEffect(() => {
    const caps = detectCaps();
    let lenis: Lenis | null = null;
    const tick = (time: number) => lenis?.raf(time * 1000);

    if (caps.rich) {
      lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      (window as Window & { __lenis?: Lenis }).__lenis = lenis;
    }

    const page = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => set({ progress: self.progress }),
    });

    return () => {
      page.kill();
      gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, [set]);

  return <>{children}</>;
}

"use client";

/**
 * A scroll scene on one consistent 12-column grid: copy on the left, a visual on
 * the right. Long scenes pin (sticky stage) while progress runs; every element
 * marked `data-reveal` fades and rises in smoothly as the scene arrives.
 * Reduced motion / mobile collapse to normal readable sections.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { detectCaps, useLanding } from "@/lib/landing/motion";

gsap.registerPlugin(ScrollTrigger);

const ProgressCtx = createContext<{ progress: number; rich: boolean }>({ progress: 0, rich: false });
export const useSceneProgress = () => useContext(ProgressCtx);

export function Scene({
  index,
  length = 160,
  id,
  label,
  className,
  stageClassName,
  children,
}: {
  index: number;
  /** Scroll length in vh while pinned (100 = no pin). */
  length?: number;
  id?: string;
  label: string;
  className?: string;
  stageClassName?: string;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [rich, setRich] = useState(false);
  const set = useLanding((s) => s.set);

  useEffect(() => {
    const caps = detectCaps();
    setRich(caps.rich);
    const el = outer.current;
    if (!el) return;
    const active = ScrollTrigger.create({
      trigger: el,
      start: "top 35%",
      end: "bottom 35%",
      onToggle: (self) => self.isActive && set({ scene: index }),
    });
    const prog = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        setProgress(self.progress);
        if (useLanding.getState().scene === index) set({ sceneProgress: self.progress });
      },
    });
    let ctx: gsap.Context | null = null;
    if (!caps.reduced) {
      ctx = gsap.context(() => {
        const copy = el.querySelectorAll("[data-reveal]:not([data-reveal=frame])");
        const frames = el.querySelectorAll("[data-reveal=frame]");
        gsap.from(copy, {
          y: 36,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 75%", toggleActions: "play none none reverse" },
        });
        gsap.from(frames, {
          y: 60,
          scale: 0.94,
          opacity: 0,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" },
        });
      }, el);
    }
    return () => {
      active.kill();
      prog.kill();
      ctx?.revert();
    };
  }, [index, set, rich]);

  const pinned = rich && length > 100;
  return (
    <ProgressCtx.Provider value={{ progress, rich }}>
      <section
        ref={outer}
        id={id}
        aria-label={label}
        data-scene={index}
        className={cn("relative", className)}
        style={{ height: pinned ? `${length}vh` : undefined }}
      >
        <div className={cn(pinned ? "sticky top-0 h-dvh overflow-hidden" : "relative min-h-dvh py-24", stageClassName)}>{children}</div>
      </section>
    </ProgressCtx.Provider>
  );
}

/** The shared two-column grid every scene uses. */
export function SceneGrid({ copy, visual, flip = false }: { copy: React.ReactNode; visual?: React.ReactNode; flip?: boolean }) {
  return (
    <div className="mx-auto grid h-full w-full max-w-[1320px] items-center gap-10 px-5 pt-20 pb-10 sm:px-10 lg:grid-cols-12 lg:gap-16">
      <div className={cn("lg:col-span-6", flip && "lg:order-2")}>{copy}</div>
      <div className={cn("relative lg:col-span-6", flip && "lg:order-1")}>{visual}</div>
    </div>
  );
}

/** Scene header: index, problem number and an eyebrow, styled as wayfinding signs. */
export function SceneTag({ n, problem, children }: { n: number; problem?: string; children: React.ReactNode }) {
  return (
    <p data-reveal className="flex flex-wrap items-center gap-2">
      <span className="sign sign-dark">{String(n).padStart(2, "0")}</span>
      <span className="sign">{children}</span>
      {problem && <span className="sign !bg-transparent !text-text-dim ring-1 ring-line">Problem {problem}</span>}
    </p>
  );
}

/** Scene headline + body, used identically by every scene. */
export function SceneCopy({
  n,
  problem,
  eyebrow,
  title,
  children,
}: {
  n: number;
  problem?: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 max-w-xl">
      <SceneTag n={n} problem={problem}>
        {eyebrow}
      </SceneTag>
      <h2 data-reveal className="display mt-6 text-[clamp(2.8rem,5.6vw,5.4rem)]">
        {title}
      </h2>
      {children && (
        <div data-reveal className="mt-6 text-lg leading-relaxed text-text-dim">
          {children}
        </div>
      )}
    </div>
  );
}

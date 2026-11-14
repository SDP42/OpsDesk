"use client";

/**
 * A pinned scroll scene. The outer section is `length` viewport-heights tall and the
 * inner stage is sticky, so content stays pinned while progress (0..1) runs. Progress
 * and the active scene go to the landing store for the persistent WebGL canvas.
 * On reduced motion / mobile the scene collapses to a normal, readable section.
 */
import { clsx } from "clsx";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { detectCaps, useLanding } from "@/lib/landing/motion";

gsap.registerPlugin(ScrollTrigger);

const ProgressCtx = createContext<{ progress: number; rich: boolean }>({ progress: 0, rich: false });
export const useSceneProgress = () => useContext(ProgressCtx);

export function Scene({
  index,
  length = 200,
  id,
  label,
  className,
  stageClassName,
  wipe = false,
  children,
}: {
  index: number;
  /** Scroll length in vh while pinned. */
  length?: number;
  id?: string;
  label: string;
  className?: string;
  stageClassName?: string;
  /** Reveal this scene with a radar-sweep wipe as it enters. */
  wipe?: boolean;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [rich, setRich] = useState(false);
  const set = useLanding((s) => s.set);

  useEffect(() => {
    const caps = detectCaps();
    setRich(caps.rich);
    if (!outer.current) return;
    const st = ScrollTrigger.create({
      trigger: outer.current,
      start: "top 55%",
      end: "bottom 45%",
      onToggle: (self) => {
        if (self.isActive) set({ scene: index });
      },
    });
    const prog = ScrollTrigger.create({
      trigger: outer.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        setProgress(self.progress);
        if (useLanding.getState().scene === index) set({ sceneProgress: self.progress });
      },
    });
    let wipeTween: gsap.core.Tween | null = null;
    if (wipe && caps.rich && stage.current) {
      wipeTween = gsap.fromTo(
        stage.current,
        { "--sweep": "0deg" },
        {
          "--sweep": "360deg",
          ease: "none",
          scrollTrigger: { trigger: outer.current, start: "top bottom", end: "top top", scrub: true },
        },
      );
    }
    return () => {
      st.kill();
      prog.kill();
      wipeTween?.scrollTrigger?.kill();
      wipeTween?.kill();
    };
  }, [index, set, wipe]);

  return (
    <ProgressCtx.Provider value={{ progress, rich }}>
      <section
        ref={outer}
        id={id}
        aria-label={label}
        data-scene={index}
        className={clsx("relative", className)}
        style={{ height: rich ? `${length}vh` : undefined }}
      >
        <div
          ref={stage}
          className={clsx(rich ? "sticky top-0 h-dvh overflow-hidden" : "relative min-h-dvh py-24", wipe && rich && "radar-wipe", stageClassName)}
        >
          {children}
        </div>
      </section>
    </ProgressCtx.Provider>
  );
}

/** Small scene header: index, problem number and an eyebrow. */
export function SceneTag({ n, problem, children }: { n: number; problem?: string; children: React.ReactNode }) {
  return (
    <p className="micro flex items-center gap-3 !text-signal">
      <span className="font-mono text-text-dim">{String(n).padStart(2, "0")}</span>
      <span className="h-px w-8 bg-signal/50" />
      {children}
      {problem && <span className="border border-line px-1.5 py-0.5 text-text-dim">Problem {problem}</span>}
    </p>
  );
}

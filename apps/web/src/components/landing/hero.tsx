"use client";

/** Scene 1: night control-tower video, duotone graded, headline, live mono ticker and CTAs. */
import { gsap } from "gsap";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { detectCaps, useLanding } from "@/lib/landing/motion";
import { Magnetic } from "./crosshair-cursor";
import { Scene, SceneTag } from "./scene";

const TICKER = [
  "OD-24817 VECTORED > AE-01 · Region match UAE (+40)",
  "OD-24818 LINKED > TBOH-88213 · 3rd contact",
  "OD-24819 WHEELS-UP T-9h > CRITICAL",
  "OD-24820 ESCALATED > TOWER CHIEF",
  "OD-24821 FREQUENCY 2 SUPPLIERS · LOCKED",
  "OD-24822 INTENT Refund > Delay 96%",
  "OD-24823 HANDOFF CHECK · 3 stayed 1 added",
  "BLACK BOX 60,000 rows · no cap",
];

function Words({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className={`hero-word inline-block ${className ?? ""}`}>{w}&nbsp;</span>
        </span>
      ))}
    </>
  );
}

export function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ready = useLanding((s) => s.ready);
  const [useVideo, setUseVideo] = useState(false);

  useEffect(() => {
    const caps = detectCaps();
    setUseVideo(!caps.reduced && !caps.saveData);
  }, []);

  useEffect(() => {
    if (!ready || !root.current) return;
    if (detectCaps().reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-word", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.06, delay: 0.35 });
      gsap.from(".hero-fade", { opacity: 0, y: 14, duration: 0.9, ease: "power3.out", stagger: 0.1, delay: 0.9 });
    }, root);
    return () => ctx.revert();
  }, [ready]);

  return (
    <Scene index={1} length={100} label="Every ticket is a flight" stageClassName="!overflow-visible">
      <div ref={root} className="relative h-dvh min-h-[640px] overflow-hidden">
        {/* Poster paints instantly (LCP); the video fades over it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/video/hero-poster.webp" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "grayscale(0.6) brightness(0.55) contrast(1.15)" }} />
        {useVideo && (
          <video
            ref={video}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
            style={{ filter: "grayscale(0.6) brightness(0.55) contrast(1.15)" }}
            autoPlay
            muted
            loop
            playsInline
            poster="/video/hero-poster.webp"
            onCanPlay={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <source src="/video/hero.webm" type="video/webm" />
            <source src="/video/hero.mp4" type="video/mp4" />
          </video>
        )}
        {/* Duotone grade: signal-green highlights over ink shadows. */}
        <div className="absolute inset-0 mix-blend-color" style={{ background: "linear-gradient(180deg, #0b3b33 0%, #05080d 100%)" }} />
        <div className="absolute inset-0 mix-blend-soft-light" style={{ background: "radial-gradient(ellipse at 70% 60%, rgba(107,255,201,0.35), transparent 60%)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-transparent to-ink-950" />
        <div className="scanline absolute inset-0 opacity-40" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-28 sm:px-10 sm:pb-32">
          <div className="hero-fade">
            <SceneTag n={1}>OpsDesk Control Tower · for TBO</SceneTag>
          </div>
          <h1 className="mt-5 max-w-4xl font-serif text-[clamp(3.2rem,9vw,8.5rem)] leading-[0.92] tracking-tight">
            <Words text="Every ticket is a" /> <Words text="flight." className="text-signal italic" />
          </h1>
          <p className="hero-fade mt-6 max-w-xl text-lg text-text/85 sm:text-xl">
            Stop treating them like paperwork. OpsDesk is the control tower for TBO&apos;s agency operations.
          </p>
          <div className="hero-fade mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link href="/login" className="btn btn-signal !px-6 !py-3.5 !text-[13px]">
                Enter the Tower <ArrowRight size={15} />
              </Link>
            </Magnetic>
            <Magnetic>
              <button className="btn !px-6 !py-3.5 !text-[13px]" disabled title="Demo Autopilot arrives in Phase 5">
                <Play size={14} /> Watch the 90-second flight
              </button>
            </Magnetic>
          </div>
        </div>

        {/* Live mono ticker */}
        <div className="absolute inset-x-0 bottom-0 z-10 overflow-hidden border-t border-line/70 bg-ink-950/70 py-2.5 backdrop-blur">
          <div className="flex w-max animate-[ticker_40s_linear_infinite] gap-10 font-mono text-[12px] tracking-wider text-text-dim motion-reduce:animate-none">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="whitespace-nowrap">
                <span className="text-signal">●</span> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Scene>
  );
}

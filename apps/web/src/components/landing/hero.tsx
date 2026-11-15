"use client";

/** Scene 1: editorial headline on paper; the night-tower footage plays through an airplane window. */
import { gsap } from "gsap";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { detectCaps, useLanding } from "@/lib/landing/motion";
import { Magnetic } from "./crosshair-cursor";
import { Scene, SceneGrid, SceneTag } from "./scene";

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

const STATS = [
  ["3,000+", "flights in the demo airspace"],
  ["< 1 s", "escalation to the Tower Chief"],
  ["60,000", "rows per export, no cap"],
];

export function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const ready = useLanding((s) => s.ready);
  const [useVideo, setUseVideo] = useState(false);

  useEffect(() => {
    const caps = detectCaps();
    setUseVideo(!caps.reduced && !caps.saveData);
  }, []);

  useEffect(() => {
    if (!ready || !root.current || detectCaps().reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-word", {
        yPercent: 115,
        duration: 1.1,
        ease: "power4.out",
        stagger: 0.07,
        delay: 0.25,
      });
      gsap.from(".hero-fade", {
        opacity: 0,
        y: 18,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        delay: 0.7,
      });
      gsap.from(".hero-window", {
        opacity: 0,
        y: 50,
        rotate: 2,
        scale: 0.94,
        duration: 1.4,
        ease: "power3.out",
        delay: 0.35,
      });
      gsap.to(".hero-window", {
        yPercent: -8,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, root);
    return () => ctx.revert();
  }, [ready]);

  const words = (text: string, cls = "") =>
    text.split(" ").map((w, i) => (
      <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
        <span className={`hero-word inline-block ${cls}`}>{w}&nbsp;</span>
      </span>
    ));

  return (
    <Scene index={1} length={100} label="Every ticket is a flight">
      <div ref={root} className="relative flex min-h-dvh flex-col">
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/video/hero-poster.webp"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {useVideo && (
            <video
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
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
          <div className="bg-ink-950/10 absolute inset-0" />
          <div className="from-ink-950 absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />
        </div>
        <SceneGrid
          copy={
            <div className="bg-ink-950/82 rounded-[32px] border border-white/60 p-8 shadow-[var(--shadow-lift)] backdrop-blur-xl sm:p-10">
              <div className="hero-fade">
                <SceneTag n={1}>OpsDesk for TBO</SceneTag>
              </div>
              <h1 className="display mt-7 text-[clamp(3rem,5.4vw,5.8rem)]">
                {words("Every ticket")}
                <br />
                {words("is a")}
                {words("flight.", "italic text-beacon")}
              </h1>
              <p className="hero-fade text-text-dim mt-7 max-w-lg text-xl leading-relaxed">
                Stop treating them like paperwork. OpsDesk is the control tower for TBO&apos;s
                agency operations: linked history, explainable routing and SLAs that count down to
                the guest&apos;s check-in.
              </p>
              <div className="hero-fade mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link href="/login" className="btn btn-signal !px-7 !py-4 !text-[13px]">
                    Enter the Tower <ArrowRight size={15} />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/login?autopilot=1" className="btn !px-7 !py-4 !text-[13px]">
                    <Play size={14} /> Take the 90-second flight
                  </Link>
                </Magnetic>
              </div>
              <dl className="hero-fade border-line mt-8 grid max-w-lg grid-cols-3 gap-4 border-t pt-5">
                {STATS.map(([v, l]) => (
                  <div key={l}>
                    <dt className="display text-3xl">{v}</dt>
                    <dd className="text-text-dim mt-1 text-[12px] leading-snug">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
          }
          visual={
            <div className="hero-window relative hidden h-[60vh] lg:block">
              <div className="animate-float absolute top-[8%] right-[6%] w-72 rounded-2xl border border-white/30 bg-white/90 p-4 shadow-[var(--shadow-lift)] backdrop-blur">
                <p className="flex items-center justify-between font-mono text-[12px]">
                  <span className="font-semibold">OD-24817</span>
                  <span className="sign !py-0 !text-[10px]">Vectored</span>
                </p>
                <p className="text-text-dim mt-2 font-mono text-[11px] leading-relaxed">
                  Region match UAE (+40) · P1 urgency (+30) · on shift (+15) · lowest load (+8)
                </p>
                <div className="bg-ink-700 mt-3 h-1.5 overflow-hidden rounded-full">
                  <div className="bg-night h-full w-[88%] rounded-full" />
                </div>
              </div>
              <div className="animate-float absolute top-[44%] left-[4%] rounded-2xl border border-white/30 bg-white/90 p-4 shadow-[var(--shadow-lift)] backdrop-blur [animation-delay:-2s]">
                <p className="micro">Wheels-up · TBOH-90009</p>
                <p className="text-critical tabular mt-1 font-mono text-3xl">T-9h 04m</p>
                <p className="micro !text-critical mt-1">Critical · escalation proposed</p>
              </div>
              <div className="animate-float bg-night absolute right-[10%] bottom-[6%] rounded-2xl p-4 text-white shadow-[var(--shadow-lift)] [animation-delay:-4s]">
                <p className="micro !text-white/60">Third-contact guardian</p>
                <p className="text-taxi mt-1 font-mono text-sm">3 flights linked on TBOH-88213</p>
              </div>
            </div>
          }
        />
        <div className="border-night bg-taxi relative z-[3] mt-auto overflow-hidden border-y py-3">
          <div className="text-night flex w-max animate-[ticker_45s_linear_infinite] gap-10 font-mono text-[12px] font-semibold tracking-wider uppercase motion-reduce:animate-none">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="whitespace-nowrap">
                ✈ {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Scene>
  );
}

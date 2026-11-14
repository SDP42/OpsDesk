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
      gsap.from(".hero-word", { yPercent: 115, duration: 1.1, ease: "power4.out", stagger: 0.07, delay: 0.25 });
      gsap.from(".hero-fade", { opacity: 0, y: 18, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.7 });
      gsap.from(".hero-window", { opacity: 0, y: 50, rotate: 2, scale: 0.94, duration: 1.4, ease: "power3.out", delay: 0.35 });
      gsap.to(".hero-window", { yPercent: -8, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
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
          <img src="/video/hero-poster.webp" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
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
          <div className="absolute inset-0 bg-ink-950/10" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>
        <SceneGrid
          copy={
            <div className="rounded-[32px] border border-white/60 bg-ink-950/82 p-8 shadow-[var(--shadow-lift)] backdrop-blur-xl sm:p-10">
              <div className="hero-fade">
                <SceneTag n={1}>OpsDesk for TBO</SceneTag>
              </div>
              <h1 className="display mt-7 text-[clamp(3rem,5.4vw,5.8rem)]">
                {words("Every ticket")}
                <br />
                {words("is a")}
                {words("flight.", "italic text-beacon")}
              </h1>
              <p className="hero-fade mt-7 max-w-lg text-xl leading-relaxed text-text-dim">
                Stop treating them like paperwork. OpsDesk is the control tower for TBO&apos;s agency operations: linked history,
                explainable routing and SLAs that count down to the guest&apos;s check-in.
              </p>
              <div className="hero-fade mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link href="/login" className="btn btn-signal !px-7 !py-4 !text-[13px]">
                    Enter the Tower <ArrowRight size={15} />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <a href="#scene-2" className="btn !px-7 !py-4 !text-[13px]">
                    <Play size={14} /> Take the 90-second flight
                  </a>
                </Magnetic>
              </div>
              <dl className="hero-fade mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-5">
                {STATS.map(([v, l]) => (
                  <div key={l}>
                    <dt className="display text-3xl">{v}</dt>
                    <dd className="mt-1 text-[12px] leading-snug text-text-dim">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
          }
          visual={
            <div className="hero-window relative hidden h-[60vh] lg:block">
              <div className="absolute top-[8%] right-[6%] w-72 animate-float rounded-2xl border border-white/30 bg-white/90 p-4 shadow-[var(--shadow-lift)] backdrop-blur">
                <p className="flex items-center justify-between font-mono text-[12px]">
                  <span className="font-semibold">OD-24817</span>
                  <span className="sign !py-0 !text-[10px]">Vectored</span>
                </p>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-text-dim">Region match UAE (+40) · P1 urgency (+30) · on shift (+15) · lowest load (+8)</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full w-[88%] rounded-full bg-night" />
                </div>
              </div>
              <div className="absolute top-[44%] left-[4%] animate-float rounded-2xl border border-white/30 bg-white/90 p-4 shadow-[var(--shadow-lift)] backdrop-blur [animation-delay:-2s]">
                <p className="micro">Wheels-up · TBOH-90009</p>
                <p className="mt-1 font-mono text-3xl text-critical tabular">T-9h 04m</p>
                <p className="micro mt-1 !text-critical">Critical · escalation proposed</p>
              </div>
              <div className="absolute right-[10%] bottom-[6%] animate-float rounded-2xl bg-night p-4 text-white shadow-[var(--shadow-lift)] [animation-delay:-4s]">
                <p className="micro !text-white/60">Third-contact guardian</p>
                <p className="mt-1 font-mono text-sm text-taxi">3 flights linked on TBOH-88213</p>
              </div>
            </div>
          }
        />
        <div className="relative z-[3] mt-auto overflow-hidden border-y border-night bg-taxi py-3">
          <div className="flex w-max animate-[ticker_45s_linear_infinite] gap-10 font-mono text-[12px] font-semibold tracking-wider text-night uppercase motion-reduce:animate-none">
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

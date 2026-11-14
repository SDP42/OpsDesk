"use client";

/**
 * Apple-style frame scrubber: a 2D canvas, a progressive loader, a ScrollTrigger
 * `scrub` that sets the target frame, and rAF drawing the nearest loaded frame.
 * `reverse` plays the sequence backwards (the footer takeoff).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { getStore, type FrameStore } from "@/lib/landing/frames";
import { detectCaps } from "@/lib/landing/motion";

gsap.registerPlugin(ScrollTrigger);

export function FrameScrubber({
  sequence,
  trigger,
  reverse = false,
  className,
  tint = "duotone",
}: {
  sequence: string;
  /** Element whose scroll range drives the scrub (defaults to the canvas' parent). */
  trigger?: React.RefObject<HTMLElement | null>;
  reverse?: boolean;
  className?: string;
  tint?: "duotone" | "dawn" | "none";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [blur, setBlur] = useState<string | null>(null);

  useEffect(() => {
    let store: FrameStore | null = null;
    let raf = 0;
    let target = 0;
    let current = -1;
    let st: ScrollTrigger | null = null;
    let cancelled = false;
    const caps = detectCaps();

    const draw = () => {
      const c = canvas.current;
      if (c && store) {
        const idx = Math.round(target);
        if (idx !== current) {
          const img = store.nearest(idx);
          const ctx = c.getContext("2d");
          if (img && ctx) {
            const dpr = Math.min(window.devicePixelRatio, 1.75);
            const w = c.clientWidth * dpr;
            const h = c.clientHeight * dpr;
            if (c.width !== w || c.height !== h) {
              c.width = w;
              c.height = h;
            }
            const s = Math.max(w / img.width, h / img.height);
            ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
            current = idx;
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    void getStore(sequence).then(async (s) => {
      if (!s || cancelled) return;
      store = s;
      setBlur(s.seq.blur);
      const last = s.seq.count - 1;
      target = reverse ? last : 0;
      await s.load(caps.rich ? 24 : 1);
      if (cancelled) return;
      if (caps.rich) {
        st = ScrollTrigger.create({
          trigger: trigger?.current ?? canvas.current?.parentElement ?? undefined,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => {
            target = (reverse ? 1 - self.progress : self.progress) * last;
          },
        });
      } else {
        target = Math.round(last * 0.4);
      }
      raf = requestAnimationFrame(draw);
    });

    const onResize = () => (current = -1);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      st?.kill();
      window.removeEventListener("resize", onResize);
    };
  }, [sequence, reverse, trigger]);

  const filter =
    tint === "duotone"
      ? "grayscale(0.55) contrast(1.1) brightness(0.7) sepia(0.25) hue-rotate(110deg) saturate(1.3)"
      : tint === "dawn"
        ? "contrast(1.05) brightness(0.8) saturate(1.1)"
        : undefined;

  return (
    <div className={className} aria-hidden>
      {blur && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={blur} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" style={{ filter }} />
      )}
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" style={{ filter }} />
    </div>
  );
}

"use client";

/** Custom crosshair cursor with a lagging range ring that expands over interactive elements. */
import { useEffect, useRef } from "react";

export function CrosshairCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("crosshair-active");
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let rx = x;
    let ry = y;
    let scale = 1;
    let target = 1;
    let raf = 0;

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const el = (e.target as HTMLElement | null)?.closest("a, button, [role=button], input, select, textarea, [data-magnetic]");
      target = el ? 2.2 : 1;
    };
    const loop = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      scale += (target - scale) * 0.18;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.classList.remove("crosshair-active");
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] hidden [@media(pointer:fine)]:block">
      <div ref={ring} className="absolute -top-5 -left-5 size-10 rounded-full border border-signal/50 transition-[border-color]" />
      <div ref={dot} className="absolute -top-3 -left-3 size-6">
        <span className="absolute top-1/2 left-0 h-px w-full bg-signal" />
        <span className="absolute top-0 left-1/2 h-full w-px bg-signal" />
        <span className="absolute top-1/2 left-1/2 size-1 -translate-1/2 rounded-full bg-ink-950 ring-1 ring-signal" />
      </div>
    </div>
  );
}

/** Magnetic button wrapper: the child drifts toward the pointer while hovered. */
export function Magnetic({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      data-magnetic
      className="inline-block transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !ref.current) return;
        ref.current.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
      }}
      onPointerLeave={() => {
        if (ref.current) ref.current.style.transform = "translate(0,0)";
      }}
    >
      {children}
    </span>
  );
}

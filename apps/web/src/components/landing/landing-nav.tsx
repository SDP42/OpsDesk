"use client";

import Link from "next/link";
import { Brand } from "@/components/tower/app-shell";
import { useLanding } from "@/lib/landing/motion";

const SCENES = ["Flight", "Blind", "Constellation", "Vectoring", "Wheels-up", "Frequencies", "Weather", "Black box", "Live", "Takeoff"];

export function LandingNav() {
  const { scene, progress } = useLanding();
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-10">
      <Brand />
      <nav className="micro hidden items-center gap-2 md:flex" aria-label="Scenes">
        <span className="tabular">{String(scene).padStart(2, "0")}</span>
        <span className="relative h-px w-28 bg-line">
          <span className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${progress * 100}%` }} />
        </span>
        <span>{SCENES[scene - 1]}</span>
      </nav>
      <Link href="/login" className="btn">
        Enter the Tower
      </Link>
    </header>
  );
}

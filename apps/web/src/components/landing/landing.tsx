"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { detectCaps } from "@/lib/landing/motion";
import { CrosshairCursor } from "./crosshair-cursor";
import { Hero } from "./hero";
import { LandingNav } from "./landing-nav";
import { Preloader } from "./preloader";
import { ConstellationScene, FlyingBlind, VectoringScene, WheelsUpScene } from "./scenes-a";
import {
  BlackBoxScene,
  ClearedScene,
  FrequenciesScene,
  TryItLiveScene,
  WeatherScene,
} from "./scenes-b";
import { SmoothScroll } from "./smooth-scroll";

const SceneCanvas = dynamic(() => import("./scene-canvas"), { ssr: false });

export function Landing() {
  const [webgl, setWebgl] = useState(false);
  useEffect(() => setWebgl(detectCaps().rich), []);
  return (
    <SmoothScroll>
      <Preloader />
      <CrosshairCursor />
      {webgl && <SceneCanvas />}
      <LandingNav />
      <main className="relative">
        <Hero />
        <FlyingBlind />
        <ConstellationScene />
        <VectoringScene />
        <WheelsUpScene />
        <FrequenciesScene />
        <WeatherScene />
        <BlackBoxScene />
        <TryItLiveScene />
        <ClearedScene />
      </main>
    </SmoothScroll>
  );
}

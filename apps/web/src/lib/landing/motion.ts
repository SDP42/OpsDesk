"use client";

/** Shared landing-page motion state: capability detection and scroll progress. */
import { create } from "zustand";

export interface MotionCaps {
  /** Full experience: smooth scroll, pinned scenes, WebGL. */
  rich: boolean;
  reduced: boolean;
  mobile: boolean;
  saveData: boolean;
}

export function detectCaps(): MotionCaps {
  if (typeof window === "undefined") return { rich: false, reduced: false, mobile: false, saveData: false };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const saveData = !!conn?.saveData;
  return { rich: !reduced && !mobile && !saveData, reduced, mobile, saveData };
}

interface LandingState {
  /** 0..1 progress through the whole page. */
  progress: number;
  /** Index of the scene currently in view (1..10). */
  scene: number;
  /** 0..1 progress inside the active scene. */
  sceneProgress: number;
  ready: boolean;
  set: (patch: Partial<Omit<LandingState, "set">>) => void;
}

export const useLanding = create<LandingState>((set) => ({
  progress: 0,
  scene: 1,
  sceneProgress: 0,
  ready: false,
  set: (patch) => set(patch),
}));

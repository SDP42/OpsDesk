/** Demo Autopilot state: which narrated step is playing. */
import { create } from "zustand";

interface AutopilotState {
  active: boolean;
  step: number;
  playing: boolean;
  voice: boolean;
  start: () => void;
  stop: () => void;
  go: (step: number) => void;
  toggle: () => void;
  toggleVoice: () => void;
}

export const useAutopilot = create<AutopilotState>((set) => ({
  active: false,
  step: 0,
  playing: true,
  voice: true,
  start: () => set({ active: true, step: 0, playing: true }),
  stop: () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    set({ active: false, step: 0 });
  },
  go: (step) => set({ step }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  toggleVoice: () => set((s) => ({ voice: !s.voice })),
}));

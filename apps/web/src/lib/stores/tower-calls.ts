/** "Tower calls": mono toasts with the callsign first, e.g. OD-24817 ESCALATED > TOWER CHIEF. */
import { create } from "zustand";

export type CallTone = "signal" | "amber" | "alarm" | "ice";

export interface TowerCall {
  id: number;
  callsign: string;
  message: string;
  tone: CallTone;
}

interface TowerCallState {
  calls: TowerCall[];
  sound: boolean;
  push: (call: Omit<TowerCall, "id">) => void;
  dismiss: (id: number) => void;
  toggleSound: () => void;
}

let seq = 0;

export const useTowerCalls = create<TowerCallState>((set, get) => ({
  calls: [],
  sound: false,
  push: (call) => {
    const id = ++seq;
    set((s) => ({ calls: [...s.calls.slice(-4), { ...call, id }] }));
    if (get().sound && call.tone === "alarm") radarPing();
    setTimeout(() => get().dismiss(id), 5200);
  },
  dismiss: (id) => set((s) => ({ calls: s.calls.filter((c) => c.id !== id) })),
  toggleSound: () => set((s) => ({ sound: !s.sound })),
}));

/** Soft radar ping (off by default), synthesised so no audio asset is needed. */
function radarPing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch {
    /* audio unavailable */
  }
}

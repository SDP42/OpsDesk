"use client";

/**
 * Demo Autopilot: a narrated 90-second flight through the product. Each step navigates,
 * optionally performs a live action (e.g. Chaos Mode), shows a caption and speaks it.
 */
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useAutopilot } from "@/lib/stores/autopilot";

interface Step {
  title: string;
  say: string;
  path: string | (() => Promise<string>);
  action?: () => Promise<void>;
  seconds: number;
}

async function journeyAFlight(): Promise<string> {
  const r = await api.GET("/api/tickets", { params: { query: { tboh: "TBOH-88213", limit: 1 } } });
  const t = (r.data as unknown as { data: { number: string }[] } | undefined)?.data?.[0];
  return t ? `/tower/t/${t.number}` : "/tower";
}

const STEPS: Step[] = [
  {
    title: "The tower",
    say: "This is OpsDesk, the control tower for TBO operations. Every open case is a flight on the radar. Distance from the centre is how much of its deadline has burned.",
    path: "/tower",
    seconds: 10,
  },
  {
    title: "Context, not isolated tickets",
    say: "This refund was raised three times on one booking. OpsDesk linked every contact, raised the priority, and shows why it was routed to this controller.",
    path: journeyAFlight,
    seconds: 11,
  },
  {
    title: "Ghost flights",
    say: "A model predicts which bookings will turn into tickets before the agency writes in. One heads-up message and the problem never becomes a ticket.",
    path: "/tower/ghosts",
    seconds: 10,
  },
  {
    title: "Storm cells",
    say: "When dozens of cases hit the same hotel, OpsDesk groups them into one incident. One approved reply goes to every affected agency.",
    path: "/tower/storms",
    action: async () => {
      const r = await api.GET("/api/storms");
      if (!(r.data as unknown as { data: unknown[] } | undefined)?.data?.length) {
        await api.POST("/api/admin/chaos", { params: { query: { count: 20 } } });
      }
    },
    seconds: 11,
  },
  {
    title: "Crew roster",
    say: "Leave and shifts flow in from the HR system. Nobody on leave gets new cases, and cases they still own are handed over in one click.",
    path: "/tower/roster",
    seconds: 10,
  },
  {
    title: "Weather radar",
    say: "Conversations become themes. Spikes are flagged as emerging, and each theme can carry a product ticket so engineering fixes the cause.",
    path: "/tower/insights",
    seconds: 10,
  },
  {
    title: "What-if routing",
    say: "Before changing how work is assigned, replay the day under every routing style and pick the one with the fewest missed deadlines.",
    path: "/tower/simulate",
    seconds: 10,
  },
  {
    title: "Uncapped data",
    say: "Exports stream every row, with no three thousand row cap, and old cases move to the archive automatically.",
    path: "/tower/data",
    seconds: 9,
  },
  {
    title: "Cleared for takeoff",
    say: "Every ticket is a flight. And now, someone is watching the tower.",
    path: "/tower",
    seconds: 7,
  },
];

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  u.voice =
    voices.find((v) => /natural|neural|enhanced|samantha|google uk english female/i.test(v.name)) ??
    voices[0] ??
    null;
  u.rate = 1.03;
  window.speechSynthesis.speak(u);
}

export function Autopilot() {
  const router = useRouter();
  const { active, step, playing, voice, go, toggle, toggleVoice, stop, start } = useAutopilot();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Start from a deep link (?autopilot=1), e.g. the landing page's 90-second flight.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("autopilot") === "1") start();
  }, [start]);

  useEffect(() => {
    if (!active) return;
    const s = STEPS[step];
    if (!s) {
      stop();
      return;
    }
    let cancelled = false;
    void (async () => {
      const path = typeof s.path === "string" ? s.path : await s.path();
      if (cancelled) return;
      router.push(path);
      if (s.action) await s.action().catch(() => undefined);
      if (voice) speak(s.say);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, step, router, voice, stop]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!active || !playing) return;
    timer.current = setTimeout(() => go(step + 1), (STEPS[step]?.seconds ?? 8) * 1000);
    return () => clearTimeout(timer.current);
  }, [active, playing, step, go]);

  const s = STEPS[step];
  return (
    <AnimatePresence>
      {active && s && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-night fixed bottom-6 left-1/2 z-[75] w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl p-5 text-white shadow-[var(--shadow-lift)]"
          role="region"
          aria-label="Demo autopilot"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-taxi font-mono text-[11px] tracking-[0.14em] uppercase">
                Autopilot · {step + 1}/{STEPS.length}
              </p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <p className="display mt-1 text-3xl">{s.title}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">{s.say}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <button
              onClick={stop}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Stop autopilot"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Step ${i + 1}`}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
                >
                  {i < step && <span className="bg-taxi block h-full" />}
                  {i === step && (
                    <motion.span
                      key={`${step}-${playing}`}
                      className="bg-taxi block h-full"
                      initial={{ width: "0%" }}
                      animate={{ width: playing ? "100%" : "35%" }}
                      transition={{ duration: playing ? s.seconds : 0.3, ease: "linear" }}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[
                {
                  icon: <SkipBack size={15} />,
                  label: "Previous",
                  on: () => go(Math.max(0, step - 1)),
                },
                {
                  icon: playing ? <Pause size={15} /> : <Play size={15} />,
                  label: playing ? "Pause" : "Play",
                  on: toggle,
                },
                { icon: <SkipForward size={15} />, label: "Next", on: () => go(step + 1) },
                {
                  icon: voice ? <Volume2 size={15} /> : <VolumeX size={15} />,
                  label: "Narration",
                  on: () => {
                    window.speechSynthesis?.cancel();
                    toggleVoice();
                  },
                },
              ].map((b) => (
                <button
                  key={b.label}
                  onClick={b.on}
                  aria-label={b.label}
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {b.icon}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CloudLightning,
  CloudSun,
  Command,
  Database,
  FlaskConical,
  Ghost,
  HelpCircle,
  LogOut,
  Orbit,
  Sun,
  Plane,
  Tv,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, unwrap, type Me } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useLogout } from "@/lib/hooks/use-me";
import { useTowerStream } from "@/lib/hooks/use-tower-stream";
import { useTowerCalls } from "@/lib/stores/tower-calls";
import { TowerRadio } from "@/components/assistant/tower-radio";
import { Autopilot } from "@/components/autopilot/autopilot";
import { useAutopilot } from "@/lib/stores/autopilot";
import { FirstFlight, startTour } from "@/components/onboarding/first-flight";
import { CommandPalette } from "@/components/ui/command-palette";
import { HangarGlyph, RadarGlyph, StripGlyph, TowerGlyph } from "@/components/ui/glyphs";
import { Sign, Tip, Toggle } from "@/components/ui/primitives";

const PERSONA: Record<string, string> = {
  requester: "Pilot",
  agent: "Controller",
  escalation_manager: "Tower Chief",
  lead: "Airport Director",
};

interface NavItem {
  href: string;
  label: string;
  gate: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV: NavItem[] = [
  {
    href: "/tower",
    label: "Overview",
    gate: "A1",
    icon: <RadarGlyph />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/queue",
    label: "My queue",
    gate: "A2",
    icon: <StripGlyph />,
    roles: ["agent", "lead"],
  },
  {
    href: "/tower/triage",
    label: "Triage",
    gate: "B1",
    icon: <HangarGlyph />,
    roles: ["agent", "lead"],
  },
  {
    href: "/tower/escalations",
    label: "Escalations",
    gate: "C1",
    icon: <TowerGlyph />,
    roles: ["escalation_manager", "lead", "agent"],
  },
  {
    href: "/tower/ghosts",
    label: "Ghost flights",
    gate: "D1",
    icon: <Ghost size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/storms",
    label: "Storm cells",
    gate: "D2",
    icon: <CloudLightning size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/roster",
    label: "Crew roster",
    gate: "E1",
    icon: <Users size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/suppliers",
    label: "Suppliers",
    gate: "E2",
    icon: <Building2 size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/insights",
    label: "Weather radar",
    gate: "F1",
    icon: <CloudSun size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead"],
  },
  {
    href: "/tower/data",
    label: "Black box",
    gate: "F2",
    icon: <Database size={18} strokeWidth={1.5} />,
    roles: ["lead"],
  },
  {
    href: "/tower/links",
    label: "Constellation",
    gate: "B2",
    icon: <Orbit size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/handoffs",
    label: "Follow the sun",
    gate: "E3",
    icon: <Sun size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/wall",
    label: "Wall mode",
    gate: "W1",
    icon: <Tv size={18} strokeWidth={1.5} />,
    roles: ["agent", "lead", "escalation_manager"],
  },
  {
    href: "/tower/simulate",
    label: "Simulator",
    gate: "F3",
    icon: <FlaskConical size={18} strokeWidth={1.5} />,
    roles: ["lead"],
  },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="OpsDesk home">
      <span className="bg-night text-taxi relative grid size-9 place-items-center rounded-[10px] shadow-[var(--shadow-card)]">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" opacity=".55" />
          <path
            d="M12 12 18 6.5"
            className="origin-center transition-transform duration-700 group-hover:rotate-[200deg]"
            style={{ transformBox: "view-box" }}
          />
          <circle cx="15.5" cy="14.5" r="1.1" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="display block text-[22px]">OpsDesk</span>
          <span className="micro !text-[9px]">Control Tower</span>
        </span>
      )}
    </Link>
  );
}

export function DataModeSwitch({ me }: { me: Me }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (data_mode: "demo" | "live") =>
      unwrap(await api.PATCH("/api/me/preferences", { body: { data_mode } })),
    onSuccess: (next) => {
      qc.setQueryData(["me"], next);
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
  });
  const live = me.data_mode === "live";
  return (
    <div
      data-tour="mode"
      className="border-line bg-ink-800 flex items-center gap-2.5 rounded-full border py-1 pr-1.5 pl-3"
    >
      <label htmlFor="mode-switch" className="micro !text-text cursor-pointer whitespace-nowrap">
        {live ? "Live tower" : "Demo airspace"}
      </label>
      <Toggle
        id="mode-switch"
        label="Use live data"
        checked={live}
        onCheckedChange={(v) => save.mutate(v ? "live" : "demo")}
      />
    </div>
  );
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const logout = useLogout();
  const stream = useTowerStream(me.role !== "requester");
  const { sound, toggleSound } = useTowerCalls();
  const nav = NAV.filter((n) => n.roles.includes(me.role));
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const t = () => setNow(new Date().toISOString().slice(11, 19) + "Z");
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10 flex min-h-dvh">
      <aside className="border-line bg-ink-900/90 sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-4 py-6 backdrop-blur lg:flex">
        <div className="px-1">
          <Brand />
        </div>
        <div className="bg-night mt-6 shrink-0 rounded-xl p-3 text-white">
          <p className="micro !text-white/50">Tower clock</p>
          <p
            className="text-taxi tabular mt-1 font-mono text-2xl tracking-wider"
            suppressHydrationWarning
          >
            {now || "--:--:--Z"}
          </p>
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-white/70 uppercase">
            <span
              className={cn(
                "size-1.5 rounded-full",
                stream.connected ? "bg-signal" : "animate-pulse-alarm bg-alarm",
              )}
            />
            {stream.connected ? "Receiving live" : "Reconnecting"}
          </p>
        </div>
        <nav
          className="mt-5 -mr-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-2"
          aria-label="Tower"
          data-tour="nav"
        >
          {nav.map((n) => {
            const active =
              n.href === "/tower" ? pathname === "/tower" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-1.5 text-[14px] transition-colors",
                  active ? "text-night" : "text-text-dim hover:bg-ink-700/60 hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="bg-taxi absolute inset-0 rounded-xl"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative flex w-full items-center gap-3">
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-md font-mono text-[10px] font-semibold",
                      active ? "bg-night text-taxi" : "bg-ink-700 text-text-dim",
                    )}
                  >
                    {n.gate}
                  </span>
                  {n.label}
                  <span className="ml-auto opacity-70">{n.icon}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex shrink-0 flex-col gap-3">
          <button
            data-tour="command"
            className="border-line bg-ink-800 text-text-dim hover:border-text/40 hover:text-text flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition"
            onClick={() => window.dispatchEvent(new Event("opsdesk:palette"))}
          >
            <span className="flex items-center gap-2">
              <Command size={14} strokeWidth={1.5} /> Jump to…
            </span>
            <kbd className="bg-ink-700 rounded px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <div className="border-line bg-ink-800 flex items-center gap-3 rounded-xl border p-3">
            <span className="bg-beacon grid size-9 place-items-center rounded-full font-mono text-[12px] font-semibold text-white">
              {me.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm">{me.name}</p>
              <p className="micro truncate">{PERSONA[me.role]}</p>
            </div>
            <Tip label="Sign out">
              <button
                onClick={logout}
                className="text-text-dim hover:text-alarm"
                aria-label="Sign out"
              >
                <LogOut size={15} strokeWidth={1.5} />
              </button>
            </Tip>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-ink-950/80 sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-md lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="lg:hidden">
              <Brand compact />
            </span>
            <nav className="flex gap-1 overflow-x-auto lg:hidden">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "sign whitespace-nowrap",
                    pathname === n.href ? "" : "!text-text-dim !bg-transparent",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="hidden items-center gap-2 lg:flex">
              <Sign tone="dark">{me.callsign ?? PERSONA[me.role]}</Sign>
              <span className="micro">{me.region ? `Region ${me.region}` : "All regions"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AutopilotButton />
            <DataModeSwitch me={me} />
            <Tip label="Replay the tour">
              <button
                className="border-line bg-ink-800 text-text-dim hover:text-text hidden size-9 place-items-center rounded-full border sm:grid"
                onClick={() => startTour(me.role)}
                aria-label="Replay the tour"
              >
                <HelpCircle size={15} strokeWidth={1.5} />
              </button>
            </Tip>
            <Tip label={sound ? "Mute radar ping" : "Radar ping on escalation"}>
              <button
                onClick={toggleSound}
                aria-label="Toggle radar ping"
                className="border-line bg-ink-800 text-text-dim hover:text-text grid size-9 place-items-center rounded-full border"
              >
                {sound ? (
                  <Volume2 size={15} strokeWidth={1.5} />
                ) : (
                  <VolumeX size={15} strokeWidth={1.5} />
                )}
              </button>
            </Tip>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <CommandPalette role={me.role} />
      <FirstFlight me={me} />
      <Autopilot />
      <TowerRadio persona={PERSONA[me.role] ?? "controller"} />
    </div>
  );
}

function AutopilotButton() {
  const { active, start } = useAutopilot();
  if (active) return null;
  return (
    <Tip label="Narrated 90-second tour of every feature">
      <button onClick={start} className="btn !py-1.5">
        <Plane size={14} /> Autopilot
      </button>
    </Tip>
  );
}

"use client";

import { clsx } from "clsx";
import { Command, LogOut, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Me } from "@/lib/api/client";
import { useLogout } from "@/lib/hooks/use-me";
import { useTowerStream } from "@/lib/hooks/use-tower-stream";
import { useTowerCalls } from "@/lib/stores/tower-calls";
import { CommandPalette } from "@/components/ui/command-palette";
import { HangarGlyph, RadarGlyph, StripGlyph, TowerGlyph } from "@/components/ui/glyphs";

const PERSONA: Record<string, string> = {
  requester: "Pilot",
  agent: "Controller",
  escalation_manager: "Tower Chief",
  lead: "Airport Director",
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV: NavItem[] = [
  { href: "/tower", label: "Overview", icon: <RadarGlyph />, roles: ["agent", "lead", "escalation_manager"] },
  { href: "/tower/queue", label: "My queue", icon: <StripGlyph />, roles: ["agent", "lead"] },
  { href: "/tower/triage", label: "Triage", icon: <HangarGlyph />, roles: ["agent", "lead"] },
  { href: "/tower/escalations", label: "Escalations", icon: <TowerGlyph />, roles: ["escalation_manager", "lead", "agent"] },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="OpsDesk home">
      <span className="relative grid size-7 place-items-center rounded-full border border-signal/60">
        <span className="absolute inset-1 rounded-full border border-signal/30" />
        <span className="size-1.5 rounded-full bg-signal" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-serif text-[19px]">OpsDesk</span>
          <span className="micro !text-[9px]">Control Tower</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const logout = useLogout();
  const stream = useTowerStream(me.role !== "requester");
  const { sound, toggleSound } = useTowerCalls();
  const nav = NAV.filter((n) => n.roles.includes(me.role));

  return (
    <div className="relative z-10 flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-ink-950/80 px-3 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Tower">
          {nav.map((n) => {
            const active = n.href === "/tower" ? pathname === "/tower" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors",
                  active ? "border-signal bg-ink-800 text-text" : "border-transparent text-text-dim hover:text-text",
                )}
              >
                {n.icon}
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-2">
          <button
            className="flex items-center justify-between border border-line px-3 py-2 text-left font-mono text-[11px] text-text-dim hover:text-text"
            onClick={() => window.dispatchEvent(new Event("opsdesk:palette"))}
          >
            <span className="flex items-center gap-2">
              <Command size={13} strokeWidth={1.5} /> Command
            </span>
            <kbd>⌘K</kbd>
          </button>
          <div className="flex items-center justify-between">
            <span className="micro flex items-center gap-1.5">
              <span className={clsx("size-1.5 rounded-full", stream.connected ? "bg-signal" : "bg-alarm animate-pulse-alarm")} />
              {stream.connected ? "Live" : "No contact"}
            </span>
            <button
              onClick={toggleSound}
              aria-label={sound ? "Mute radar ping" : "Enable radar ping"}
              className="text-text-dim hover:text-text"
            >
              {sound ? <Volume2 size={14} strokeWidth={1.5} /> : <VolumeX size={14} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-ink-950/80 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-4 lg:hidden">
            <Brand compact />
            <nav className="flex gap-3 overflow-x-auto">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="micro whitespace-nowrap hover:text-text">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="micro hidden lg:block">
            {new Date().toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })} · UTC{" "}
            <UtcClock />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-sm">{me.name}</div>
              <div className="micro">
                {PERSONA[me.role]} {me.callsign ? `· ${me.callsign}` : ""}
              </div>
            </div>
            <button onClick={logout} className="text-text-dim hover:text-alarm" aria-label="Sign out">
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
      <CommandPalette role={me.role} />
    </div>
  );
}

function UtcClock() {
  return <span suppressHydrationWarning className="tabular">{new Date().toISOString().slice(11, 16)}Z</span>;
}

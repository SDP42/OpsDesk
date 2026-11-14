"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/tower/app-shell";
import { HangarGlyph, RadarGlyph, StripGlyph, TowerGlyph } from "@/components/ui/glyphs";
import { ErrorState } from "@/components/ui/states";
import { api, ApiError, unwrap, type DemoAccount } from "@/lib/api/client";
import { homeFor } from "@/lib/hooks/use-me";

const CARD: Record<string, { glyph: React.ReactNode; blurb: string; tone: string }> = {
  requester: { glyph: <StripGlyph size={22} />, blurb: "Agency user. Tracks own flights on the departures board.", tone: "text-ice" },
  agent: { glyph: <RadarGlyph size={22} />, blurb: "Works the queue with history, links and a routing reason.", tone: "text-signal" },
  escalation_manager: { glyph: <TowerGlyph size={22} />, blurb: "Receives escalations directly. Check-in and LCD urgency.", tone: "text-alarm" },
  lead: { glyph: <HangarGlyph size={22} />, blurb: "Queue health, SLA risk, insights and uncapped exports.", tone: "text-amber" },
};

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const accounts = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: async () => unwrap(await api.GET("/api/auth/demo-accounts")),
  });
  const login = useMutation({
    mutationFn: async (body: { email: string; password: string }) =>
      unwrap(await api.POST("/api/auth/login", { body })),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me);
      const go = () => router.push(homeFor(me.role));
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        doc.startViewTransition(go);
      } else go();
    },
  });

  const pick = (a: DemoAccount) => {
    setEmail(a.email);
    if (a.demo_password) {
      setPassword(a.demo_password);
      login.mutate({ email: a.email, password: a.demo_password });
    }
  };

  return (
    <div className="relative z-10 min-h-dvh overflow-hidden">
      {/* Radar-sweep entrance */}
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[140vmax] -translate-x-1/2 -translate-y-1/2">
        <div
          className="absolute inset-0 animate-sweep rounded-full opacity-40"
          style={{ background: "conic-gradient(from 0deg, transparent 0 320deg, color-mix(in oklab, var(--color-signal) 18%, transparent) 360deg)", animationDuration: "7s" }}
        />
        {[18, 32, 46].map((r) => (
          <div key={r} className="absolute rounded-full border border-line/50" style={{ inset: `${r}%` }} />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Brand />
          <span className="micro hidden sm:block">Frequency 118.40 · Demo environment</span>
        </header>

        <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-[1fr_1.35fr] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
            <p className="micro text-signal">Establishing contact</p>
            <h1 className="mt-3 font-serif text-5xl leading-[0.95] sm:text-7xl">
              Choose your <em className="text-signal">callsign</em>.
            </h1>
            <p className="mt-5 max-w-md text-text-dim">
              Four seats in the tower. Pick a persona to sign in with the seeded demo account, or enter credentials below.
            </p>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.isLoading &&
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-40 border border-line" />)}
            {accounts.error && (
              <div className="sm:col-span-2">
                <ErrorState message="Run `make seed` and `make dev`, then retry." onRetry={() => accounts.refetch()} />
              </div>
            )}
            {accounts.data?.map((a, i) => {
              const card = CARD[a.role]!;
              const busy = login.isPending && login.variables?.email === a.email;
              return (
                <motion.button
                  key={a.role}
                  data-testid={`callsign-${a.role}`}
                  onClick={() => pick(a)}
                  disabled={login.isPending}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                  className="hud group flex min-h-40 flex-col p-5 text-left transition-colors hover:bg-ink-800"
                >
                  <span className="hud-tr" aria-hidden />
                  <span className="hud-bl" aria-hidden />
                  <div className="flex items-center justify-between">
                    <span className={clsx(card.tone)}>{card.glyph}</span>
                    {busy ? (
                      <Loader2 size={16} className="animate-spin text-signal" />
                    ) : (
                      <ArrowRight size={16} strokeWidth={1.5} className="text-text-dim transition-transform group-hover:translate-x-1 group-hover:text-signal" />
                    )}
                  </div>
                  <span className="mt-4 font-serif text-3xl">{a.persona}</span>
                  <span className="micro mt-1">{a.name}</span>
                  <span className="mt-3 text-[13px] text-text-dim">{card.blurb}</span>
                  <span className="mt-auto pt-3 font-mono text-[11px] text-text-dim/80">{a.email}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <form
          className="hud mt-10 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] lg:max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <span className="hud-tr" aria-hidden />
          <span className="hud-bl" aria-hidden />
          <label className="flex flex-col gap-1">
            <span className="micro">Email</span>
            <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="micro">Password</span>
            <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="btn btn-signal self-end" disabled={login.isPending}>
            {login.isPending ? <Loader2 size={14} className="animate-spin" /> : "Cleared to enter"}
          </button>
          {login.error && (
            <p role="alert" className="font-mono text-xs text-alarm sm:col-span-3">
              {(login.error as ApiError).message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

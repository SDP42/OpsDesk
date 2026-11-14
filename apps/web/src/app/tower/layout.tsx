"use client";

import { AppShell } from "@/components/tower/app-shell";
import { ErrorState } from "@/components/ui/states";
import { STAFF_ROLES, useRequireRole } from "@/lib/hooks/use-me";

export default function TowerLayout({ children }: { children: React.ReactNode }) {
  const me = useRequireRole(STAFF_ROLES);
  if (me.error && me.error.status !== 401) {
    return <ErrorState message={me.error.message} onRetry={() => me.refetch()} />;
  }
  if (!me.data || !STAFF_ROLES.includes(me.data.role as (typeof STAFF_ROLES)[number])) {
    return (
      <div className="relative z-10 grid min-h-dvh place-items-center">
        <p className="micro animate-pulse-alarm">Establishing contact…</p>
      </div>
    );
  }
  return <AppShell me={me.data}>{children}</AppShell>;
}

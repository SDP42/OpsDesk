"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, ApiError, unwrap, type Me } from "@/lib/api/client";

export const STAFF_ROLES = ["agent", "escalation_manager", "lead"] as const;

export function homeFor(role: string): string {
  if (role === "requester") return "/pilot";
  if (role === "supplier") return "/partner";
  if (role === "escalation_manager") return "/tower/escalations";
  return "/tower";
}

export function useMe() {
  return useQuery<Me, ApiError>({
    queryKey: ["me"],
    queryFn: async () => unwrap(await api.GET("/api/me")),
    staleTime: 60_000,
  });
}

/** Client guard: redirect to /login when signed out, or home when the role does not fit. */
export function useRequireRole(roles: readonly string[]) {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.error?.status === 401) router.replace("/login");
    else if (me.data && !roles.includes(me.data.role)) router.replace(homeFor(me.data.role));
  }, [me.data, me.error, roles, router]);
  return me;
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await api.POST("/api/auth/logout");
    qc.clear();
    router.replace("/login");
  };
}

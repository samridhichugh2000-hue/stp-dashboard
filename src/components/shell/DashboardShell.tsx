"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/../convex/_generated/api";
import { AppShell } from "./AppShell";

const USER_ALLOWED_PATHS = ["/dashboard/faq"];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.queries.users.me);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    // viewer role → redirect to FAQ if on any other route
    if (me && me.role === "viewer") {
      const allowed = USER_ALLOWED_PATHS.some(p => pathname.startsWith(p));
      if (!allowed) router.replace("/dashboard/faq");
    }
  }, [isAuthenticated, authLoading, me, pathname, router]);

  // Show nothing while auth resolves
  if (authLoading || me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f5f3ff 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse" />
          <p className="text-xs text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !me) return null;

  return (
    <AppShell userName={me.name} userRole={me.role}>
      {children}
    </AppShell>
  );
}

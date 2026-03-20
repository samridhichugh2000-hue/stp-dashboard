"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "./AppShell";
import type { UserRole } from "./Sidebar";

const USER_ALLOWED_PATHS = ["/dashboard/faq"];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    // viewer role → redirect to FAQ if on any other route
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role === "viewer") {
      const allowed = USER_ALLOWED_PATHS.some(p => pathname.startsWith(p));
      if (!allowed) router.replace("/dashboard/faq");
    }
  }, [status, session, pathname, router]);

  if (status === "loading") {
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

  if (status === "unauthenticated" || !session?.user) return null;

  const user = session.user as { name?: string | null; role?: string };
  const userName = user.name ?? "User";
  const userRole = (user.role ?? "viewer") as UserRole;

  return (
    <AppShell userName={userName} userRole={userRole}>
      {children}
    </AppShell>
  );
}

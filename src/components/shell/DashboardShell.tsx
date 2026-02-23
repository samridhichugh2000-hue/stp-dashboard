"use client";

import { AppShell } from "./AppShell";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell userName="Demo User" userRole="admin">
      {children}
    </AppShell>
  );
}

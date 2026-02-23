// Server component — forces all dashboard routes to be dynamic (no static prerendering)
export const dynamic = "force-dynamic";

import { DashboardShell } from "@/components/shell/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}

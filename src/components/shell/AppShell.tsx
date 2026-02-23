"use client";

import { Sidebar, UserRole } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SyncStatusBar } from "./SyncStatusBar";

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  userRole: UserRole;
}

export function AppShell({ children, userName, userRole }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={userRole} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar userName={userName} userRole={userRole} />
        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          {children}
        </main>
        <SyncStatusBar />
      </div>
    </div>
  );
}

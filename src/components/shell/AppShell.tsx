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
    <div className="flex h-screen overflow-hidden" style={{background:"linear-gradient(135deg,#f0f4ff 0%,#f8fafc 50%,#f5f3ff 100%)"}}>
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

"use client";

import { Bell, RefreshCw, ChevronDown, Menu, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";

interface TopBarProps {
  userName: string;
  userRole: string;
  onRefresh?: () => void;
  onMobileNavOpen?: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700",
  manager: "bg-indigo-100 text-indigo-700",
  viewer: "bg-sky-100 text-sky-700",
  nj: "bg-emerald-100 text-emerald-700",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
  nj: "New Joiner",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({ userName, userRole, onRefresh, onMobileNavOpen }: TopBarProps) {
  const [refreshing,    setRefreshing]    = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const syncLogs = useQuery(api.queries.syncLogs.latestByModule);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const hasError = false; // hidden
  const isRunning = syncLogs?.some((l: Doc<"syncLogs">) => l.status === "running");

  const lastSync = syncLogs
    ? syncLogs
        .filter((l: Doc<"syncLogs">) => l.status === "success")
        .map((l: Doc<"syncLogs">) => l.lastSyncAt)
        .sort()
        .pop()
    : null;

  async function handleRefresh() {
    setRefreshing(true);
    onRefresh?.();
    await new Promise((r) => setTimeout(r, 900));
    setRefreshing(false);
  }

  function formatSync(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const syncStatus = hasError ? "error" : isRunning ? "running" : "ok";
  const syncColors = {
    ok: "text-emerald-600 bg-emerald-50",
    running: "text-amber-600 bg-amber-50",
    error: "text-red-600 bg-red-50",
  };
  const syncDotColors = {
    ok: "bg-emerald-500",
    running: "bg-amber-400 pulse-dot",
    error: "bg-red-500",
  };

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200/70 sticky top-0 z-10 no-print shadow-sm">
      {/* Left: hamburger (mobile) + date (desktop) */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMobileNavOpen}
          className="md:hidden p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Date — hidden on small screens */}
        <div className="hidden sm:block">
          <div className="text-sm font-medium text-gray-900">{today.split(",")[0]},</div>
          <div className="text-xs text-gray-500 -mt-0.5">{today.split(",").slice(1).join(",").trim()}</div>
        </div>
      </div>

      {/* Right: sync + refresh + alerts + user */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Sync status chip — hidden on xs */}
        <div
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${syncColors[syncStatus]}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${syncDotColors[syncStatus]}`} />
          {hasError
            ? "Sync error"
            : isRunning
            ? "Syncing…"
            : lastSync
            ? `Synced ${formatSync(lastSync)}`
            : "Awaiting sync"}
        </div>

        {/* Sync dot — xs only */}
        <span
          className={`sm:hidden w-2 h-2 rounded-full ${syncDotColors[syncStatus]}`}
          title={hasError ? "Sync error" : isRunning ? "Syncing" : "Synced"}
        />

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin text-indigo-500" : ""} />
        </button>

        {/* Bell */}
        <button className="relative p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Bell size={15} />
          {hasError && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-7 bg-gray-200" />

        {/* User chip + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {getInitials(userName)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-gray-900 leading-tight">{userName}</div>
              <div
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${ROLE_COLORS[userRole] ?? "bg-gray-100 text-gray-600"}`}
              >
                {ROLE_LABEL[userRole] ?? userRole}
              </div>
            </div>
            <ChevronDown size={13} className={`text-gray-400 group-hover:text-gray-600 transition-all ${userMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-800 truncate">{userName}</p>
                <p className="text-[10px] text-gray-400 truncate">{ROLE_LABEL[userRole] ?? userRole}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

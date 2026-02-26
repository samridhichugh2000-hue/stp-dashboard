"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Mic2,
  Users2,
  TrendingUp,
  BarChart3,
  Building2,
  Award,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from "lucide-react";
import { useState } from "react";

export type UserRole = "admin" | "manager" | "viewer" | "nj";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  color: string;
}

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard/overview",
    icon: <LayoutDashboard size={17} />,
    roles: ["admin", "manager", "viewer", "nj"],
    color: "from-indigo-400 to-indigo-600",
  },
  {
    label: "Qubits",
    href: "/dashboard/qubits",
    icon: <Mic2 size={17} />,
    roles: ["admin", "manager", "viewer"],
    color: "from-violet-400 to-violet-600",
  },
  {
    label: "Leads",
    href: "/dashboard/leads",
    icon: <Users2 size={17} />,
    roles: ["admin", "manager", "viewer"],
    color: "from-sky-400 to-sky-600",
  },
  {
    label: "NRD",
    href: "/dashboard/nrd",
    icon: <TrendingUp size={17} />,
    roles: ["admin", "manager", "viewer"],
    color: "from-emerald-400 to-emerald-600",
  },
  {
    label: "ROI",
    href: "/dashboard/roi",
    icon: <BarChart3 size={17} />,
    roles: ["admin", "manager", "viewer"],
    color: "from-amber-400 to-amber-600",
  },
  {
    label: "RCB Claims",
    href: "/dashboard/rcb",
    icon: <Building2 size={17} />,
    roles: ["admin", "manager", "viewer"],
    color: "from-pink-400 to-pink-600",
  },
  {
    label: "Performance",
    href: "/dashboard/performance",
    icon: <Award size={17} />,
    roles: ["admin", "manager"],
    color: "from-rose-400 to-rose-600",
  },
];

interface SidebarProps {
  role: UserRole;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ role, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const visible = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "flex flex-col h-screen z-50 transition-all duration-300",
          // Fixed on mobile (overlay drawer), sticky on desktop
          "fixed md:sticky top-0 left-0",
          // Mobile visibility
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Width: always 60 on mobile, respect collapsed on desktop
          "w-60",
          collapsed && "md:w-16",
        )}
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)" }}
      >
        {/* Brand */}
        <div
          className={clsx(
            "flex items-center gap-3 px-4 py-5 border-b border-white/10",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-lg">
            <Zap size={16} className="text-white" />
          </div>
          <div className={clsx("flex-1", collapsed && "md:hidden")}>
            <span className="font-bold text-sm text-white tracking-tight">STP Dashboard</span>
            <div className="text-[10px] text-indigo-300 mt-0.5">Sales Training Portal</div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onMobileClose}
            className="ml-auto md:hidden p-1 text-indigo-300 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto px-2">
          <p className={clsx(
            "text-[10px] font-semibold text-indigo-400 uppercase tracking-widest px-2 mb-2",
            collapsed && "md:hidden"
          )}>
            Navigation
          </p>
          {visible.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                onClick={onMobileClose}
                className={clsx(
                  "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group",
                  active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-indigo-200 hover:bg-white/8 hover:text-white"
                )}
              >
                {/* Active left bar */}
                {active && (
                  <span className="nav-indicator absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-indigo-300 to-violet-300" />
                )}

                {/* Icon */}
                <span
                  className={clsx(
                    "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                    active
                      ? `bg-gradient-to-br ${item.color} shadow-md`
                      : "bg-white/5 group-hover:bg-white/10"
                  )}
                >
                  {item.icon}
                </span>

                <span className={clsx("truncate", collapsed && "md:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center gap-2 px-4 py-3.5 border-t border-white/10 text-indigo-300 hover:text-white text-xs hover:bg-white/8 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </aside>
    </>
  );
}

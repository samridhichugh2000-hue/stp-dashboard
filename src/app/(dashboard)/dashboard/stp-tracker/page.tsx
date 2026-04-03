"use client";

import { useState, useEffect } from "react";
import type { NJ, PerformanceAlert } from "@/lib/types";
import { Activity, Search, User, CalendarDays, Clock, ChevronRight, Flag, FlagOff, Maximize2, Minimize2, Mail, Send, X, Video, ExternalLink, Repeat2 } from "lucide-react";
import { fmtTenure } from "@/lib/formatTenure";
import { clsx } from "clsx";
import { useSession } from "next-auth/react";
import { STPPhaseBar } from "@/components/panels/overview/STPPhaseBar";
import { DayWiseTaskTracker } from "@/components/panels/overview/DayWiseTaskTracker";
import { AssessmentChecklist } from "@/components/panels/overview/AssessmentChecklist";

// ── helpers ────────────────────────────────────────────────────────────────────

function workingDaysSince(dojISO: string): number {
  const doj = new Date(dojISO);
  doj.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ── STP status ─────────────────────────────────────────────────────────────────

type STPStatus =
  | "Phase 1 — Training"
  | "Phase 2 — Extended"
  | "Developed"
  | "On PA"
  | "On PIP"
  | "Exited"
  | "Not Developed";

function getSTPStatus(
  nj: NJ,
  wds: number,
  alerts: PerformanceAlert[]
): STPStatus {
  const njAlerts = alerts.filter((a) => a.njId === nj.id);
  const hasExit = njAlerts.some((a) => a.alertType === "EXIT");
  const hasPIP  = njAlerts.some((a) => a.alertType === "PIP");
  const hasPA   = njAlerts.some((a) => a.alertType === "PA");

  if (hasExit) return "Exited";
  if (hasPIP)  return "On PIP";
  if (hasPA)   return "On PA";
  if (wds <= 14) return "Phase 1 — Training";
  if (wds <= 18) return "Phase 2 — Extended";
  return nj.hasPositiveNR ? "Developed" : "Not Developed";
}

const STATUS_STYLE: Record<STPStatus, string> = {
  "Phase 1 — Training": "bg-blue-100 text-blue-700 border-blue-200",
  "Phase 2 — Extended": "bg-amber-100 text-amber-700 border-amber-200",
  "Developed":          "bg-emerald-100 text-emerald-700 border-emerald-200",
  "On PA":              "bg-orange-100 text-orange-700 border-orange-200",
  "On PIP":             "bg-red-100 text-red-700 border-red-200",
  "Exited":             "bg-gray-200 text-gray-600 border-gray-300",
  "Not Developed":      "bg-rose-100 text-rose-700 border-rose-200",
};

const STATUS_DOT: Record<STPStatus, string> = {
  "Phase 1 — Training": "bg-blue-500",
  "Phase 2 — Extended": "bg-amber-500",
  "Developed":          "bg-emerald-500",
  "On PA":              "bg-orange-500",
  "On PIP":             "bg-red-500",
  "Exited":             "bg-gray-500",
  "Not Developed":      "bg-rose-500",
};

// ── component ──────────────────────────────────────────────────────────────────

type WIPModalState = { nj: NJ & { wds: number; status: STPStatus }; marking: boolean } | null;

interface MeetingLog {
  id: number;
  meetingType: string;
  scheduledAt: string;
  subject: string;
  status: string;
  teamsJoinUrl: string | null;
  durationMins: number;
}

export default function STPTrackerPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [njs,      setNjs]      = useState<NJ[] | null>(null);
  const [alerts,   setAlerts]   = useState<PerformanceAlert[]>([]);
  const [search,   setSearch]   = useState("");
  const [selectedNJ, setSelectedNJ] = useState<(NJ & { wds: number; status: STPStatus }) | null>(null);
  const [wipModal,   setWipModal]   = useState<WIPModalState>(null);
  const [wipNote,    setWipNote]    = useState("");
  const [wipSaving,  setWipSaving]  = useState(false);
  const [closeModal, setCloseModal] = useState<(NJ & { wds: number; status: STPStatus }) | null>(null);
  const [closeSaving, setCloseSaving] = useState(false);

  const loadNJs = () => {
    fetch("/api/nj?includeInactive=true")
      .then((r) => r.json())
      .then(setNjs)
      .catch(() => setNjs([]));
  };

  useEffect(() => {
    loadNJs();
    fetch("/api/performance/alerts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, []);

  const handleProgressToggle = async (
    nj: NJ & { wds: number; status: STPStatus },
    field: "managerHuddle" | "stpMetrics",
    done: boolean
  ) => {
    await fetch(`/api/nj/${nj.id}/stp-progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, done }),
    });
    loadNJs();
  };

  const handleCloseConfirm = async () => {
    if (!closeModal) return;
    setCloseSaving(true);
    await fetch(`/api/nj/${closeModal.id}/stp-close`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: true }),
    });
    setCloseSaving(false);
    setCloseModal(null);
    setSelectedNJ(null);
    loadNJs();
  };

  const handleWIPConfirm = async () => {
    if (!wipModal) return;
    setWipSaving(true);
    await fetch(`/api/nj/${wipModal.nj.id}/stp-wip`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark: wipModal.marking, note: wipNote }),
    });
    setWipSaving(false);
    setWipModal(null);
    setWipNote("");
    loadNJs();
  };

  if (njs === null) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading STP Tracker...
      </div>
    );
  }

  // Filter to STP-relevant NJs: active and working days ≤ 18, OR has unacknowledged PA/PIP/EXIT
  const withWds = njs
    .filter((nj) => nj.isActive)
    .map((nj) => {
      const wds = workingDaysSince(nj.joinDate);
      const status = getSTPStatus(nj, wds, alerts);
      return { ...nj, wds, status };
    });

  const stpNJs = withWds.filter((nj) => !nj.stpClosed);

  const filtered = stpNJs.filter((nj) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      nj.name.toLowerCase().includes(q) ||
      (nj.empId ?? "").toLowerCase().includes(q) ||
      nj.managerId.toLowerCase().includes(q)
    );
  });

  // Completed NJs (stpClosed, active)
  const completedNJs = withWds.filter((nj) => nj.stpClosed);

  // KPI counts
  const phase1Count = stpNJs.filter((n) => n.status === "Phase 1 — Training").length;
  const phase2Count = stpNJs.filter((n) => n.status === "Phase 2 — Extended").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-400 to-purple-600 flex items-center justify-center shadow-md">
          <Activity size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">STP Tracker</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Active NJs in Sales Training Programme · {stpNJs.length} tracked
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <KPICard label="Phase 1 — Training" value={phase1Count} color="blue"  />
        <KPICard label="Phase 2 — Extended" value={phase2Count} color="amber" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, Emp ID, manager…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {/* Board — STP WIP */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No NJs currently in STP window
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((nj) => (
            <NJCard
              key={nj.id}
              nj={nj}
              isAdmin={isAdmin}
              onSelect={() => setSelectedNJ(selectedNJ?.id === nj.id ? null : nj)}
              selected={selectedNJ?.id === nj.id}
              onWIPClick={(marking) => { setWipModal({ nj, marking }); setWipNote(""); }}
              onCloseSTP={() => setCloseModal(nj)}
              onProgressToggle={(field, done) => handleProgressToggle(nj, field, done)}
            />
          ))}
        </div>
      )}

      {/* STP Completed list */}
      {completedNJs.length > 0 && (
        <CompletedSection
          njs={completedNJs}
          selectedNJ={selectedNJ}
          onSelect={(nj) => setSelectedNJ(selectedNJ?.id === nj.id ? null : nj)}
        />
      )}

      {/* Side drawer */}
      {selectedNJ && (
        <STPDrawer nj={selectedNJ} onClose={() => setSelectedNJ(null)} />
      )}

      {/* Mark STP Closed modal */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 text-base mb-1">Mark STP Closed</h2>
            <p className="text-sm text-gray-500 mb-2">
              You are closing STP for <span className="font-semibold text-gray-800">{closeModal.name}</span>.
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Once closed, this NJ will be removed from the STP Tracker and Overview will reflect their Developed / Not Developed status.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCloseModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseConfirm}
                disabled={closeSaving}
                className={clsx(
                  "px-4 py-2 text-sm rounded-lg text-white font-medium bg-rose-600 hover:bg-rose-700 transition-colors",
                  closeSaving && "opacity-60 cursor-not-allowed"
                )}
              >
                {closeSaving ? "Closing…" : "Close STP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as STP WIP modal */}
      {wipModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 text-base mb-1">
              {wipModal.marking ? "Mark as STP WIP" : "Unmark STP WIP"}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {wipModal.marking
                ? `This will flag ${wipModal.nj.name} as STP WIP. Add an optional note.`
                : `This will remove the STP WIP flag from ${wipModal.nj.name}.`}
            </p>
            {wipModal.marking && (
              <textarea
                value={wipNote}
                onChange={(e) => setWipNote(e.target.value)}
                placeholder="Add a note (optional)…"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setWipModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWIPConfirm}
                disabled={wipSaving}
                className={clsx(
                  "px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors",
                  wipModal.marking
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-500 hover:bg-gray-600",
                  wipSaving && "opacity-60 cursor-not-allowed"
                )}
              >
                {wipSaving ? "Saving…" : wipModal.marking ? "Confirm" : "Unmark"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

const KPI_COLOR: Record<string, string> = {
  blue:   "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
  amber:  "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
  orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-700",
  red:    "from-red-50 to-red-100 border-red-200 text-red-700",
};

function KPICard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={clsx("rounded-xl border p-4 bg-gradient-to-br", KPI_COLOR[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}

// ── STP Completed Section ──────────────────────────────────────────────────────

function CompletedSection({
  njs,
  selectedNJ,
  onSelect,
}: {
  njs: (NJ & { wds: number; status: STPStatus })[];
  selectedNJ: (NJ & { wds: number; status: STPStatus }) | null;
  onSelect: (nj: NJ & { wds: number; status: STPStatus }) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">STP Completed</span>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            {njs.length}
          </span>
        </div>
        <ChevronRight size={15} className={clsx("text-gray-400 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {njs.map((nj) => (
            <button
              key={nj.id}
              onClick={() => onSelect(nj)}
              className={clsx(
                "w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors",
                selectedNJ?.id === nj.id && "bg-purple-50"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials(nj.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{nj.name}</div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                  <span>{nj.empId ?? "—"}</span>
                  <span>·</span>
                  <span>{fmtDate(nj.joinDate)}</span>
                  <span>·</span>
                  <span>{nj.managerId}</span>
                </div>
              </div>
              <span className={clsx(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                nj.hasPositiveNR ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"
              )}>
                {nj.hasPositiveNR ? "Developed" : "Not Developed"}
              </span>
              <ChevronRight size={13} className={clsx("text-gray-300 flex-shrink-0 transition-transform", selectedNJ?.id === nj.id && "rotate-90")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NJ Card ────────────────────────────────────────────────────────────────────

function NJCard({
  nj,
  onSelect,
  selected,
  isAdmin,
  onWIPClick,
  onCloseSTP,
  onProgressToggle,
}: {
  nj: NJ & { wds: number; status: STPStatus };
  onSelect: () => void;
  selected: boolean;
  isAdmin: boolean;
  onWIPClick: (marking: boolean) => void;
  onCloseSTP: () => void;
  onProgressToggle: (field: "managerHuddle" | "stpMetrics", done: boolean) => void;
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      className={clsx(
        "text-left w-full rounded-xl border p-4 transition-all duration-200 hover:shadow-md cursor-pointer",
        selected
          ? "border-purple-400 bg-purple-50 shadow-md"
          : "border-gray-200 bg-white hover:border-purple-200"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials(nj.name)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm leading-tight">{nj.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{nj.empId ?? "—"}</div>
          </div>
        </div>
        <span
          className={clsx(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
            STATUS_STYLE[nj.status]
          )}
        >
          <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle", STATUS_DOT[nj.status])} />
          {nj.status}
        </span>
      </div>

      {/* Meta row */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-gray-400" />
          <span>Day <span className="font-semibold text-gray-700">{nj.wds}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <CalendarDays size={11} className="text-gray-400" />
          <span>{fmtDate(nj.joinDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          <User size={11} className="text-gray-400" />
          <span className="truncate">{nj.managerId}</span>
        </div>
      </div>

      {/* Phase bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>STP Day {nj.wds} of 18</span>
          <span>{nj.currentPhase}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              nj.wds <= 14 ? "bg-blue-400" : "bg-amber-400"
            )}
            style={{ width: `${Math.min((nj.wds / 18) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* STP Progress checklist */}
      <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">STP Progress</p>
        {(
          [
            { field: "managerHuddle" as const, label: "Manager Huddle", done: !!nj.managerHuddleDone },
            { field: "stpMetrics"    as const, label: "STP Metrics",    done: !!nj.stpMetricsDone    },
          ] as const
        ).map(({ field, label, done }) => (
          <button
            key={field}
            onClick={(e) => { e.stopPropagation(); if (isAdmin) onProgressToggle(field, !done); }}
            disabled={!isAdmin}
            className={clsx(
              "w-full flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border transition-colors text-left",
              done
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-500",
              isAdmin && "hover:opacity-80 cursor-pointer",
              !isAdmin && "cursor-default"
            )}
          >
            <span className={clsx(
              "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border text-[10px] font-bold",
              done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-gray-300 text-transparent"
            )}>✓</span>
            <span className={clsx("font-medium", done && "line-through opacity-70")}>{label}</span>
            {done && <span className="ml-auto text-[9px] opacity-60">Done</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2">
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onWIPClick(!nj.stpWipMarked); }}
              className={clsx(
                "flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors",
                nj.stpWipMarked
                  ? "border-gray-300 text-gray-500 hover:bg-gray-50"
                  : "border-purple-300 text-purple-600 hover:bg-purple-50"
              )}
            >
              {nj.stpWipMarked ? <FlagOff size={11} /> : <Flag size={11} />}
              {nj.stpWipMarked ? "Unmark WIP" : "Mark WIP"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCloseSTP(); }}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 transition-colors"
            >
              Close STP
            </button>
          </div>
        )}
        <ChevronRight size={14} className={clsx("transition-transform ml-auto", selected && "rotate-90")} />
      </div>
    </div>
  );
}

// ── Side Drawer ────────────────────────────────────────────────────────────────

function STPDrawer({
  nj,
  onClose,
}: {
  nj: NJ & { wds: number; status: STPStatus };
  onClose: () => void;
}) {
  const [expanded,      setExpanded]      = useState(false);
  const [emailModal,    setEmailModal]    = useState(false);
  const [recipients,    setRecipients]    = useState<string[]>([]);
  const [inputVal,      setInputVal]      = useState("");
  const [sending,       setSending]       = useState(false);
  const [sent,          setSent]          = useState<string[] | null>(null);
  const [sendError,     setSendError]     = useState<string | null>(null);

  // Huddle auto-schedule state
  const [huddleModal,   setHuddleModal]   = useState(false);
  const [huddleTime,    setHuddleTime]    = useState("09:00");
  const [huddleSaving,  setHuddleSaving]  = useState(false);
  const [huddleError,   setHuddleError]   = useState<string | null>(null);
  const [huddleDone,    setHuddleDone]    = useState<{ joinUrl: string | null; startDate: string; endDate: string } | null>(null);

  // Meeting state
  const [meetingModal,       setMeetingModal]       = useState(false);
  const [meetings,           setMeetings]           = useState<MeetingLog[] | null>(null);
  const [meetingType,        setMeetingType]        = useState("AdHoc");
  const [meetingDate,        setMeetingDate]        = useState("");
  const [meetingTime,        setMeetingTime]        = useState("15:00");
  const [meetingDur,         setMeetingDur]         = useState(30);
  const [meetingRecurring,   setMeetingRecurring]   = useState<"none" | "daily" | "weekly">("none");
  const [meetingOccurrences, setMeetingOccurrences] = useState(10);
  const [meetingExtra,       setMeetingExtra]       = useState("");
  const [meetingSaving,      setMeetingSaving]      = useState(false);
  const [meetingError,       setMeetingError]       = useState<string | null>(null);
  const [meetingDone,        setMeetingDone]        = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/nj/${nj.id}/schedule-meeting`)
      .then(r => r.json())
      .then(d => setMeetings(Array.isArray(d) ? d : []))
      .catch(() => setMeetings([]));
  }, [nj.id]);

  const handleScheduleMeeting = async () => {
    if (!meetingDate || !meetingTime) return;
    setMeetingSaving(true); setMeetingError(null); setMeetingDone(null);
    const scheduledAt = `${meetingDate}T${meetingTime}:00`;

    let rrule: string | undefined;
    if (meetingRecurring === "daily") {
      rrule = `FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=${meetingOccurrences}`;
    } else if (meetingRecurring === "weekly") {
      rrule = `FREQ=WEEKLY;COUNT=${meetingOccurrences}`;
    }

    const extraAttendees = meetingExtra
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes("@"));

    const res = await fetch(`/api/nj/${nj.id}/schedule-meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingType, scheduledAt, durationMins: meetingDur, extraAttendees, rrule }),
    });
    const data = await res.json();
    setMeetingSaving(false);
    if (res.ok) {
      setMeetingDone(data.joinUrl ?? "Scheduled");
      setMeetings(prev => prev ? [data.meeting, ...prev] : [data.meeting]);
    } else {
      setMeetingError(data.error ?? "Failed to schedule");
    }
  };

  const handleScheduleHuddles = async () => {
    setHuddleSaving(true); setHuddleError(null); setHuddleDone(null);
    const res = await fetch(`/api/nj/${nj.id}/schedule-huddles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: huddleTime }),
    });
    const data = await res.json();
    setHuddleSaving(false);
    if (res.ok) {
      setHuddleDone({ joinUrl: data.joinUrl, startDate: data.startDate, endDate: data.endDate });
      setMeetings(prev => prev ? [data.meeting, ...prev] : [data.meeting]);
    } else {
      setHuddleError(data.error ?? "Failed to schedule huddles");
    }
  };

  const addRecipient = (raw: string) => {
    const emails = raw.split(/[\s,;]+/).map(e => e.trim()).filter(e => e.includes("@"));
    if (emails.length) setRecipients(prev => [...new Set([...prev, ...emails])]);
    setInputVal("");
  };

  const handleSend = async () => {
    const all = [...recipients, ...(inputVal.includes("@") ? [inputVal.trim()] : [])];
    if (all.length === 0) return;
    setSending(true); setSendError(null); setSent(null);
    const res = await fetch(`/api/nj/${nj.id}/email-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: all }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) { setSent(data.to); }
    else { setSendError(data.error ?? "Failed to send"); }
  };

  return (
    <>
    <div className={clsx(
      "fixed inset-y-0 right-0 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col transition-all duration-300",
      expanded ? "w-[780px]" : "w-[440px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials(nj.name)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{nj.name}</div>
            <div className="text-xs text-gray-400">{nj.empId}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setEmailModal(true); setSent(null); setSendError(null); setRecipients([]); setInputVal(""); }}
            title="Send email report"
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            <Mail size={13} /> Email Report
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse" : "Expand"}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => { setHuddleModal(true); setHuddleDone(null); setHuddleError(null); }}
            title="Auto-schedule daily huddles Day 2–14"
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition-colors"
          >
            <Repeat2 size={13} /> Huddles
          </button>
          <button
            onClick={() => { setMeetingModal(true); setMeetingDone(null); setMeetingError(null); }}
            title="Schedule meeting"
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <Video size={13} /> Schedule
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={clsx(
        "flex-1 overflow-y-auto p-5",
        expanded ? "grid grid-cols-2 gap-5 items-start" : "space-y-4"
      )}>
        {/* Left column (or single column): NJ details + phase bar */}
        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx("text-xs font-semibold px-3 py-1 rounded-full border", STATUS_STYLE[nj.status])}>
              {nj.status}
            </span>
            {nj.stpWipMarked && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full border border-purple-300 bg-purple-50 text-purple-700 flex items-center gap-1">
                <Flag size={10} /> WIP Flagged
              </span>
            )}
          </div>
          {nj.stpWipMarked && nj.stpWipNote && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 italic">
              "{nj.stpWipNote}"
            </div>
          )}
          {nj.stpWipMarked && nj.stpWipMarkedBy && (
            <div className="text-[10px] text-gray-400">
              Marked by {nj.stpWipMarkedBy} · {nj.stpWipMarkedAt ? new Date(nj.stpWipMarkedAt).toLocaleDateString("en-IN") : ""}
            </div>
          )}

          {/* NJ Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2.5">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Details</p>
            <DetailRow label="Join Date"   value={fmtDate(nj.joinDate)} />
            <DetailRow label="Tenure"      value={fmtTenure(nj.joinDate)} />
            <DetailRow label="Phase"       value={nj.currentPhase} />
            <DetailRow label="Manager"     value={nj.managerId} />
            <DetailRow label="Location"    value={nj.location ?? "—"} />
            <DetailRow label="Designation" value={nj.designation ?? "—"} />
            <DetailRow label="Email"       value={nj.email ?? "—"} />
            <DetailRow label="NR Status"   value={nj.hasPositiveNR ? "✅ Positive" : "❌ Negative"} />
            {nj.stpExtendedDays > 0 && (
              <DetailRow label="Extended Days" value={`${nj.stpExtendedDays} days`} />
            )}
          </div>

          {/* STP Phase Progress */}
          <STPPhaseBar
            joinDate={nj.joinDate}
            stpExtendedDays={nj.stpExtendedDays}
            stpClosed={nj.stpClosed}
          />
        </div>

        {/* Right column (expanded) or continued single column: task tracker + assessment + meetings */}
        <div className="space-y-4">
          <DayWiseTaskTracker njId={nj.id} joinDate={nj.joinDate} />
          <AssessmentChecklist njId={nj.id} njName={nj.name} />

          {/* Meeting History */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video size={14} className="text-emerald-500" />
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Meetings</p>
                {meetings && meetings.length > 0 && (
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{meetings.length}</span>
                )}
              </div>
            </div>
            {meetings === null ? (
              <div className="p-4 space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="animate-pulse h-8 bg-gray-100 rounded-lg" />)}
              </div>
            ) : meetings.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">No meetings scheduled yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {meetings.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={clsx(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      m.status === "Scheduled"  && "bg-blue-400",
                      m.status === "Completed"  && "bg-emerald-400",
                      m.status === "Cancelled"  && "bg-gray-300",
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{m.subject}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(m.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}{m.durationMins} min · {m.status}
                      </div>
                    </div>
                    {m.teamsJoinUrl && (
                      <a href={m.teamsJoinUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline flex-shrink-0"
                      >
                        <ExternalLink size={10} /> Join
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Auto-Schedule Daily Huddles Modal */}
    {huddleModal && (() => {
      // Compute Day 2 and Day 14 dates for display
      function getNthWD(joinDate: string, n: number): string {
        const [y, mo, da] = joinDate.split("-").map(Number);
        const d = new Date(y, mo - 1, da);
        let count = 0;
        while (count < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) count++; }
        return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      }
      const day2 = getNthWD(nj.joinDate, 1);
      const day14 = getNthWD(nj.joinDate, 13);
      return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Repeat2 size={18} className="text-cyan-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Auto-Schedule Daily Huddles</div>
                  <div className="text-xs text-gray-400 mt-0.5">{nj.name}</div>
                </div>
              </div>
              <button onClick={() => setHuddleModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            {huddleDone ? (
              <div className="text-center py-10 px-6">
                <div className="w-16 h-16 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-4">
                  <Repeat2 size={28} className="text-cyan-600" />
                </div>
                <p className="text-base font-bold text-gray-800">13 Daily Huddles Scheduled!</p>
                <p className="text-sm text-gray-400 mt-1">{huddleDone.startDate} → {huddleDone.endDate}</p>
                {huddleDone.joinUrl && (
                  <a href={huddleDone.joinUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg font-semibold"
                  >
                    <ExternalLink size={13} /> Join Teams Meeting
                  </a>
                )}
                <button onClick={() => { setHuddleModal(false); setHuddleDone(null); }}
                  className="mt-4 block mx-auto text-xs text-gray-400 hover:underline"
                >Close</button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Info box */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700">
                    <Repeat2 size={13} /> 13 sessions · Mon–Fri · 15 minutes each
                  </div>
                  <div className="text-xs text-cyan-600">
                    <span className="font-semibold">Day 2</span> ({day2}) → <span className="font-semibold">Day 14</span> ({day14})
                  </div>
                  <div className="text-xs text-cyan-600">
                    Recipients: <span className="font-semibold">{nj.name}</span> + Samridhi Chugh
                  </div>
                </div>

                {/* Time picker */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Daily Meeting Time (IST)</label>
                  <input
                    type="time"
                    value={huddleTime}
                    onChange={e => setHuddleTime(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-300 bg-gray-50 text-center font-semibold text-lg"
                  />
                </div>

                {huddleError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{huddleError}</p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setHuddleModal(false)}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                  >Cancel</button>
                  <button
                    onClick={handleScheduleHuddles}
                    disabled={huddleSaving}
                    className={clsx(
                      "flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl text-white transition-colors",
                      huddleSaving ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-600 hover:bg-cyan-700"
                    )}
                  >
                    <Repeat2 size={15} />
                    {huddleSaving ? "Scheduling 13 huddles…" : "Schedule All Huddles"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })()}

    {/* Schedule Meeting Modal */}
    {meetingModal && (
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Video size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">Schedule Teams Meeting</div>
                <div className="text-xs text-gray-400 mt-0.5">for {nj.name} · invite will be sent via email</div>
              </div>
            </div>
            <button onClick={() => setMeetingModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
          </div>

          {meetingDone ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Video size={28} className="text-emerald-600" />
              </div>
              <p className="text-base font-bold text-gray-800">Meeting Scheduled!</p>
              <p className="text-sm text-gray-400 mt-1">Calendar invite sent to all attendees.</p>
              {meetingDone !== "Scheduled" && (
                <a href={meetingDone} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  <ExternalLink size={13} /> Join Teams Meeting
                </a>
              )}
              <button onClick={() => { setMeetingModal(false); setMeetingDone(null); setMeetingRecurring("none"); setMeetingExtra(""); }}
                className="mt-4 block mx-auto text-xs text-gray-400 hover:underline"
              >Close</button>
            </div>
          ) : (
            <div className="p-6 space-y-5">

              {/* Meeting Type */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Meeting Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "DailyHuddle",  label: "Daily Huddle",                   icon: "🤝" },
                    { value: "Phase1Review", label: "STP Evaluation - Manager Huddle", icon: "🏁" },
                    { value: "Month1Review", label: "Month 1 Review Meeting",          icon: "📅" },
                    { value: "AdHoc",        label: "Ad-hoc Meeting",                  icon: "💬" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMeetingType(opt.value)}
                      className={clsx(
                        "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all",
                        meetingType === opt.value
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date / Time / Duration */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Date</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={e => setMeetingDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Time (IST)</label>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={e => setMeetingTime(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Duration</label>
                  <select
                    value={meetingDur}
                    onChange={e => setMeetingDur(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-gray-50"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                  </select>
                </div>
              </div>

              {/* Recurring */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Recurrence</label>
                <div className="flex gap-2">
                  {([
                    { value: "none",   label: "One-time" },
                    { value: "daily",  label: "Daily (Mon–Fri)" },
                    { value: "weekly", label: "Weekly" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMeetingRecurring(opt.value)}
                      className={clsx(
                        "px-3 py-2 text-xs font-semibold rounded-lg border transition-all",
                        meetingRecurring === opt.value
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {meetingRecurring !== "none" && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-gray-400">×</span>
                      <input
                        type="number"
                        min={2}
                        max={60}
                        value={meetingOccurrences}
                        onChange={e => setMeetingOccurrences(Number(e.target.value))}
                        className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                      <span className="text-xs text-gray-400">occurrences</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra recipients */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  Additional Recipients <span className="font-normal text-gray-400 normal-case">(NJ + your calendar are added automatically)</span>
                </label>
                <input
                  type="text"
                  value={meetingExtra}
                  onChange={e => setMeetingExtra(e.target.value)}
                  placeholder="e.g. manager@company.com, hr@company.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-gray-50"
                />
                <p className="text-[10px] text-gray-400 mt-1">Separate multiple emails with commas or spaces</p>
              </div>

              {meetingError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{meetingError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setMeetingModal(false); setMeetingRecurring("none"); setMeetingExtra(""); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleMeeting}
                  disabled={meetingSaving || !meetingDate}
                  className={clsx(
                    "flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl text-white transition-colors",
                    meetingSaving || !meetingDate ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  <Video size={15} />
                  {meetingSaving ? "Scheduling…" : "Schedule Teams Meeting"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Email Report Modal */}
    {emailModal && (
      <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Mail size={15} className="text-indigo-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">Send Email Report</div>
                <div className="text-[11px] text-gray-400">{nj.name}</div>
              </div>
            </div>
            <button onClick={() => setEmailModal(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Send size={20} className="text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Report sent!</p>
              <div className="mt-2 space-y-1">
                {sent.map(e => (
                  <p key={e} className="text-xs text-gray-400">{e}</p>
                ))}
              </div>
              <button
                onClick={() => { setSent(null); setRecipients([]); setInputVal(""); }}
                className="mt-4 text-xs text-indigo-600 hover:underline"
              >
                Send again
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Includes: NJ details, STP phase progress, day-wise task tracker, assessment checklist, and manager huddle status.
              </p>

              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Recipients
              </label>

              {/* Tag pills */}
              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {recipients.map(email => (
                    <span key={email} className="flex items-center gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {email}
                      <button onClick={() => setRecipients(r => r.filter(e => e !== email))} className="hover:text-red-500 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="email"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === "Enter" || e.key === "," || e.key === " ") && inputVal.trim()) {
                    e.preventDefault();
                    addRecipient(inputVal);
                  }
                }}
                onBlur={() => { if (inputVal.trim()) addRecipient(inputVal); }}
                placeholder="Type email and press Enter to add…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="text-[10px] text-gray-400 mb-3">Press Enter, comma, or space to add each address.</p>

              {sendError && (
                <p className="text-xs text-red-500 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEmailModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || (recipients.length === 0 && !inputVal.includes("@"))}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-white transition-colors",
                    sending || (recipients.length === 0 && !inputVal.includes("@"))
                      ? "bg-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  <Send size={12} />
                  {sending ? "Sending…" : `Send${recipients.length > 1 ? ` (${recipients.length})` : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium text-right max-w-[55%] break-words">{value}</span>
    </div>
  );
}

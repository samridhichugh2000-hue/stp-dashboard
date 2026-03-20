"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface MasterclassItem {
  id: number;
  masterClass: string;
  conductedBy: string;
  date: string;
  dates: string;
  duration: string;
  trainingType: string;
  audience: string[];
  meetingLink: string;
  recordingLink: string;
  completed: boolean;
}

function formatDateTime(dates: string): { date: string; time: string } {
  const d = new Date(dates);
  if (isNaN(d.getTime())) return { date: "—", time: "—" };
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function daysUntil(dates: string): number {
  const d = new Date(dates);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function AudienceCell({ emails }: { emails: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 2;
  const shown = expanded ? emails : emails.slice(0, LIMIT);
  return (
    <div className="space-y-0.5">
      {shown.map((e, i) => (
        <div key={i} className="text-[11px] text-gray-500 truncate max-w-[200px]" title={e}>
          {e}
        </div>
      ))}
      {emails.length > LIMIT && (
        <button
          onClick={(ev) => { ev.stopPropagation(); setExpanded(!expanded); }}
          className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium"
        >
          {expanded ? "Show less" : `+${emails.length - LIMIT} more`}
        </button>
      )}
    </div>
  );
}

function StatusCell({ item }: { item: MasterclassItem }) {
  const days = daysUntil(item.dates);

  if (item.completed) {
    if (item.recordingLink) {
      return (
        <a
          href={item.recordingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-100 transition-colors whitespace-nowrap"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Recording
        </a>
      );
    }
    return (
      <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded-lg ring-1 bg-gray-100 text-gray-500 ring-gray-200 whitespace-nowrap">
        Completed
      </span>
    );
  }

  const urgency =
    days === 0
      ? { label: "Today", cls: "bg-red-100 text-red-700 ring-red-200" }
      : days === 1
      ? { label: "Tomorrow", cls: "bg-orange-100 text-orange-700 ring-orange-200" }
      : days <= 7
      ? { label: `In ${days}d`, cls: "bg-amber-100 text-amber-700 ring-amber-200" }
      : { label: `In ${days}d`, cls: "bg-indigo-50 text-indigo-600 ring-indigo-100" };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg ring-1 whitespace-nowrap ${urgency.cls}`}>
      {days === 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
      {urgency.label}
    </span>
  );
}

const AVATAR_COLORS = [
  "from-indigo-400 to-violet-500",
  "from-pink-400 to-rose-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-500",
];

export default function MasterclassPage() {
  const { status: authStatus } = useSession();
  const [items, setItems] = useState<MasterclassItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    fetch("/api/masterclass")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else setError(data.error ?? "Failed to load masterclasses");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus]);

  const upcoming = (items ?? []).filter((i) => !i.completed);
  const past = (items ?? []).filter((i) => i.completed).reverse(); // most recent first

  function renderTable(rows: MasterclassItem[], globalOffset = 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-100 bg-gray-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 w-8">#</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Masterclass</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Conducted By</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Date</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Time</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Duration</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Training Type</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Audience</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400">Status</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400">Meeting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-sm text-gray-400">
                  No sessions found
                </td>
              </tr>
            )}
            {rows.map((item, i) => {
              const { date, time } = formatDateTime(item.dates);
              const avatarColor = AVATAR_COLORS[(globalOffset + i) % AVATAR_COLORS.length];
              const initials = item.conductedBy
                .split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

              return (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.completed ? "opacity-75" : ""}`}>
                  <td className="py-3 px-4 text-xs text-gray-300">{globalOffset + i + 1}</td>

                  <td className="py-3 px-4 max-w-[220px]">
                    <p className="text-xs font-semibold text-gray-800 leading-snug">{item.masterClass}</p>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {initials}
                      </div>
                      <span className="text-xs text-gray-700 font-medium">{item.conductedBy}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs text-gray-700">{date}</span>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs text-gray-500">{time}</span>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs text-gray-700">
                      {item.duration ? `${item.duration} hr${parseFloat(item.duration) !== 1 ? "s" : ""}` : "—"}
                    </span>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100 font-medium">
                      {item.trainingType}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <AudienceCell emails={item.audience} />
                  </td>

                  <td className="py-3 px-4 text-center">
                    <StatusCell item={item} />
                  </td>

                  <td className="py-3 px-4 text-center">
                    {!item.completed && item.meetingLink ? (
                      <a
                        href={item.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-100 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Join
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const totalCount = items?.length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Masterclasses</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          CSM · Kites audience · Live from Koenig API ·{" "}
          {items === null ? "Loading…" : `${upcoming.length} upcoming, ${past.length} completed (last 2 weeks)`}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Skeleton */}
      {loading && !items && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="animate-pulse h-4 w-32 bg-gray-100 rounded-full" />
          </div>
          <table className="w-full">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} className="py-3 px-4">
                      <div className="animate-pulse h-3.5 bg-gray-100 rounded-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upcoming */}
      {items && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-700">Upcoming Sessions</h2>
            <span className="ml-auto text-xs text-gray-400">{upcoming.length} session{upcoming.length !== 1 ? "s" : ""}</span>
          </div>
          {renderTable(upcoming, 0)}
        </div>
      )}

      {/* Past — last 2 weeks */}
      {items && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Last 2 Weeks</h2>
            <span className="ml-auto text-xs text-gray-400">{past.length} session{past.length !== 1 ? "s" : ""}</span>
          </div>
          {renderTable(past, totalCount - past.length)}
        </div>
      )}
    </div>
  );
}

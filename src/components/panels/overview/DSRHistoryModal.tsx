"use client";

import { useEffect, useState } from "react";
import { X, Mail } from "lucide-react";

interface DSRHistoryModalProps {
  njId: number;
  njName: string;
  joinDate: string;
  onClose: () => void;
}

function getWorkingDays(from: string): string[] {
  // Parse as local date (avoid UTC-to-local offset shifting the day)
  const [y, m, day] = from.split("-").map(Number);
  const start = new Date(y, m - 1, day);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: string[] = [];
  const d = new Date(start);
  d.setDate(d.getDate() + 1); // exclude join date (day 1)

  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, "0");
      const dd   = String(d.getDate()).padStart(2, "0");
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    d.setDate(d.getDate() + 1);
  }

  return days.reverse(); // newest first
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function DSRHistoryModal({ njId, njName, joinDate, onClose }: DSRHistoryModalProps) {
  const [submittedDates, setSubmittedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const _now  = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
  const workingDays = getWorkingDays(joinDate);

  useEffect(() => {
    fetch(`/api/outlook/dsr?njId=${njId}`)
      .then(r => r.json())
      .then((data: { date: string }[]) => {
        setSubmittedDates(new Set(data.map(d => d.date)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [njId]);

  const submittedCount = workingDays.filter(d => submittedDates.has(d)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Mail size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">DSR History — {njName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? "Loading…" : `${submittedCount} of ${workingDays.length} working days submitted`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        {!loading && workingDays.length > 0 && (
          <div className="px-5 pt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                style={{ width: `${Math.round(submittedCount / workingDays.length * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1 text-right">
              {Math.round(submittedCount / workingDays.length * 100)}% compliance
            </p>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading && (
            <div className="space-y-2 py-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse h-9 bg-gray-100 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && workingDays.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No working days yet</p>
          )}

          {!loading && workingDays.map(date => {
            const isToday   = date === today;
            const submitted = submittedDates.has(date);

            return (
              <div
                key={date}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                  isToday ? "bg-indigo-50 ring-1 ring-indigo-200" : "bg-gray-50"
                }`}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                  submitted
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-gray-300 bg-white"
                }`}>
                  {submitted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Date */}
                <span className={`text-xs flex-1 ${
                  isToday ? "font-semibold text-indigo-700" : submitted ? "text-gray-500" : "text-gray-700 font-medium"
                }`}>
                  {fmtDate(date)}
                  {isToday && <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">Today</span>}
                </span>

                {/* Status */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  submitted
                    ? "bg-emerald-100 text-emerald-700"
                    : isToday
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-600"
                }`}>
                  {submitted ? "Submitted" : isToday ? "Pending" : "Missed"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

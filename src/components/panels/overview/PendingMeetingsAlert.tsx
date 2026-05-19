"use client";

import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";

interface PendingMeeting {
  njId:        number;
  meetingType: string;
  subject:     string;
  scheduledAt: string;
  njName:      string;
  njEmpId:     string | null;
}

const MEETING_STYLE: Record<string, { border: string; bg: string; badge: string }> = {
  Phase1Review: { border: "border-indigo-200", bg: "bg-indigo-50/60", badge: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  Month1Review: { border: "border-blue-200",   bg: "bg-blue-50/60",   badge: "bg-blue-100 text-blue-700 border-blue-200"       },
  PA:           { border: "border-amber-200",  bg: "bg-amber-50/60",  badge: "bg-amber-100 text-amber-700 border-amber-200"    },
  PIP:          { border: "border-orange-200", bg: "bg-orange-50/60", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  EXIT:         { border: "border-red-200",    bg: "bg-red-50/60",    badge: "bg-red-100 text-red-700 border-red-200"          },
};

const MEETING_LABEL: Record<string, string> = {
  Phase1Review: "Manager Huddle",
  Month1Review: "Month 1 Review",
  PA:           "PA Review",
  PIP:          "PIP Review",
  EXIT:         "Exit Review",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PendingMeetingsAlert() {
  const [meetings, setMeetings] = useState<PendingMeeting[] | null>(null);

  useEffect(() => {
    fetch("/api/meetings/pending")
      .then(r => r.json())
      .then(data => setMeetings(Array.isArray(data) ? data : []))
      .catch(() => setMeetings([]));
  }, []);

  if (!meetings || meetings.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-sm flex-shrink-0">
          <CalendarClock size={14} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Meetings to Schedule</h2>
          <p className="text-[11px] text-gray-400">These milestone meetings are due — please schedule them manually</p>
        </div>
        <span className="ml-auto text-xs font-bold text-white bg-indigo-500 px-2.5 py-0.5 rounded-full">
          {meetings.length}
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {meetings.map((m, i) => {
          const s = MEETING_STYLE[m.meetingType] ?? MEETING_STYLE.Phase1Review;
          return (
            <div key={i} className={`flex items-center gap-4 px-5 py-3 ${s.bg}`}>
              <CalendarClock size={14} className="text-indigo-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{m.njName}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>
                    {MEETING_LABEL[m.meetingType] ?? m.meetingType}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {m.njEmpId ? `${m.njEmpId} · ` : ""}Due {fmtDate(m.scheduledAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

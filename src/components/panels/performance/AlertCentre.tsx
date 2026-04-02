"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Clock, Mail } from "lucide-react";
import { EmailComposer } from "@/components/shared/EmailComposer";

interface Alert {
  id:             number;
  njId:           number;
  alertType:      string;
  triggeredAt:    string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  njName:         string;
  njEmpId:        string;
}

const ALERT_STYLE: Record<string, { border: string; bg: string; badge: string; badgeText: string }> = {
  EXIT: { border: "border-red-200",    bg: "bg-red-50",    badge: "bg-red-100 text-red-700 border-red-300",    badgeText: "Exit Review"  },
  PIP:  { border: "border-orange-200", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700 border-orange-300", badgeText: "PIP"  },
  PA:   { border: "border-amber-200",  bg: "bg-amber-50",  badge: "bg-amber-100 text-amber-700 border-amber-300",   badgeText: "PA"   },
};

const ALERT_DESC: Record<string, string> = {
  PA:   "Performance Assessment due — schedule formal review",
  PIP:  "Performance Improvement Plan required — NR negative 4+ months",
  EXIT: "Exit Review required — NR and ROI negative 5+ months (Admin acknowledgement needed)",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AlertCentre() {
  const { data: session } = useSession();
  const canAck = ["admin", "manager"].includes(session?.user?.role ?? "");

  const [alerts,    setAlerts]    = useState<Alert[] | null>(null);
  const [saving,    setSaving]    = useState<number | null>(null);
  const [showAckd,  setShowAckd]  = useState(false);
  const [composing, setComposing] = useState<Alert | null>(null);

  const load = useCallback(() => {
    fetch("/api/performance-alerts")
      .then(r => r.json())
      .then(data => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => setAlerts([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAck = async (id: number) => {
    setSaving(id);
    await fetch(`/api/performance-alerts/${id}`, { method: "PATCH" });
    setSaving(null);
    load();
  };

  if (alerts === null) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  const pending = alerts.filter(a => !a.acknowledgedAt);
  const acknowledged = alerts.filter(a => a.acknowledgedAt);

  if (pending.length === 0 && acknowledged.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-sm text-emerald-600">
        <CheckCircle2 size={16} /> No pending alerts
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {composing && (
        <EmailComposer
          njId={composing.njId}
          njName={composing.njName}
          template={composing.alertType as "PA" | "PIP" | "EXIT"}
          defaultTo={[process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ""]}
          triggeredAt={composing.triggeredAt}
          onClose={() => setComposing(null)}
          onSent={() => setComposing(null)}
        />
      )}
      {/* Pending alerts */}
      {pending.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-600 py-2">
          <CheckCircle2 size={13} /> All caught up — no pending alerts
        </div>
      ) : (
        pending.map(alert => {
          const s = ALERT_STYLE[alert.alertType] ?? ALERT_STYLE.PA;
          return (
            <div key={alert.id} className={clsx("flex items-start justify-between gap-4 p-4 rounded-xl border", s.border, s.bg)}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={15} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{alert.njName}</span>
                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded border", s.badge)}>
                      {s.badgeText}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{ALERT_DESC[alert.alertType]}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {alert.njEmpId} · Triggered {fmtDate(alert.triggeredAt)}
                  </p>
                </div>
              </div>
              {canAck && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleAck(alert.id)}
                    disabled={saving === alert.id}
                    className={clsx(
                      "text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors",
                      saving === alert.id && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {saving === alert.id ? "Saving…" : "Acknowledge"}
                  </button>
                  <button
                    onClick={() => setComposing(alert)}
                    className="flex items-center justify-center gap-1 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <Mail size={11} /> Send Notice
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Toggle to show acknowledged */}
      {acknowledged.length > 0 && (
        <button
          onClick={() => setShowAckd(v => !v)}
          className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 font-semibold pt-1"
        >
          <Clock size={11} />
          {showAckd ? "Hide" : "Show"} {acknowledged.length} acknowledged alert{acknowledged.length !== 1 ? "s" : ""}
        </button>
      )}

      {showAckd && acknowledged.map(alert => (
        <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 opacity-60">
          <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">{alert.njName}</span>
              <span className="text-[10px] text-gray-400">{alert.alertType}</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Acknowledged by {alert.acknowledgedBy} · {fmtDate(alert.acknowledgedAt!)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

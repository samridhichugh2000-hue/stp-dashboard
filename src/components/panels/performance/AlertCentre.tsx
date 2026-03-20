"use client";
import { useState, useEffect } from "react";
import { AlertBadge } from "@/components/shared/AlertBadge";
import { format } from "date-fns";
import { clsx } from "clsx";
import type { PerformanceAlert, NJ } from "@/lib/types";

const ALERT_DESCRIPTIONS: Record<string,string> = {
  PA:"Performance Assessment due — schedule formal review",
  PIP:"Performance Improvement Plan required — NR negative last month",
  EXIT:"Exit Review required — NR and ROI both negative (Admin acknowledgement needed)",
};

export function AlertCentre() {
  const [alerts, setAlerts] = useState<PerformanceAlert[] | null>(null);
  const [njs, setNjs] = useState<NJ[] | null>(null);

  function loadAlerts() {
    fetch("/api/performance/alerts")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAlerts(data); });
  }

  useEffect(() => {
    loadAlerts();
    fetch("/api/nj")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNjs(data); });
  }, []);

  const njMap = Object.fromEntries(njs?.map((n: NJ) => [n.id, n.name]) ?? []);

  async function handleAcknowledge(alertId: number) {
    await fetch("/api/performance/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId }),
    });
    loadAlerts();
  }

  if(!alerts) return <div className="animate-pulse h-48 bg-gray-100 rounded-lg" />;

  if(alerts.length===0) return (
    <div className="flex items-center justify-center py-12 text-sm text-emerald-600 gap-2">
      <span className="text-xl">✓</span> No pending alerts
    </div>
  );

  return (
    <div className="space-y-3">
      {alerts.map((alert: PerformanceAlert) => (
        <div key={alert.id} className={clsx("flex items-start justify-between gap-4 p-4 rounded-xl border",alert.alertType==="EXIT"?"border-red-200 bg-red-50":alert.alertType==="PIP"?"border-amber-200 bg-amber-50":"border-gray-200 bg-white")}>
          <div className="flex items-start gap-3">
            <AlertBadge type={alert.alertType} size="md" />
            <div>
              <div className="text-sm font-medium text-gray-900">{njMap[alert.njId]??String(alert.njId)}</div>
              <div className="text-xs text-gray-500 mt-0.5">{ALERT_DESCRIPTIONS[alert.alertType]??alert.alertType}</div>
              <div className="text-xs text-gray-400 mt-1">Triggered {format(new Date(alert.triggeredAt),"dd MMM yyyy")}</div>
            </div>
          </div>
          <button
            onClick={() => handleAcknowledge(alert.id)}
            className="shrink-0 text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition-colors"
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}

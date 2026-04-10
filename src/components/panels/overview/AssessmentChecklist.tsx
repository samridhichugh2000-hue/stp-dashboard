"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { clsx } from "clsx";
import { ClipboardList, Plus, ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";

// ── checklist items ────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: "training_completed",       label: "STP Training Completed"                        },
  { id: "qubits_satisfactory",      label: "Qubits Completed"                              },
  { id: "dsr_regular",              label: "DSR Submitted Regularly"                        },
  { id: "huddle_attendance",        label: "Huddle Attendance Complete"                     },
  { id: "manager_huddle_done",      label: "Manager Huddle Completed"                       },
  { id: "tat_followup_guidance",    label: "TAT and Follow-up of Leads Guidance"            },
  { id: "lead_audit_guidance",      label: "Lead Audit Guidance"                            },
  { id: "lead_handling_guidance",   label: "Lead Handling and Self Generation Guidance"     },
  { id: "sc_policy_guidance",       label: "Tentative SC Policy Guidance"                   },
];

type ChecklistData = Record<string, boolean | string>;

// ── STP metrics rows ───────────────────────────────────────────────────────────

interface STPMetricRow {
  id: string;
  parameter: string;
  positiveCriteria: string;
  negativeCriteria: string;
}

const STP_METRICS_ROWS: STPMetricRow[] = [
  {
    id: "attendance",
    parameter: "Attendance & Engagement",
    positiveCriteria: "Attended all Meetings?",
    negativeCriteria: "Missed any meetings",
  },
  {
    id: "reporting",
    parameter: "Reporting Discipline",
    positiveCriteria: "Submitted DSRs Everyday",
    negativeCriteria: "Missed any DSRs",
  },
  {
    id: "lead_1",
    parameter: "Lead Handling",
    positiveCriteria: "Positive and independent",
    negativeCriteria: "Any miss or negligence identified",
  },
  {
    id: "lead_2",
    parameter: "Proactive and completes tasks on or before time",
    positiveCriteria: "Demonstrated ownership / initiative",
    negativeCriteria: "Passive or reactive behavior",
  },
  {
    id: "wfh",
    parameter: "WFH Capable",
    positiveCriteria: "No disturbances, Joins timely, Punctual, No internet issues",
    negativeCriteria: "Improvement required",
  },
];

// ── HR-specific metrics rows (Score inputs) ────────────────────────────────────

const STP_HR_METRICS_ROWS: STPMetricRow[] = [
  {
    id: "attendance",
    parameter: "Attendance & Engagement",
    positiveCriteria: "Attended all huddles",
    negativeCriteria: "Missed any huddles",
  },
  {
    id: "reporting",
    parameter: "Reporting Discipline",
    positiveCriteria: "Submitted DSRs on time",
    negativeCriteria: "Missed any DSRs",
  },
  {
    id: "audit",
    parameter: "Audit Quality",
    positiveCriteria: "Positive audit",
    negativeCriteria: "Negative audit",
  },
  {
    id: "proactive",
    parameter: "Proactive and completes STP on or before time",
    positiveCriteria: "Demonstrated ownership / initiative",
    negativeCriteria: "Passive or reactive behaviour",
  },
  {
    id: "wfh",
    parameter: "WFH Capable",
    positiveCriteria: "Includes - No disturbances, joins timely, Punctual, no internet issues encountered.",
    negativeCriteria: "Improvement required",
  },
];

const OUTCOME_STYLE: Record<string, string> = {
  Pass:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  Fail:     "bg-red-100 text-red-600 border-red-200",
  Pending:  "bg-amber-100 text-amber-700 border-amber-200",
  Deferred: "bg-gray-100 text-gray-500 border-gray-200",
};

interface AssessmentRecord {
  id: number;
  njId: number;
  filledBy: string;
  filledAt: string;
  managerNotes: string | null;
  hrNotes: string | null;
  outcome: string;
  checklistData: string | null;
}

// ── Score toggle (0 = neutral, 1 = good) ──────────────────────────────────────

function ScoreToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-semibold">
      <button
        type="button"
        onClick={() => onChange(value === "0" ? "" : "0")}
        className={clsx(
          "px-2.5 py-1 border-r border-gray-200 transition-colors",
          value === "0" ? "bg-gray-200 text-gray-600" : "bg-white text-gray-300 hover:bg-gray-50"
        )}
        title="Neutral"
      >0</button>
      <button
        type="button"
        onClick={() => onChange(value === "1" ? "" : "1")}
        className={clsx(
          "px-2.5 py-1 transition-colors",
          value === "1" ? "bg-emerald-100 text-emerald-700" : "bg-white text-gray-300 hover:bg-gray-50"
        )}
        title="Good"
      >1</button>
    </div>
  );
}

// ── Score display badge ────────────────────────────────────────────────────────

function ScoreBadge({ value }: { value: string }) {
  if (value === "1") return <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[11px]">1</span>;
  if (value === "0") return <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-bold text-[11px]">0</span>;
  return <span className="text-gray-300 text-[11px]">—</span>;
}

// ── component ──────────────────────────────────────────────────────────────────

interface Props { njId: number; njName: string; }

export function AssessmentChecklist({ njId, njName }: Props) {
  const { data: session } = useSession();
  const canEdit = ["admin", "manager"].includes(session?.user?.role ?? "");

  const [records,     setRecords]     = useState<AssessmentRecord[] | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [expanded,    setExpanded]    = useState<number | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Form state
  const [checklist,     setChecklist]     = useState<ChecklistData>({});
  const [managerNotes,  setManagerNotes]  = useState("");
  const [hrNotes,       setHrNotes]       = useState("");
  const [outcome,       setOutcome]       = useState<"Pass" | "Fail" | "Pending" | "Deferred">("Pending");

  // Expand modal for notes
  const [expandedField, setExpandedField] = useState<"manager" | "hr" | null>(null);
  const [expandedValue, setExpandedValue] = useState("");

  // STP Metrics section toggle + active tab
  const [showStpMetrics,  setShowStpMetrics]  = useState(false);
  const [stpMetricsView,  setStpMetricsView]  = useState<"manager" | "hr">("manager");

  const fetchRecords = useCallback(() => {
    fetch(`/api/assessment?njId=${njId}`)
      .then(r => r.json())
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [njId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const resetForm = () => {
    setChecklist({});
    setManagerNotes("");
    setHrNotes("");
    setOutcome("Pending");
    setShowForm(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    await fetch("/api/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ njId, managerNotes, hrNotes, outcome, checklistData: checklist }),
    });
    setSaving(false);
    resetForm();
    fetchRecords();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const checkedCount = CHECKLIST_ITEMS.filter(item => checklist[item.id]).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-indigo-500" />
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Assessment Checklist
          </p>
          {records && records.length > 0 && (
            <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
              {records.length}
            </span>
          )}
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus size={11} /> New Assessment
          </button>
        )}
      </div>

      {/* New assessment form */}
      {showForm && canEdit && (
        <div className="p-4 border-b border-gray-100 bg-indigo-50/30 space-y-4">
          <p className="text-xs font-semibold text-gray-700">
            Assessment for <span className="text-indigo-600">{njName}</span>
          </p>

          {/* Checklist items */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Checklist ({checkedCount}/{CHECKLIST_ITEMS.length})
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {CHECKLIST_ITEMS.map(item => (
                <label
                  key={item.id}
                  className={clsx(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs",
                    checklist[item.id]
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-gray-200 text-gray-600 hover:border-indigo-200"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!checklist[item.id]}
                    onChange={e => setChecklist(prev => ({ ...prev, [item.id]: e.target.checked }))}
                    className="accent-emerald-600 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className={clsx("font-medium", checklist[item.id] && "line-through opacity-70")}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Manager Notes
                </label>
                <button
                  type="button"
                  onClick={() => { setExpandedField("manager"); setExpandedValue(managerNotes); }}
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
                  title="Expand editor"
                >
                  <Maximize2 size={11} /> Expand
                </button>
              </div>
              <textarea
                value={managerNotes}
                onChange={e => setManagerNotes(e.target.value)}
                rows={4}
                placeholder="Add manager observations…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  HR Notes
                </label>
                <button
                  type="button"
                  onClick={() => { setExpandedField("hr"); setExpandedValue(hrNotes); }}
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
                  title="Expand editor"
                >
                  <Maximize2 size={11} /> Expand
                </button>
              </div>
              <textarea
                value={hrNotes}
                onChange={e => setHrNotes(e.target.value)}
                rows={4}
                placeholder="Add HR observations…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
              />
            </div>
          </div>

          {/* STP Metrics */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowStpMetrics(v => !v)}
              className="flex items-center gap-2 w-full text-left group"
            >
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">
                STP Metrics
              </p>
              {showStpMetrics ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
            </button>

            {showStpMetrics && (
              <div className="space-y-2">
                {/* By Manager / By HR tabs */}
                <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg w-fit">
                  {(["manager", "hr"] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStpMetricsView(tab)}
                      className={clsx(
                        "px-3 py-1 text-[11px] font-semibold rounded-md transition-colors",
                        stpMetricsView === tab
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      By {tab === "manager" ? "Manager" : "HR"}
                    </button>
                  ))}
                </div>

                {stpMetricsView === "manager" ? (
                  /* ── Manager table (A / B — 0 or 1) ── */
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 w-[22%]">Parameter</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-emerald-600 w-[30%]">Positive Criteria</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-emerald-600 w-[8%]">A</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-red-500 w-[30%]">Negative Criteria</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-red-500 w-[8%]">B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {STP_METRICS_ROWS.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-gray-700 align-middle">{row.parameter}</td>
                            <td className="px-3 py-2.5 text-gray-600 align-middle">{row.positiveCriteria}</td>
                            <td className="px-2 py-2.5 text-center align-middle">
                              <ScoreToggle
                                value={String(checklist["stp_mgr_" + row.id + "_a"] ?? "")}
                                onChange={v => setChecklist(prev => ({ ...prev, ["stp_mgr_" + row.id + "_a"]: v }))}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 align-middle">{row.negativeCriteria}</td>
                            <td className="px-2 py-2.5 text-center align-middle">
                              {row.negativeCriteria ? (
                                <ScoreToggle
                                  value={String(checklist["stp_mgr_" + row.id + "_b"] ?? "")}
                                  onChange={v => setChecklist(prev => ({ ...prev, ["stp_mgr_" + row.id + "_b"]: v }))}
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ── HR table (Score — 0 or 1) ── */
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 w-[22%]">Parameter</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-emerald-600 w-[28%]">Positive Criteria</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-emerald-600 w-[8%]">Score</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-red-500 w-[28%]">Negative Criteria</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-red-500 w-[8%]">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {STP_HR_METRICS_ROWS.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-gray-700 align-middle">{row.parameter}</td>
                            <td className="px-3 py-2.5 text-gray-600 align-middle">{row.positiveCriteria}</td>
                            <td className="px-2 py-2.5 text-center align-middle">
                              <ScoreToggle
                                value={String(checklist["stp_hr_" + row.id + "_a"] ?? "")}
                                onChange={v => setChecklist(prev => ({ ...prev, ["stp_hr_" + row.id + "_a"]: v }))}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 align-middle">{row.negativeCriteria}</td>
                            <td className="px-2 py-2.5 text-center align-middle">
                              {row.negativeCriteria ? (
                                <ScoreToggle
                                  value={String(checklist["stp_hr_" + row.id + "_b"] ?? "")}
                                  onChange={v => setChecklist(prev => ({ ...prev, ["stp_hr_" + row.id + "_b"]: v }))}
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Outcome */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Outcome
            </label>
            <div className="flex gap-2">
              {(["Pass", "Fail", "Pending", "Deferred"] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className={clsx(
                    "flex-1 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors",
                    outcome === o ? OUTCOME_STYLE[o] : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={resetForm}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={clsx(
                "flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors",
                saving && "opacity-60 cursor-not-allowed"
              )}
            >
              {saving ? "Saving…" : "Save Assessment"}
            </button>
          </div>
        </div>
      )}

      {/* Past assessments */}
      {records === null ? (
        <div className="p-4 space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="animate-pulse h-10 bg-gray-100 rounded-lg" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-gray-400">
          No assessments filed yet
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {records.map(rec => {
            const data: ChecklistData = rec.checklistData ? JSON.parse(rec.checklistData) : {};
            const checked = CHECKLIST_ITEMS.filter(i => data[i.id]).length;
            const isOpen  = expanded === rec.id;
            return (
              <div key={rec.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : rec.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", OUTCOME_STYLE[rec.outcome])}>
                    {rec.outcome}
                  </span>
                  <span className="text-xs text-gray-600 font-medium flex-1">{fmtDate(rec.filledAt)}</span>
                  <span className="text-[10px] text-gray-400">{checked}/{CHECKLIST_ITEMS.length} items</span>
                  <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{rec.filledBy}</span>
                  {isOpen ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 bg-gray-50/50">
                    {/* Checklist summary */}
                    <div className="grid grid-cols-1 gap-1">
                      {CHECKLIST_ITEMS.map(item => (
                        <div key={item.id} className={clsx(
                          "flex items-center gap-2 text-xs px-2 py-1 rounded",
                          data[item.id] ? "text-emerald-700" : "text-gray-400"
                        )}>
                          <span className="font-bold">{data[item.id] ? "✓" : "✗"}</span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* STP Metrics — By Manager (checkboxes) */}
                    {STP_METRICS_ROWS.some(row => data["stp_mgr_" + row.id + "_a"] || data["stp_mgr_" + row.id + "_b"]) && (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">STP Metrics — By Manager</p>
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-2.5 py-2 font-semibold text-gray-400 w-[22%]">Parameter</th>
                                <th className="text-left px-2.5 py-2 font-semibold text-emerald-500 w-[28%]">Positive Criteria</th>
                                <th className="text-center px-2 py-2 font-semibold text-emerald-500 w-[6%]">A</th>
                                <th className="text-left px-2.5 py-2 font-semibold text-red-400 w-[28%]">Negative Criteria</th>
                                <th className="text-center px-2 py-2 font-semibold text-red-400 w-[6%]">B</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {STP_METRICS_ROWS.map(row => (
                                <tr key={row.id} className="bg-white">
                                  <td className="px-2.5 py-2 font-semibold text-gray-600 align-middle">{row.parameter}</td>
                                  <td className="px-2.5 py-2 text-gray-500 align-middle">{row.positiveCriteria}</td>
                                  <td className="px-2 py-2 text-center align-middle">
                                    <ScoreBadge value={String(data["stp_mgr_" + row.id + "_a"] ?? "")} />
                                  </td>
                                  <td className="px-2.5 py-2 text-gray-500 align-middle">{row.negativeCriteria}</td>
                                  <td className="px-2 py-2 text-center align-middle">
                                    {row.negativeCriteria
                                      ? <ScoreBadge value={String(data["stp_mgr_" + row.id + "_b"] ?? "")} />
                                      : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* STP Metrics — By HR (score inputs) */}
                    {STP_HR_METRICS_ROWS.some(row => data["stp_hr_" + row.id + "_a"] || data["stp_hr_" + row.id + "_b"]) && (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">STP Metrics — By HR</p>
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-2.5 py-2 font-semibold text-gray-400 w-[22%]">Parameter</th>
                                <th className="text-left px-2.5 py-2 font-semibold text-emerald-500 w-[26%]">Positive Criteria</th>
                                <th className="text-center px-2 py-2 font-semibold text-emerald-500 w-[8%]">Score</th>
                                <th className="text-left px-2.5 py-2 font-semibold text-red-400 w-[26%]">Negative Criteria</th>
                                <th className="text-center px-2 py-2 font-semibold text-red-400 w-[8%]">Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {STP_HR_METRICS_ROWS.map(row => (
                                <tr key={row.id} className="bg-white">
                                  <td className="px-2.5 py-2 font-semibold text-gray-600 align-middle">{row.parameter}</td>
                                  <td className="px-2.5 py-2 text-gray-500 align-middle">{row.positiveCriteria}</td>
                                  <td className="px-2 py-2 text-center align-middle">
                                    <ScoreBadge value={String(data["stp_hr_" + row.id + "_a"] ?? "")} />
                                  </td>
                                  <td className="px-2.5 py-2 text-gray-500 align-middle">{row.negativeCriteria}</td>
                                  <td className="px-2 py-2 text-center align-middle">
                                    {row.negativeCriteria
                                      ? <ScoreBadge value={String(data["stp_hr_" + row.id + "_b"] ?? "")} />
                                      : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {rec.managerNotes && (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Manager Notes</p>
                        <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100 whitespace-pre-wrap">{rec.managerNotes}</p>
                      </div>
                    )}
                    {rec.hrNotes && (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">HR Notes</p>
                        <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100 whitespace-pre-wrap">{rec.hrNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Expand modal */}
      {expandedField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">
                {expandedField === "manager" ? "Manager Notes" : "HR Notes"}
                <span className="ml-2 text-xs font-normal text-gray-400">— {njName}</span>
              </p>
              <button
                onClick={() => setExpandedField(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-auto">
              <textarea
                value={expandedValue}
                onChange={e => setExpandedValue(e.target.value)}
                placeholder={expandedField === "manager" ? "Add manager observations…" : "Add HR observations…"}
                className="w-full h-full min-h-[300px] text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setExpandedField(null)}
                className="flex-1 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (expandedField === "manager") setManagerNotes(expandedValue);
                  else setHrNotes(expandedValue);
                  setExpandedField(null);
                }}
                className="flex-1 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

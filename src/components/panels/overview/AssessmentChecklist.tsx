"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { clsx } from "clsx";
import { ClipboardList, Plus, ChevronDown, ChevronUp } from "lucide-react";

// ── checklist items ────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: "training_completed",       label: "STP Training Completed"                        },
  { id: "qubits_satisfactory",      label: "Qubits Score Satisfactory (≥70)"               },
  { id: "dsr_regular",              label: "DSR Submitted Regularly"                        },
  { id: "huddle_attendance",        label: "Huddle Attendance Complete"                     },
  { id: "manager_huddle_done",      label: "Manager Huddle Completed"                       },
  { id: "tat_followup_guidance",    label: "TAT and Follow-up of Leads Guidance"            },
  { id: "lead_audit_guidance",      label: "Lead Audit Guidance"                            },
  { id: "lead_handling_guidance",   label: "Lead Handling and Self Generation Guidance"     },
  { id: "sc_policy_guidance",       label: "Tentative SC Policy Guidance"                   },
];

type ChecklistData = Record<string, boolean>;

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
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Manager Notes
              </label>
              <textarea
                value={managerNotes}
                onChange={e => setManagerNotes(e.target.value)}
                rows={2}
                placeholder="Add manager observations…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                HR Notes
              </label>
              <textarea
                value={hrNotes}
                onChange={e => setHrNotes(e.target.value)}
                rows={2}
                placeholder="Add HR observations…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>
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
                    {rec.managerNotes && (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Manager Notes</p>
                        <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">{rec.managerNotes}</p>
                      </div>
                    )}
                    {rec.hrNotes && (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">HR Notes</p>
                        <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">{rec.hrNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

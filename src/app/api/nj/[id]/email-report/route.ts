import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  newJoiners, huddleLogs, dsrSubmissions, qubitScores,
  stpTaskOverrides, assessmentChecklists, nrRecords,
} from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

const TENANT_ID     = process.env.OUTLOOK_TENANT_ID    ?? "98deb14a-8f2f-48b2-807f-8a97c96a0ca3";
const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID     ?? "dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2";
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET!;
const MAILBOX       = process.env.OUTLOOK_MAILBOX!;

const CHECKLIST_ITEMS = [
  { id: "training_completed",     label: "STP Training Completed"                    },
  { id: "qubits_satisfactory",    label: "Qubits Completed"                          },
  { id: "dsr_regular",            label: "DSR Submitted Regularly"                   },
  { id: "huddle_attendance",      label: "Huddle Attendance Complete"                },
  { id: "manager_huddle_done",    label: "Manager Huddle Completed"                  },
  { id: "tat_followup_guidance",  label: "TAT and Follow-up of Leads Guidance"       },
  { id: "lead_audit_guidance",    label: "Lead Audit Guidance"                       },
  { id: "lead_handling_guidance", label: "Lead Handling and Self Generation Guidance"},
  { id: "sc_policy_guidance",     label: "Tentative SC Policy Guidance"              },
];

// ── STP metrics definitions (must match AssessmentChecklist component) ────────

const STP_MGR_ROWS = [
  { id: "attendance", parameter: "Attendance & Engagement",                    positiveCriteria: "Attended all Meetings?",                                              negativeCriteria: "Missed any meetings" },
  { id: "reporting",  parameter: "Reporting Discipline",                        positiveCriteria: "Submitted DSRs Everyday",                                             negativeCriteria: "Missed any DSRs" },
  { id: "lead_1",     parameter: "Lead Handling",                               positiveCriteria: "Positive and independent",                                            negativeCriteria: "Any miss or negligence identified" },
  { id: "lead_2",     parameter: "Proactive and completes tasks on or before time", positiveCriteria: "Demonstrated ownership / initiative",                            negativeCriteria: "Passive or reactive behavior" },
  { id: "wfh",        parameter: "WFH Capable",                                 positiveCriteria: "No disturbances, Joins timely, Punctual, No internet issues",        negativeCriteria: "Improvement required" },
];

const STP_HR_ROWS = [
  { id: "attendance", parameter: "Attendance & Engagement",                         positiveCriteria: "Attended all huddles",                                                                               negativeCriteria: "Missed any huddles" },
  { id: "reporting",  parameter: "Reporting Discipline",                             positiveCriteria: "Submitted DSRs on time",                                                                             negativeCriteria: "Missed any DSRs" },
  { id: "audit",      parameter: "Audit Quality",                                    positiveCriteria: "Positive audit",                                                                                     negativeCriteria: "Negative audit" },
  { id: "proactive",  parameter: "Proactive and completes STP on or before time",    positiveCriteria: "Demonstrated ownership / initiative",                                                               negativeCriteria: "Passive or reactive behaviour" },
  { id: "wfh",        parameter: "WFH Capable",                                      positiveCriteria: "Includes - No disturbances, joins timely, Punctual, no internet issues encountered.",              negativeCriteria: "Improvement required" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function workingDaysSince(dojISO: string): number {
  const [y, mo, da] = dojISO.split("-").map(Number);
  const doj = new Date(y, mo - 1, da);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj); d.setDate(d.getDate() + 1);
  while (d <= today) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getWorkingDayDate(dojISO: string, dayNum: number): string {
  const [y, mo, da] = dojISO.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  let count = 0;
  while (count < dayNum) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return localISO(d);
}

function fmtDate(iso: string) {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function tenureLabel(dojISO: string) {
  const [y, mo, da] = dojISO.split("-").map(Number);
  const doj = new Date(y, mo - 1, da);
  const days = Math.floor((Date.now() - doj.getTime()) / 86400000);
  if (days < 30)  return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} mo ${days % 30} d`;
  return `${Math.floor(days / 365)} yr ${Math.floor((days % 365) / 30)} mo`;
}

async function getGraphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("Graph auth failed");
  return data.access_token;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

interface ReportData {
  nj: {
    name: string; empId: string | null; joinDate: string;
    managerId: string; location: string | null; designation: string | null;
    email: string | null; currentPhase: string; stpExtendedDays: number;
    stpClosed: boolean | null; managerHuddleDone: boolean | null;
    stpMetricsDone: boolean | null;
  };
  wds: number;
  today: string;
  windowDates: string[];   // 14 working-day dates
  huddleCompleted: Set<string>;
  dsrSubmitted: Set<string>;
  qubitsByDate: Map<string, number>;
  qubitDone: Set<string>;  // dates with done qubits (score OR override)
  nrData: { month: number; year: number; nrValue: number; isPositive: boolean | null }[];
  latestAssessment: { outcome: string; filledAt: string; filledBy: string; managerNotes: string | null; hrNotes: string | null; checklistData: Record<string, boolean | string> } | null;
}

// ─ primitives ─

function statusBadge(done: boolean, trueLabel = "Done", falseLabel = "Pending"): string {
  const bg    = done ? "#d1fae5" : "#fee2e2";
  const color = done ? "#065f46" : "#991b1b";
  const border = done ? "#6ee7b7" : "#fca5a5";
  const icon  = done ? "✓" : "✗";
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${bg};color:${color};border:1px solid ${border}">${icon} ${done ? trueLabel : falseLabel}</span>`;
}

function taskDot(state: "done" | "missed" | "upcoming"): string {
  const styles: Record<string, string> = {
    done:     "background:#d1fae5;border:1.5px solid #6ee7b7;color:#065f46",
    missed:   "background:#fee2e2;border:1.5px solid #fca5a5;color:#991b1b",
    upcoming: "background:#f3f4f6;border:1.5px solid #e5e7eb;color:#9ca3af",
  };
  const icons = { done: "✓", missed: "✗", upcoming: "·" };
  return `<span style="display:inline-block;width:20px;height:20px;border-radius:4px;text-align:center;line-height:19px;font-size:10px;font-weight:700;${styles[state]}">${icons[state]}</span>`;
}

function phaseDot(state: "done" | "upcoming", isExtended = false): string {
  const bg    = state === "done" ? (isExtended ? "#fde68a" : "#bfdbfe") : "#f3f4f6";
  const border = state === "done" ? (isExtended ? "#f59e0b" : "#3b82f6") : "#e5e7eb";
  const color  = state === "done" ? (isExtended ? "#92400e" : "#1d4ed8") : "#9ca3af";
  const icon   = state === "done" ? "✓" : "·";
  return `<span style="display:inline-block;width:22px;height:22px;border-radius:5px;text-align:center;line-height:21px;font-size:10px;font-weight:700;background:${bg};border:1.5px solid ${border};color:${color}">${icon}</span>`;
}

// ─ section wrapper ─

function section(num: number, title: string, accentColor: string, body: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
    <tr>
      <td style="background:${accentColor};padding:10px 18px">
        <span style="font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.06em">${num}. ${title}</span>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:16px 18px">${body}</td>
    </tr>
  </table>`;
}

// ─ score badge (0 / 1 / —) ─

function scoreBadge(val: string): string {
  if (val === "1") return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;border:1px solid #6ee7b7">1</span>`;
  if (val === "0") return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db">0</span>`;
  return `<span style="color:#d1d5db;font-size:12px">—</span>`;
}

// ─ STP metrics table (shared for manager + HR) ─

function stpMetricsTable(
  rows: { id: string; parameter: string; positiveCriteria: string; negativeCriteria: string }[],
  prefix: string,
  cd: Record<string, boolean | string>,
  scoreLabel: string,
): string {
  const thead = `
    <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
      <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;width:22%">Parameter</th>
      <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.05em;width:30%">Positive Criteria</th>
      <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.05em;width:8%">${scoreLabel}</th>
      <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;width:30%">Negative Criteria</th>
      <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;width:8%">${scoreLabel}</th>
    </tr>`;
  const tbody = rows.map((row, i) => {
    const aVal = String(cd[`${prefix}_${row.id}_a`] ?? "");
    const bVal = String(cd[`${prefix}_${row.id}_b`] ?? "");
    const bg = i % 2 === 0 ? "#fff" : "#fafafa";
    return `
    <tr style="background:${bg};border-top:1px solid #f3f4f6">
      <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#374151;vertical-align:top">${row.parameter}</td>
      <td style="padding:8px 10px;font-size:12px;color:#374151;vertical-align:top">${row.positiveCriteria}</td>
      <td style="padding:8px 10px;text-align:center;vertical-align:top">${scoreBadge(aVal)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#374151;vertical-align:top">${row.negativeCriteria}</td>
      <td style="padding:8px 10px;text-align:center;vertical-align:top">${row.negativeCriteria ? scoreBadge(bVal) : ""}</td>
    </tr>`;
  }).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

// ─ build HTML ─

function buildHtml(d: ReportData): string {
  const { nj, wds, today, windowDates, huddleCompleted, dsrSubmitted, qubitsByDate, qubitDone, latestAssessment, nrData } = d;
  const maxDays   = 14 + (nj.stpExtendedDays > 0 ? 4 : 0);
  const pastDates = windowDates.filter(dt => dt <= today);

  const huddleCount = pastDates.filter(dt => huddleCompleted.has(dt)).length;
  const dsrCount    = pastDates.filter(dt => dsrSubmitted.has(dt)).length;
  const qDates      = windowDates.filter(dt => qubitDone.has(dt));
  const qDatesWithScore = qDates.filter(dt => qubitsByDate.has(dt));
  const latestQ     = qDatesWithScore.length ? qubitsByDate.get(qDatesWithScore[qDatesWithScore.length - 1]) ?? null : null;
  const avgQ        = qDatesWithScore.length
    ? Math.round(qDatesWithScore.reduce((s, dt) => s + (qubitsByDate.get(dt) ?? 0), 0) / qDatesWithScore.length * 10) / 10
    : null;

  let phaseLabel = ""; let phaseColor = "#3b82f6";
  if (nj.stpClosed)   { phaseLabel = "STP Closed";              phaseColor = "#6b7280"; }
  else if (wds <= 14) { phaseLabel = `Phase 1 — Training · Day ${wds} of 14`; phaseColor = "#3b82f6"; }
  else if (wds <= 18) { phaseLabel = `Phase 2 — Extended · Day ${wds} of 18`; phaseColor = "#d97706"; }
  else                { phaseLabel = "STP Window Complete";       phaseColor = "#059669"; }

  const pct = (n: number, t: number) => t === 0 ? "–" : `${Math.round((n / t) * 100)}%`;

  // ── 1. Details ──
  const totalNR = nrData.reduce((s, r) => s + (r.nrValue ?? 0), 0);
  const nrPositive = nrData.some(r => r.isPositive);
  const nrColor = nrData.length === 0 ? "#111827" : nrPositive ? "#059669" : "#dc2626";
  const nrDisplay = nrData.length === 0 ? "—" : totalNR.toLocaleString("en-IN");
  const detailRows: [string, string, string?][] = [
    ["Employee ID",  nj.empId ?? "—"],
    ["Join Date",    fmtDate(nj.joinDate)],
    ["Tenure",       tenureLabel(nj.joinDate)],
    ["Phase",        nj.currentPhase],
    ["Manager",      nj.managerId],
    ["Location",     nj.location ?? "—"],
    ["Designation",  nj.designation ?? "—"],
    ["Email",        nj.email ?? "—"],
    ["Net Revenue",  nrDisplay, nrColor],
    ...(nj.stpExtendedDays > 0 ? [["Extended Days", `${nj.stpExtendedDays} days`] as [string, string]] : []),
  ];
  const detailsHtml = `
    <table width="100%" cellpadding="0" cellspacing="0">
      ${detailRows.map(([label, val, color], i) => `
        <tr style="${i % 2 === 0 ? "background:#f9fafb" : "background:#fff"}">
          <td style="padding:8px 12px;font-size:12px;color:#6b7280;width:140px;font-weight:500">${label}</td>
          <td style="padding:8px 12px;font-size:12px;color:${color ?? "#111827"};font-weight:600">${val}</td>
        </tr>`).join("")}
    </table>`;

  // ── 2. STP Phase Progress ──
  const standardDots = Array.from({ length: 14 }, (_, i) => {
    const dt = getWorkingDayDate(nj.joinDate, i + 1);
    const state = dt > today ? "upcoming" : "done";
    // For phase bar dots we just show whether the day has passed
    return `<span style="margin:2px;display:inline-block" title="Day ${i + 1} — ${fmtDate(dt)}">${phaseDot(state, false)}</span>`;
  }).join("");

  const extendedDots = nj.stpExtendedDays > 0
    ? Array.from({ length: 4 }, (_, i) => {
        const dt = getWorkingDayDate(nj.joinDate, i + 15);
        const state = dt > today ? "upcoming" : "done";
        return `<span style="margin:2px;display:inline-block" title="Day ${i + 15} — ${fmtDate(dt)}">${phaseDot(state, true)}</span>`;
      }).join("")
    : "";

  const barPct = Math.min(Math.round((wds / maxDays) * 100), 100);
  const barColor = wds <= 14 ? "#3b82f6" : "#f59e0b";

  const phaseHtml = `
    <div style="margin-bottom:14px">
      <span style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${phaseColor}18;color:${phaseColor};border:1.5px solid ${phaseColor}40">${phaseLabel}</span>
    </div>
    <p style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px">Phase 1 — Standard (Days 1–14)</p>
    <div style="line-height:2">${standardDots}</div>
    ${nj.stpExtendedDays > 0 ? `
    <p style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px">Phase 2 — Extended (Days 15–18)</p>
    <div style="line-height:2">${extendedDots}</div>` : ""}
    <div style="margin-top:14px">
      <div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden">
        <div style="background:${barColor};height:8px;width:${barPct}%;border-radius:999px"></div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px">
        <tr>
          <td style="font-size:10px;color:#9ca3af">Day 1</td>
          <td style="font-size:10px;color:#374151;font-weight:600;text-align:center">${Math.min(wds, maxDays)} / ${maxDays} working days</td>
          <td style="font-size:10px;color:#9ca3af;text-align:right">Day ${maxDays}</td>
        </tr>
      </table>
    </div>`;

  // ── 3. Day-wise Task Tracker ──
  const summaryRow = (label: string, count: number, total: number, color: string) => `
    <td style="padding:0 6px 0 0;width:33%">
      <div style="border:1px solid ${color}30;border-radius:8px;padding:10px 12px;text-align:center;background:${color}08">
        <div style="font-size:20px;font-weight:800;color:${color}">${count}<span style="font-size:13px;color:#6b7280;font-weight:500">/${total}</span></div>
        <div style="font-size:11px;font-weight:600;color:#374151;margin:2px 0">${label}</div>
        <div style="font-size:10px;color:#9ca3af">${pct(count, total)}</div>
      </div>
    </td>`;

  const trackerHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr>
        ${summaryRow("Huddle", huddleCount, pastDates.length, "#6366f1")}
        ${summaryRow("DSR", dsrCount, pastDates.length, "#059669")}
        <td style="padding:0;width:33%">
          <div style="border:1px solid #f59e0b30;border-radius:8px;padding:10px 12px;text-align:center;background:#f59e0b08">
            <div style="font-size:20px;font-weight:800;color:#d97706">${latestQ !== null ? latestQ.toFixed(1) : "—"}</div>
            <div style="font-size:11px;font-weight:600;color:#374151;margin:2px 0">Qubits (latest)</div>
            <div style="font-size:10px;color:#9ca3af">${avgQ !== null ? `avg ${avgQ} · ${qDates.length} sessions` : "No data"}</div>
          </div>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:12px">
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
          <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;width:45px">Day</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Date</th>
          <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Huddle</th>
          <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">DSR</th>
          <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Qubits</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: 14 }, (_, i) => {
          const dt       = getWorkingDayDate(nj.joinDate, i + 1);
          const isToday  = dt === today;
          const upcoming = dt > today;
          const h  = upcoming ? "upcoming" : (huddleCompleted.has(dt) ? "done" : "missed");
          const ds = upcoming ? "upcoming" : (dsrSubmitted.has(dt)    ? "done" : "missed");
          const q  = upcoming ? "upcoming" : (qubitDone.has(dt)       ? "done" : "missed");
          const rowBg = isToday ? "#eef2ff" : i % 2 === 0 ? "#fff" : "#fafafa";
          return `<tr style="background:${rowBg};border-top:1px solid #f3f4f6">
            <td style="padding:7px 12px;font-weight:700;color:${isToday ? "#4f46e5" : "#374151"};font-size:12px">
              ${i + 1}${isToday ? `<br><span style="font-size:9px;color:#6366f1;font-weight:600">Today</span>` : ""}
            </td>
            <td style="padding:7px 12px;color:#6b7280;font-size:12px">${fmtDate(dt)}</td>
            <td style="padding:7px 10px;text-align:center">${taskDot(h as "done" | "missed" | "upcoming")}</td>
            <td style="padding:7px 10px;text-align:center">${taskDot(ds as "done" | "missed" | "upcoming")}</td>
            <td style="padding:7px 10px;text-align:center">${taskDot(q as "done" | "missed" | "upcoming")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  // ── 4. Assessment Checklist ──
  let assessmentHtml = `<p style="font-size:12px;color:#9ca3af;margin:0">No assessment filed yet.</p>`;
  if (latestAssessment) {
    const OUTCOME_COLOR: Record<string, { bg: string; border: string; color: string }> = {
      Pass:     { bg: "#d1fae5", border: "#6ee7b7", color: "#065f46" },
      Fail:     { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b" },
      Pending:  { bg: "#fef3c7", border: "#fcd34d", color: "#92400e" },
      Deferred: { bg: "#f3f4f6", border: "#d1d5db", color: "#374151" },
    };
    const oc = OUTCOME_COLOR[latestAssessment.outcome] ?? OUTCOME_COLOR.Pending;
    const checked = CHECKLIST_ITEMS.filter(item => latestAssessment.checklistData[item.id]);
    assessmentHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px">
        <tr>
          <td style="font-size:12px;color:#6b7280">
            Filed by <strong style="color:#374151">${latestAssessment.filledBy}</strong> on ${fmtDate(latestAssessment.filledAt.split("T")[0])}
            &nbsp;·&nbsp; ${checked.length}/${CHECKLIST_ITEMS.length} items checked
          </td>
          <td style="text-align:right">
            <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${oc.bg};color:${oc.color};border:1px solid ${oc.border}">
              ${latestAssessment.outcome}
            </span>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        ${CHECKLIST_ITEMS.map((item, i) => {
          const done = !!latestAssessment.checklistData[item.id];
          const bg   = i % 2 === 0 ? "#fff" : "#fafafa";
          return `<tr style="background:${bg};border-top:${i > 0 ? "1px solid #f3f4f6" : "none"}">
            <td style="padding:8px 12px;width:24px">
              <span style="display:inline-block;width:18px;height:18px;border-radius:4px;text-align:center;line-height:17px;font-size:10px;font-weight:700;
                background:${done ? "#d1fae5" : "#fee2e2"};border:1px solid ${done ? "#6ee7b7" : "#fca5a5"};color:${done ? "#065f46" : "#991b1b"}">
                ${done ? "✓" : "✗"}
              </span>
            </td>
            <td style="padding:8px 12px;font-size:12px;color:${done ? "#111827" : "#6b7280"};font-weight:${done ? "500" : "400"}">${item.label}</td>
          </tr>`;
        }).join("")}
      </table>
      ${latestAssessment.managerNotes ? `
      <div style="margin-top:16px">
        <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Manager Notes</div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;font-size:12px;color:#374151;line-height:1.6">${latestAssessment.managerNotes.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
      </div>` : ""}
      ${latestAssessment.hrNotes ? `
      <div style="margin-top:12px">
        <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">HR Notes</div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;font-size:12px;color:#374151;line-height:1.6">${latestAssessment.hrNotes.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
      </div>` : ""}`;
  }

  // ── 5. Manager Huddle Status ──
  const managerHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      ${[
        ["Manager Huddle Completed", !!nj.managerHuddleDone],
        ["STP Metrics Reviewed",     !!nj.stpMetricsDone],
      ].map(([label, done], i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#fafafa"};border-top:${i > 0 ? "1px solid #f3f4f6" : "none"}">
          <td style="padding:10px 14px;font-size:12px;color:#374151;font-weight:500">${label}</td>
          <td style="padding:10px 14px;text-align:right">${statusBadge(done as boolean)}</td>
        </tr>`).join("")}
    </table>`;

  // ── 6 & 7. STP Metrics by Manager and HR ──
  const cd = latestAssessment?.checklistData ?? {};
  const stpMgrHtml = stpMetricsTable(STP_MGR_ROWS, "stp_mgr", cd, "A / B");
  const stpHrHtml  = stpMetricsTable(STP_HR_ROWS,  "stp_hr",  cd, "Score");

  // ── Assemble ──
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>STP Progress Report — ${nj.name}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

          <!-- Header banner -->
          <tr>
            <td bgcolor="#4f46e5" style="background:#4f46e5;border-radius:12px 12px 0 0;padding:28px 28px 24px">
              <div style="font-size:10px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">STP Progress Report</div>
              <div style="font-size:26px;font-weight:800;color:#f0f0ff;line-height:1.2;text-shadow:0 1px 3px rgba(0,0,0,0.3)">${nj.name}</div>
              <div style="font-size:12px;color:#c4b5fd;margin-top:6px">
                ${nj.empId ? `${nj.empId} &nbsp;·&nbsp; ` : ""}${nj.managerId} &nbsp;·&nbsp; Generated ${fmtDate(today)}
              </div>
            </td>
          </tr>

          <!-- White card body -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e2e8f0;border-top:none">

              ${section(1, "NJ Details",                        "#374151", detailsHtml)}
              ${section(2, "STP Phase Progress",                "#4f46e5", phaseHtml)}
              ${section(3, "Day-wise Task Tracker (Days 1–14)", "#059669", trackerHtml)}
              ${section(4, "Assessment Checklist",              "#7c3aed", assessmentHtml)}
              ${section(5, "Manager Huddle Status",             "#0369a1", managerHtml)}
              ${section(6, "STP Metrics — By Manager",          "#6d28d9", stpMgrHtml)}
              ${section(7, "STP Metrics — By HR",               "#be185d", stpHrHtml)}

              <!-- Legend -->
              <table cellpadding="0" cellspacing="0" style="margin-top:8px;margin-bottom:20px">
                <tr>
                  <td style="padding-right:16px;font-size:11px;color:#6b7280">Legend:</td>
                  <td style="padding-right:12px">${taskDot("done")} <span style="font-size:11px;color:#374151">Done</span></td>
                  <td style="padding-right:12px">${taskDot("missed")} <span style="font-size:11px;color:#374151">Missed</span></td>
                  <td>${taskDot("upcoming")} <span style="font-size:11px;color:#374151">Upcoming</span></td>
                </tr>
              </table>

              <!-- Footer -->
              <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;font-size:10px;color:#9ca3af">
                Sent via STP Dashboard &nbsp;·&nbsp; ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </div>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!CLIENT_SECRET) return NextResponse.json({ error: "OUTLOOK_CLIENT_SECRET not configured" }, { status: 500 });
  if (!MAILBOX)       return NextResponse.json({ error: "OUTLOOK_MAILBOX not configured" }, { status: 500 });

  const { id } = await params;
  const njId = parseInt(id, 10);
  const { to } = await req.json() as { to: string[] };

  const recipients = (Array.isArray(to) ? to : [to]).map(e => e.trim()).filter(e => e.includes("@"));
  if (recipients.length === 0)
    return NextResponse.json({ error: "No valid recipient emails provided" }, { status: 400 });

  const nj = await db.select().from(newJoiners).where(eq(newJoiners.id, njId)).get();
  if (!nj) return NextResponse.json({ error: "NJ not found" }, { status: 404 });

  const today    = localISO(new Date());
  const wds      = workingDaysSince(nj.joinDate);
  const maxDays  = 14 + (nj.stpExtendedDays > 0 ? 4 : 0);
  const windowDates = Array.from({ length: maxDays }, (_, i) => getWorkingDayDate(nj.joinDate, i + 1));

  const [huddles, dsrs, qubits, overrides, assessments, nrRows] = await Promise.all([
    db.select().from(huddleLogs).where(eq(huddleLogs.njId, njId)).all(),
    db.select().from(dsrSubmissions).where(eq(dsrSubmissions.njId, njId)).all(),
    db.select().from(qubitScores).where(eq(qubitScores.njId, njId)).all(),
    db.select().from(stpTaskOverrides).where(eq(stpTaskOverrides.njId, njId)).all(),
    db.select().from(assessmentChecklists).where(eq(assessmentChecklists.njId, njId))
      .orderBy(desc(assessmentChecklists.filledAt)).all(),
    db.select().from(nrRecords).where(eq(nrRecords.njId, njId)).all(),
  ]);

  // Apply overrides
  const overrideMap = new Map(overrides.map(o => [`${o.date}-${o.task}`, o.done]));

  const huddleCompleted = new Set<string>();
  for (const h of huddles) {
    const ov = overrideMap.get(`${h.date}-huddle`);
    if (ov !== undefined ? ov : h.completed) huddleCompleted.add(h.date);
  }
  for (const [key, done] of overrideMap) {
    if (key.endsWith("-huddle") && done) huddleCompleted.add(key.replace("-huddle", ""));
  }

  const dsrSubmitted = new Set<string>();
  for (const d of dsrs) {
    const ov = overrideMap.get(`${d.date}-dsr`);
    if (ov === undefined || ov) dsrSubmitted.add(d.date);
  }
  for (const [key, done] of overrideMap) {
    if (key.endsWith("-dsr") && done) dsrSubmitted.add(key.replace("-dsr", ""));
  }

  const qubitsByDate = new Map<string, number>();
  for (const q of qubits) qubitsByDate.set(q.date, q.score);

  // qubitDone: dates where qubits are done (actual score OR override=true)
  const qubitDone = new Set<string>();
  for (const [dt] of qubitsByDate) {
    const ov = overrideMap.get(`${dt}-qubits`);
    if (ov === undefined || ov) qubitDone.add(dt); // not overridden to false
  }
  for (const [key, done] of overrideMap) {
    if (key.endsWith("-qubits") && done) qubitDone.add(key.replace("-qubits", ""));
  }

  const latest = assessments[0] ?? null;
  const latestAssessment = latest ? {
    outcome:       latest.outcome,
    filledAt:      latest.filledAt,
    filledBy:      latest.filledBy,
    managerNotes:  latest.managerNotes ?? null,
    hrNotes:       latest.hrNotes ?? null,
    checklistData: latest.checklistData ? JSON.parse(latest.checklistData) as Record<string, boolean | string> : {},
  } : null;

  const nrData = nrRows.map(r => ({
    month: r.month, year: r.year,
    nrValue: r.nrValue ?? 0,
    isPositive: r.isPositive,
  }));

  const html = buildHtml({
    nj: {
      name: nj.name, empId: nj.empId, joinDate: nj.joinDate,
      managerId: nj.managerId, location: nj.location,
      designation: nj.designation, email: nj.email,
      currentPhase: nj.currentPhase, stpExtendedDays: nj.stpExtendedDays,
      stpClosed: nj.stpClosed, managerHuddleDone: nj.managerHuddleDone,
      stpMetricsDone: nj.stpMetricsDone,
    },
    wds, today, windowDates,
    huddleCompleted, dsrSubmitted, qubitsByDate, qubitDone,
    latestAssessment, nrData,
  });

  const token = await getGraphToken();

  const mailRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: `STP Progress Report — ${nj.name}`,
          body: { contentType: "HTML", content: html },
          toRecipients: recipients.map(address => ({ emailAddress: { address } })),
        },
        saveToSentItems: "true",
      }),
    }
  );

  if (!mailRes.ok) {
    const txt = await mailRes.text();
    return NextResponse.json({ error: `Graph sendMail failed: ${txt}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to: recipients, subject: `STP Progress Report — ${nj.name}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email-report] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

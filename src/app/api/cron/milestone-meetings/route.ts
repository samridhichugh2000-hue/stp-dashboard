/**
 * GET /api/cron/milestone-meetings
 *
 * Runs daily at 06:30 IST (01:00 UTC).
 * For each active NJ, checks if today is a STP milestone day:
 *   - Day 14 working day  → Phase 1 Review
 *   - Join date + 30 days → Month 1 Review
 *   - Join date + 90 days → PA Review    (only if PA alert exists)
 *   - Join date +120 days → PIP Review   (only if PIP alert exists)
 *   - Join date +150 days → Exit Review  (only if EXIT alert exists)
 *
 * If milestone reached and no meeting yet logged, records a "Pending" entry in
 * meeting_logs — the dashboard alert and daily email will prompt manual scheduling.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/lib/db";
import { newJoiners, performanceAlerts, meetingLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const ADMIN_EMAIL = process.env.TEAMS_CALENDAR_OWNER_EMAIL!;

// ── date helpers ──────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIST(): string {
  // Vercel runs UTC; IST = UTC+5:30
  const d = new Date(Date.now() + 5.5 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  return localISO(d);
}

function getWorkingDayDate(joinDateISO: string, dayNum: number): string {
  const [y, mo, da] = joinDateISO.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  let count = 0;
  while (count < dayNum) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return localISO(d);
}

// ── milestone definitions ─────────────────────────────────────────────────────

type MeetingType = "Phase1Review" | "Month1Review" | "PA" | "PIP" | "EXIT";

interface Milestone {
  type:         MeetingType;
  label:        string;
  durationMins: number;
  requiresAlert: string | null;
  dateFor:      (joinDate: string) => string;
}

const MILESTONES: Milestone[] = [
  {
    type: "Phase1Review",
    label: "STP Evaluation - Manager Huddle",
    durationMins: 30,
    requiresAlert: null,
    dateFor: (j) => getWorkingDayDate(j, 14),
  },
  {
    type: "Month1Review",
    label: "Month 1 STP Review",
    durationMins: 30,
    requiresAlert: null,
    dateFor: (j) => addDays(j, 30),
  },
  {
    type: "PA",
    label: "PA Review Meeting",
    durationMins: 45,
    requiresAlert: "PA",
    dateFor: (j) => addDays(j, 90),
  },
  {
    type: "PIP",
    label: "PIP Review Meeting",
    durationMins: 45,
    requiresAlert: "PIP",
    dateFor: (j) => addDays(j, 120),
  },
  {
    type: "EXIT",
    label: "Exit Review Meeting",
    durationMins: 60,
    requiresAlert: "EXIT",
    dateFor: (j) => addDays(j, 150),
  },
];

// ── route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronForbidden();

  const today = todayIST();

  const allNJs   = await db.select().from(newJoiners).where(eq(newJoiners.isActive, true)).all();
  const stpNJs   = allNJs.filter(n => !n.stpClosed && n.email);
  const alerts   = await db.select().from(performanceAlerts).all();

  const results: { name: string; milestone: string; action: string }[] = [];

  for (const nj of stpNJs) {
    const njAlerts = alerts.filter(a => a.njId === nj.id).map(a => a.alertType);

    for (const ms of MILESTONES) {
      const msDate = ms.dateFor(nj.joinDate);
      if (msDate !== today) continue;

      // Check alert gate
      if (ms.requiresAlert && !njAlerts.includes(ms.requiresAlert)) {
        results.push({ name: nj.name, milestone: ms.type, action: "skipped — no alert" });
        continue;
      }

      // Check if meeting already exists (non-cancelled)
      const existing = await client.execute({
        sql: `SELECT id FROM meeting_logs WHERE nj_id = ? AND meeting_type = ? AND status != 'Cancelled'`,
        args: [nj.id, ms.type],
      });
      if (existing.rows.length > 0) {
        results.push({ name: nj.name, milestone: ms.type, action: "skipped — already scheduled" });
        continue;
      }

      const subject = `${ms.label} — ${nj.name}`;
      const attendees = [nj.email!, ADMIN_EMAIL].filter(Boolean);

      try {
        await db.insert(meetingLogs).values({
          njId:         nj.id,
          meetingType:  ms.type,
          scheduledAt:  `${today}T15:00:00`,
          durationMins: ms.durationMins,
          subject,
          attendees:    JSON.stringify(attendees),
          status:       "Pending",
          createdBy:    "cron",
          createdAt:    new Date().toISOString(),
        });

        results.push({ name: nj.name, milestone: ms.type, action: "flagged — pending scheduling" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ name: nj.name, milestone: ms.type, action: `error: ${msg}` });
      }
    }
  }

  const scheduled = results.filter(r => r.action.startsWith("scheduled")).length;
  return NextResponse.json({ ok: true, today, scheduled, results });
}

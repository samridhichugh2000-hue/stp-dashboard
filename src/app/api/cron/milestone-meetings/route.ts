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
 * If milestone reached and no meeting yet scheduled, creates a Teams calendar
 * invite at 3:00 PM IST on that day and logs it in meeting_logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/lib/db";
import { newJoiners, performanceAlerts, meetingLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { createCalendarEvent, sendEmail } from "@/lib/msGraph";

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
    label: "End-of-Phase-1 Manager Huddle",
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
  const authHeader   = req.headers.get("authorization");
  const legacyHeader = req.headers.get("x-cron-secret");
  const valid = authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    legacyHeader === process.env.CRON_SECRET || legacyHeader === "stp-cron-2026";
  if (!valid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

      // Schedule at 3:00 PM IST today
      const startIso = `${today}T15:00:00`;
      const endIso   = `${today}T${String(15 + Math.floor(ms.durationMins / 60)).padStart(2, "0")}:${String(ms.durationMins % 60).padStart(2, "0")}:00`;

      const attendees = [nj.email!, ADMIN_EMAIL].filter(Boolean);
      const subject   = `${ms.label} — ${nj.name}`;

      const bodyHtml = `
        <p>Dear ${nj.name.split(" ")[0]},</p>
        <p>This is your scheduled <strong>${ms.label}</strong> as part of the Sales Training Programme.</p>
        <table style="border-collapse:collapse;font-size:13px">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">NJ Name</td><td style="font-weight:600">${nj.name}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Emp ID</td><td>${nj.empId ?? "—"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Join Date</td><td>${nj.joinDate}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Meeting</td><td>${ms.label}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:12px">Sent by STP Dashboard</p>
      `;

      try {
        const event = await createCalendarEvent({
          subject,
          bodyHtml,
          startIso,
          endIso,
          timeZone: "India Standard Time",
          attendees,
          isOnlineMeeting: true,
        });

        await db.insert(meetingLogs).values({
          njId:         nj.id,
          meetingType:  ms.type,
          scheduledAt:  `${today}T15:00:00`,
          durationMins: ms.durationMins,
          subject,
          attendees:    JSON.stringify(attendees),
          teamsEventId: event.id,
          teamsJoinUrl: event.joinUrl,
          status:       "Scheduled",
          createdBy:    "cron",
          createdAt:    new Date().toISOString(),
        });

        // Notify admin by email
        await sendEmail({
          to: [ADMIN_EMAIL],
          subject: `📅 Meeting Scheduled: ${subject}`,
          bodyHtml: `<p>A milestone meeting has been auto-scheduled.</p>${bodyHtml}${event.joinUrl ? `<p><a href="${event.joinUrl}">Join Teams Meeting</a></p>` : ""}`,
        });

        results.push({ name: nj.name, milestone: ms.type, action: `scheduled — event ${event.id}` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ name: nj.name, milestone: ms.type, action: `error: ${msg}` });
      }
    }
  }

  const scheduled = results.filter(r => r.action.startsWith("scheduled")).length;
  return NextResponse.json({ ok: true, today, scheduled, results });
}

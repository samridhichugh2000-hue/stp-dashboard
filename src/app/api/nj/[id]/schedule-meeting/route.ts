/**
 * POST /api/nj/[id]/schedule-meeting
 * GET  /api/nj/[id]/schedule-meeting
 *
 * POST — creates a Teams calendar event and logs it in meeting_logs.
 * GET  — returns all meeting_logs for this NJ.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { newJoiners, meetingLogs } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { createCalendarEvent } from "@/lib/msGraph";

const ADMIN_EMAIL = process.env.TEAMS_CALENDAR_OWNER_EMAIL!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const njId = parseInt(id, 10);

  const meetings = await db
    .select()
    .from(meetingLogs)
    .where(eq(meetingLogs.njId, njId))
    .orderBy(desc(meetingLogs.scheduledAt))
    .all();

  return NextResponse.json(meetings);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "manager"].includes(session.user?.role ?? ""))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const njId = parseInt(id, 10);

    const nj = await db.select().from(newJoiners).where(eq(newJoiners.id, njId)).get();
    if (!nj) return NextResponse.json({ error: "NJ not found" }, { status: 404 });

    const body = await req.json() as {
      meetingType:    string;
      scheduledAt:    string; // ISO datetime "YYYY-MM-DDTHH:MM:00"
      durationMins:   number;
      extraAttendees?: string[];
      rrule?:         string; // iCal RRULE for recurring meetings
    };

    const { meetingType, scheduledAt, durationMins = 30, extraAttendees = [], rrule } = body;

    if (!meetingType || !scheduledAt)
      return NextResponse.json({ error: "meetingType and scheduledAt are required" }, { status: 400 });

    // Compute end time
    const start = new Date(scheduledAt);
    const end   = new Date(start.getTime() + durationMins * 60_000);
    const pad   = (n: number) => String(n).padStart(2, "0");
    const endIso = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;

    const attendees = [
      ...(nj.email ? [nj.email] : []),
      ADMIN_EMAIL,
      ...extraAttendees,
    ].filter((e, i, a) => e && a.indexOf(e) === i); // unique, non-empty

    const MEETING_LABELS: Record<string, string> = {
      DailyHuddle:  "Daily Huddle",
      Phase1Review: "STP Evaluation - Manager Huddle",
      Month1Review: "Month 1 STP Review Meeting",
      PA:           "PA Review Meeting",
      PIP:          "PIP Review Meeting",
      EXIT:         "Exit Review Meeting",
      AdHoc:        "Ad-hoc Meeting",
    };
    const label   = MEETING_LABELS[meetingType] ?? meetingType;
    const subject = `${label} — ${nj.name}`;

    const bodyHtml = `
      <p>Dear ${nj.name.split(" ")[0]},</p>
      <p>A <strong>${label}</strong> has been scheduled for you as part of the Sales Training Programme.</p>
      <table style="border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">NJ Name</td><td style="font-weight:600">${nj.name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Emp ID</td><td>${nj.empId ?? "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Meeting</td><td>${label}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:12px">Scheduled via STP Dashboard by ${session.user?.name ?? session.user?.email}</p>
    `;

    const event = await createCalendarEvent({
      subject,
      bodyHtml,
      startIso:        scheduledAt,
      endIso,
      timeZone:        "India Standard Time",
      attendees,
      isOnlineMeeting: true,
      ...(rrule ? { rrule } : {}),
    });

    const [saved] = await db.insert(meetingLogs).values({
      njId,
      meetingType,
      scheduledAt,
      durationMins,
      subject,
      attendees:    JSON.stringify(attendees),
      teamsEventId: event.id,
      teamsJoinUrl: event.joinUrl,
      status:       "Scheduled",
      createdBy:    session.user?.email ?? "admin",
      createdAt:    new Date().toISOString(),
    }).returning();

    return NextResponse.json({ ok: true, meeting: saved, joinUrl: event.joinUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

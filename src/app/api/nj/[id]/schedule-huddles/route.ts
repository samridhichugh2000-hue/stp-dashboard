/**
 * POST /api/nj/[id]/schedule-huddles
 *
 * Auto-schedules recurring daily huddles from Day 2 to Day 14 (13 sessions, 15 min each).
 * Body: { time: "HH:MM" }   ← IST time
 * Recipients: NJ + Samridhi.chugh@koenig-solutions.com
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { newJoiners, meetingLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createCalendarEvent } from "@/lib/msGraph";

const HUDDLE_ADMIN = "Samridhi.chugh@koenig-solutions.com";

function getNthWorkingDay(joinDateISO: string, n: number): string {
  const [y, mo, da] = joinDateISO.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    if (!nj.email) return NextResponse.json({ error: "NJ has no email address on file" }, { status: 400 });

    const body = await req.json() as { time: string };
    const { time } = body;
    if (!time || !/^\d{2}:\d{2}$/.test(time))
      return NextResponse.json({ error: "time is required (HH:MM)" }, { status: 400 });

    // Day 2 = 1st working day after joinDate
    // Day 14 = 13th working day after joinDate  → 13 occurrences total
    const startDate = getNthWorkingDay(nj.joinDate, 1);  // Day 2
    const endDate   = getNthWorkingDay(nj.joinDate, 13); // Day 14

    const [h, m] = time.split(":").map(Number);
    const totalMins = h * 60 + m + 15;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    const pad  = (n: number) => String(n).padStart(2, "0");

    const startIso = `${startDate}T${pad(h)}:${pad(m)}:00`;
    const endIso   = `${startDate}T${pad(endH)}:${pad(endM)}:00`;

    const attendees = [nj.email, HUDDLE_ADMIN].filter(
      (e, i, a) => e && a.indexOf(e) === i
    );

    const firstName = nj.name.split(" ")[0];
    const subject   = `Daily STP Huddle — ${nj.name}`;

    const bodyHtml = `
      <p>Dear ${firstName},</p>
      <p>Your <strong>Daily STP Huddles</strong> have been scheduled as part of the Sales Training Programme.</p>
      <table style="border-collapse:collapse;font-size:13px;margin:8px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">NJ Name</td><td style="font-weight:600">${nj.name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Emp ID</td><td>${nj.empId ?? "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Schedule</td><td>Day 2–14 · Mon to Fri · ${pad(h)}:${pad(m)} IST</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Duration</td><td>15 minutes per session</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Sessions</td><td>13 sessions (${startDate} → ${endDate})</td></tr>
      </table>
      <p style="color:#6b7280;font-size:12px">Scheduled via STP Dashboard by ${session.user?.name ?? session.user?.email}</p>
    `;

    // RRULE: Mon–Fri, 13 occurrences
    const rrule = `FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=13`;

    const event = await createCalendarEvent({
      subject,
      bodyHtml,
      startIso,
      endIso,
      timeZone:        "India Standard Time",
      attendees,
      isOnlineMeeting: true,
      rrule,
    });

    // Log as a single recurring series entry
    const [saved] = await db.insert(meetingLogs).values({
      njId,
      meetingType:  "DailyHuddle",
      scheduledAt:  startIso,
      durationMins: 15,
      subject,
      attendees:    JSON.stringify(attendees),
      teamsEventId: event.id,
      teamsJoinUrl: event.joinUrl,
      status:       "Scheduled",
      createdBy:    session.user?.email ?? "admin",
      createdAt:    new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      ok:      true,
      meeting: saved,
      joinUrl: event.joinUrl,
      startDate,
      endDate,
      sessions: 13,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

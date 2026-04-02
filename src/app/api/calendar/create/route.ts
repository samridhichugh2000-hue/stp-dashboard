import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { meetingLogs } from "@/lib/schema";
import { createCalendarEvent } from "@/lib/msGraph";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(session.user?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    njId:        number;
    meetingType: string;
    subject:     string;
    bodyHtml?:   string;
    startIso:    string;  // "2026-04-10T10:00:00"
    durationMins?: number;
    attendees:   string[];
  };

  const { njId, meetingType, subject, startIso, attendees } = body;
  const durationMins = body.durationMins ?? 30;

  // Compute end time
  const start = new Date(startIso);
  const end   = new Date(start.getTime() + durationMins * 60_000);
  const endIso = end.toISOString().replace("Z", "").slice(0, 19);
  const startLocal = startIso.slice(0, 19);

  const bodyHtml = body.bodyHtml ?? `<p>Meeting: <strong>${subject}</strong></p><p>Please join via Teams link.</p>`;

  let teamsEventId: string | null = null;
  let teamsJoinUrl: string | null = null;
  let eventFailed = false;

  try {
    const event = await createCalendarEvent({
      subject,
      bodyHtml,
      startIso: startLocal,
      endIso,
      attendees,
      isOnlineMeeting: true,
    });
    teamsEventId = event.id;
    teamsJoinUrl = event.joinUrl;
  } catch (err) {
    console.error("Calendar event creation failed:", err);
    eventFailed = true;
  }

  await db.insert(meetingLogs).values({
    njId,
    meetingType,
    scheduledAt:  startIso,
    durationMins,
    subject,
    attendees:    JSON.stringify(attendees),
    teamsEventId,
    teamsJoinUrl,
    status:       eventFailed ? "Cancelled" : "Scheduled",
    createdBy:    session.user?.email ?? session.user?.name ?? "unknown",
    createdAt:    new Date().toISOString(),
  });

  if (eventFailed) {
    return NextResponse.json({ error: "Calendar event creation failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, teamsJoinUrl });
}

// ── GET: fetch meetings for an NJ ─────────────────────────────────────────────

import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const njId = parseInt(new URL(req.url).searchParams.get("njId") ?? "", 10);
  if (isNaN(njId)) return NextResponse.json({ error: "njId required" }, { status: 400 });

  const meetings = await db
    .select()
    .from(meetingLogs)
    .where(eq(meetingLogs.njId, njId))
    .all();

  meetings.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return NextResponse.json(meetings);
}

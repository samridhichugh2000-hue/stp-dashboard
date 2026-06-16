import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getGraphToken } from "@/lib/msGraph";

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

export interface CalendarEvent {
  id:       string;
  subject:  string;
  start:    string; // ISO
  end:      string; // ISO
  isAllDay: boolean;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const nj = await db
    .select({ email: newJoiners.email })
    .from(newJoiners)
    .where(eq(newJoiners.id, Number(id)))
    .get();

  if (!nj?.email) {
    return NextResponse.json({ events: [], noEmail: true });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") ?? new Date().toISOString().slice(0, 10);
  const endDate   = searchParams.get("endDate")   ?? new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  // calendarView needs full ISO datetimes
  const startIso = `${startDate}T00:00:00`;
  const endIso   = `${endDate}T23:59:59`;

  try {
    const token = await getGraphToken();
    const url =
      `${GRAPH_URL}/users/${encodeURIComponent(nj.email)}/calendarView` +
      `?startDateTime=${encodeURIComponent(startIso)}` +
      `&endDateTime=${encodeURIComponent(endIso)}` +
      `&$select=id,subject,start,end,isAllDay` +
      `&$orderby=start/dateTime` +
      `&$top=100`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="India Standard Time"' },
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Graph error: ${txt}` }, { status: 502 });
    }

    const data = await res.json();
    const events: CalendarEvent[] = (data.value ?? []).map((e: {
      id: string;
      subject: string;
      start: { dateTime: string };
      end: { dateTime: string };
      isAllDay: boolean;
    }) => ({
      id:       e.id,
      subject:  e.subject,
      start:    e.start.dateTime,
      end:      e.end.dateTime,
      isAllDay: e.isAllDay,
    }));

    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

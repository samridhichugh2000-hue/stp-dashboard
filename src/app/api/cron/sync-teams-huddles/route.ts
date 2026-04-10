import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/lib/db";
import { newJoiners, huddleLogs, nrRecords, syncLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

const MODULE = "teams_huddles";

// ── Date helpers ──────────────────────────────────────────────────────────────

function workingDaysSince(dojISO: string): number {
  const doj = new Date(dojISO);
  doj.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Returns the ISO dates of working days fromDay..toDay (1-indexed) after doj */
function computeWorkingDayRange(dojISO: string, fromDay: number, toDay: number): string[] {
  const doj = new Date(dojISO);
  const dates: string[] = [];
  let workingDayCount = 0;
  let offset = 1;
  while (workingDayCount < toDay) {
    const d = new Date(doj);
    d.setDate(doj.getDate() + offset);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      workingDayCount++;
      if (workingDayCount >= fromDay) {
        dates.push(d.toISOString().split("T")[0]);
      }
    }
    offset++;
    if (offset > 40) break;
  }
  return dates;
}

// ── Microsoft Graph helpers ───────────────────────────────────────────────────

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Teams token failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  onlineMeeting?: { joinUrl?: string } | null;
}

async function fetchCalendarEvents(token: string, userEmail: string, startDate: string, endDate: string): Promise<GraphEvent[]> {
  let url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/calendarView` +
    `?startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z` +
    `&$select=id,subject,start,end,onlineMeeting&$top=100`;

  const events: GraphEvent[] = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } });
    if (!res.ok) throw new Error(`Graph calendarView failed (${res.status}): ${await res.text()}`);
    const data = await res.json() as { value: GraphEvent[]; "@odata.nextLink"?: string };
    events.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? "";
  }
  return events;
}

async function fetchMeetingId(token: string, userEmail: string, joinUrl: string): Promise<string | null> {
  const filter = `JoinWebUrl eq '${joinUrl.replace(/'/g, "''")}'`;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/onlineMeetings` +
    `?$filter=${encodeURIComponent(filter)}&$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { value?: Array<{ id: string }> };
  return data.value?.[0]?.id ?? null;
}

async function fetchAttendees(token: string, userEmail: string, meetingId: string): Promise<string[]> {
  const reportsRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}` +
    `/onlineMeetings/${meetingId}/attendanceReports?$orderby=meetingEndDateTime desc&$top=1&$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!reportsRes.ok) return [];
  const reportsData = await reportsRes.json() as { value?: Array<{ id: string }> };
  const reportId = reportsData.value?.[0]?.id;
  if (!reportId) return [];

  const recordsRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}` +
    `/onlineMeetings/${meetingId}/attendanceReports/${reportId}/attendanceRecords` +
    `?$select=attendee,totalAttendanceInSeconds`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!recordsRes.ok) return [];
  const recordsData = await recordsRes.json() as { value?: Array<{ attendee?: { emailAddress?: string } }> };
  return (recordsData.value ?? [])
    .map(r => r.attendee?.emailAddress?.toLowerCase() ?? "")
    .filter(Boolean);
}

// ── Attendance check (shared logic) ──────────────────────────────────────────

async function checkCompleted(
  matched: { joinUrl?: string; endDateTime: string; id: string } | undefined,
  njEmailLower: string,
  nowISO: string,
  token: string,
  calendarOwnerEmail: string,
  attendeeCache: Map<string, string[]>,
): Promise<boolean> {
  if (!matched) return false;
  const ended = new Date(matched.endDateTime) < new Date(nowISO);
  if (!matched.joinUrl) return true;                    // In-person
  if (!ended) return false;                             // Not finished yet
  if (!njEmailLower) return true;                       // No email → existence = done
  let attendees = attendeeCache.get(matched.joinUrl);
  if (!attendees) {
    const meetingId = await fetchMeetingId(token, calendarOwnerEmail, matched.joinUrl);
    attendees = meetingId ? await fetchAttendees(token, calendarOwnerEmail, meetingId) : [];
    attendeeCache.set(matched.joinUrl, attendees);
  }
  return attendees.includes(njEmailLower);
}

// ── Title matching ────────────────────────────────────────────────────────────

/** Returns true if a calendar event subject matches a huddle for this NJ.
 *  Accepted formats (case-insensitive):
 *    "Huddle with HR - <firstName>"      ← legacy
 *    "Daily STP Huddle — <firstName>"    ← scheduled by dashboard
 */
function isHuddleForNJ(subject: string, njFirstName: string): boolean {
  const s = subject.toLowerCase();
  const n = njFirstName.toLowerCase();
  return s.includes(`huddle with hr - ${n}`) || s.includes(`daily stp huddle \u2014 ${n}`);
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertHuddle(
  njId: number,
  date: string,
  completed: boolean,
  conductedBy: string,
  isExtended: boolean,
  teamsEventId?: string,
) {
  const existing = await db.select({ id: huddleLogs.id })
    .from(huddleLogs)
    .where(and(eq(huddleLogs.njId, njId), eq(huddleLogs.date, date)))
    .get();

  if (existing) {
    await db.update(huddleLogs)
      .set({ completed, isExtended, teamsEventId: teamsEventId ?? null })
      .where(eq(huddleLogs.id, existing.id));
  } else {
    await db.insert(huddleLogs).values({
      njId,
      date,
      type: "Daily",
      conductedBy,
      completed,
      isExtended,
      teamsEventId: teamsEventId ?? null,
    });
  }
}

async function upsertSyncLog(status: "running" | "success" | "error", extra: { errorMessage?: string; recordsProcessed?: number } = {}) {
  await client.execute({
    sql: `INSERT INTO sync_logs (module, last_sync_at, status, error_message, records_processed)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(module) DO UPDATE SET
            last_sync_at = excluded.last_sync_at,
            status = excluded.status,
            error_message = excluded.error_message,
            records_processed = excluded.records_processed`,
    args: [MODULE, new Date().toISOString(), status, extra.errorMessage ?? null, extra.recordsProcessed ?? null],
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get("authorization");
  const legacyHeader = req.headers.get("x-cron-secret");
  const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validLegacy = legacyHeader === process.env.CRON_SECRET || legacyHeader === "stp-cron-2026";
  if (!validBearer && !validLegacy) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId           = process.env.TEAMS_TENANT_ID;
  const clientId           = process.env.TEAMS_CLIENT_ID;
  const clientSecret       = process.env.TEAMS_CLIENT_SECRET;
  const calendarOwnerEmail = process.env.TEAMS_CALENDAR_OWNER_EMAIL;

  if (!tenantId || !clientId || !clientSecret || !calendarOwnerEmail) {
    return NextResponse.json({
      error: "Missing env vars: TEAMS_TENANT_ID, TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET, TEAMS_CALENDAR_OWNER_EMAIL",
    }, { status: 500 });
  }

  await upsertSyncLog("running");

  try {
    const today  = new Date().toISOString().split("T")[0];
    const nowISO = new Date().toISOString();

    // 1. Active NJs still in monitoring window (standard 14 days + up to 4 extended days)
    const allNJs    = await db.select().from(newJoiners).where(eq(newJoiners.isActive, true)).all();
    const activeNJs = allNJs.filter(nj => workingDaysSince(nj.joinDate) <= 18);

    if (activeNJs.length === 0) {
      await upsertSyncLog("success", { recordsProcessed: 0 });
      return NextResponse.json({ ok: true, message: "No NJs in huddle window", count: 0 });
    }

    // 2. Get Graph access token
    const token = await getAccessToken(tenantId, clientId, clientSecret);

    // 3. Fetch calendar events covering all expected huddle dates (normal + extended)
    const allDates    = activeNJs.flatMap(nj => computeWorkingDayRange(nj.joinDate, 1, 18));
    const startDate   = allDates.reduce((a, b) => (a < b ? a : b));
    const events      = await fetchCalendarEvents(token, calendarOwnerEmail, startDate, today);

    // 4. Build date → events lookup
    const eventsByDate: Record<string, Array<{ subject: string; id: string; joinUrl?: string; endDateTime: string }>> = {};
    for (const ev of events) {
      if (!ev.start?.dateTime) continue;
      const evDate = ev.start.dateTime.split("T")[0];
      if (!eventsByDate[evDate]) eventsByDate[evDate] = [];
      eventsByDate[evDate].push({
        subject:     (ev.subject ?? "").toLowerCase(),
        id:          ev.id,
        joinUrl:     ev.onlineMeeting?.joinUrl ?? undefined,
        endDateTime: ev.end?.dateTime ?? ev.start.dateTime,
      });
    }

    // 5. Attendee cache to avoid duplicate Graph calls
    const attendeeCache = new Map<string, string[]>();
    let count = 0;

    for (const nj of activeNJs) {
      const wds          = workingDaysSince(nj.joinDate);
      const njFirstName  = nj.name.split(" ")[0].toLowerCase();
      const njEmailLower = (nj.email ?? "").toLowerCase();

      // ── Standard 14-day window ─────────────────────────────────────────────
      const normalDates = computeWorkingDayRange(nj.joinDate, 1, 14).filter(d => d <= today);

      for (const date of normalDates) {
        const dayEvents = eventsByDate[date] ?? [];
        const matched   = dayEvents.find(e => isHuddleForNJ(e.subject, njFirstName));
        const completed = await checkCompleted(matched, njEmailLower, nowISO, token, calendarOwnerEmail, attendeeCache);
        await upsertHuddle(nj.id, date, completed, calendarOwnerEmail, false, matched?.id);
        count++;
      }

      // ── Extended window: days 15-18 ────────────────────────────────────────
      // Only log if a matching meeting is found. The moment a day has no meeting,
      // the extension is considered over → transition to Developed/Non-Performer.
      if (wds >= 15 && nj.category === "Uncategorised") {
        const allExtendedDates = computeWorkingDayRange(nj.joinDate, 15, 18);
        const pastExtendedDates = allExtendedDates.filter(d => d < today); // strictly past days
        const todayExtended     = allExtendedDates.find(d => d === today);
        let extendedCompleted   = 0;
        let extensionBroken     = false;

        // Check all past extended days — if any has no meeting, extension is broken
        for (const date of pastExtendedDates) {
          const dayEvents = eventsByDate[date] ?? [];
          const matched   = dayEvents.find(e => isHuddleForNJ(e.subject, njFirstName));
          if (!matched) {
            extensionBroken = true;
            break;
          }
          const completed = await checkCompleted(matched, njEmailLower, nowISO, token, calendarOwnerEmail, attendeeCache);
          await upsertHuddle(nj.id, date, completed, calendarOwnerEmail, true, matched.id);
          if (completed) extendedCompleted++;
          count++;
        }

        // Process today's extended date if extension is still intact
        if (!extensionBroken && todayExtended) {
          const dayEvents = eventsByDate[todayExtended] ?? [];
          const matched   = dayEvents.find(e => isHuddleForNJ(e.subject, njFirstName));
          if (!matched) {
            extensionBroken = true; // No meeting found today → extension over
          } else {
            const completed = await checkCompleted(matched, njEmailLower, nowISO, token, calendarOwnerEmail, attendeeCache);
            await upsertHuddle(nj.id, todayExtended, completed, calendarOwnerEmail, true, matched.id);
            if (completed) extendedCompleted++;
            count++;
          }
        }

        // Update stp_extended_days if changed
        if (extendedCompleted !== nj.stpExtendedDays) {
          await db.update(newJoiners)
            .set({ stpExtendedDays: extendedCompleted })
            .where(eq(newJoiners.id, nj.id));
        }

        // Transition: extension broken OR hard cutoff at day 19
        if (extensionBroken || wds >= 19) {
          const njNR        = await db.select().from(nrRecords).where(eq(nrRecords.njId, nj.id)).all();
          const isDeveloped = njNR.some(r => r.isPositive);
          await db.update(newJoiners)
            .set({ category: isDeveloped ? "Developed" : "Non-Performer" })
            .where(eq(newJoiners.id, nj.id));
        }
      }
    }

    await upsertSyncLog("success", { recordsProcessed: count });
    return NextResponse.json({ ok: true, njsProcessed: activeNJs.length, huddlesUpserted: count });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog("error", { errorMessage: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

"use node";
/**
 * Microsoft Teams / Graph API huddle sync.
 *
 * Required Convex environment variables:
 *   TEAMS_TENANT_ID            — Azure AD tenant ID
 *   TEAMS_CLIENT_ID            — App registration client ID
 *   TEAMS_CLIENT_SECRET        — App registration client secret
 *   TEAMS_CALENDAR_OWNER_EMAIL — Work email of the calendar owner (who creates huddle meetings)
 *
 * Azure AD app needs these application permissions (grant admin consent):
 *   Calendars.Read              — read calendar events
 *   OnlineMeetings.Read         — look up meeting ID from join URL
 *   OnlineMeetingArtifact.Read.All — read attendance reports
 *
 * Meeting subject format must be: "Huddle with HR - <NJ Full Name>"
 * Huddles are synced for NJs whose DOJ is within the last 14 days.
 * Expected huddle days: day 2 through day 14 from DOJ (weekdays only, Mon–Fri).
 *
 * Completion logic:
 *   - Teams meeting ended  → completed = NJ's email found in attendance report
 *   - Teams meeting not yet ended → completed = false (will update on next sync)
 *   - Non-Teams / in-person meeting → completed = true (meeting existence = done)
 *   - No matching event → completed = false
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const MODULE = "teams_huddles";

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD strings for Mon–Fri, day 2 through day 14 from DOJ. */
function computeHuddleDates(dojISO: string): string[] {
  const doj = new Date(dojISO);
  const dates: string[] = [];
  for (let offset = 1; offset <= 13; offset++) {
    const d = new Date(doj);
    d.setDate(doj.getDate() + offset);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }
  return dates;
}

/** True if DOJ is within the last `days` calendar days. */
function isWithinLastNDays(dojISO: string, days: number): boolean {
  const doj = new Date(dojISO);
  doj.setHours(0, 0, 0, 0);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return doj >= cutoff;
}

// ── Graph API helpers ────────────────────────────────────────────────────────

/** Fetch an OAuth2 access token via client credentials flow. */
async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams token fetch failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  onlineMeeting?: { joinUrl?: string } | null;
}

/** Fetch calendar events in range, with end time and Teams join URL. Handles pagination. */
async function fetchCalendarEvents(
  token: string,
  userEmail: string,
  startDate: string,
  endDate: string
): Promise<GraphEvent[]> {
  const startISO = `${startDate}T00:00:00Z`;
  const endISO = `${endDate}T23:59:59Z`;

  let url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/calendarView` +
    `?startDateTime=${startISO}&endDateTime=${endISO}` +
    `&$select=id,subject,start,end,onlineMeeting&$top=100`;

  const events: GraphEvent[] = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph calendarView failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { value: GraphEvent[]; "@odata.nextLink"?: string };
    events.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? "";
  }
  return events;
}

/**
 * Look up the online meeting ID from a Teams join URL.
 * Requires OnlineMeetings.Read application permission.
 */
async function fetchMeetingId(
  token: string,
  userEmail: string,
  joinUrl: string
): Promise<string | null> {
  const filter = `JoinWebUrl eq '${joinUrl.replace(/'/g, "''")}'`;
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/onlineMeetings` +
    `?$filter=${encodeURIComponent(filter)}&$select=id`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { value?: Array<{ id: string }> };
  return data.value?.[0]?.id ?? null;
}

/**
 * Returns lowercase email addresses of everyone who attended the meeting.
 * Requires OnlineMeetingArtifact.Read.All application permission.
 */
async function fetchAttendees(
  token: string,
  userEmail: string,
  meetingId: string
): Promise<string[]> {
  // Get the most recent attendance report
  const reportsUrl =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}` +
    `/onlineMeetings/${meetingId}/attendanceReports?$orderby=meetingEndDateTime desc&$top=1&$select=id`;

  const reportsRes = await fetch(reportsUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!reportsRes.ok) return [];
  const reportsData = (await reportsRes.json()) as { value?: Array<{ id: string }> };
  const reportId = reportsData.value?.[0]?.id;
  if (!reportId) return [];

  // Get the individual attendance records
  const recordsUrl =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}` +
    `/onlineMeetings/${meetingId}/attendanceReports/${reportId}/attendanceRecords` +
    `?$select=attendee,totalAttendanceInSeconds`;

  const recordsRes = await fetch(recordsUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!recordsRes.ok) return [];
  const recordsData = (await recordsRes.json()) as {
    value?: Array<{ attendee?: { emailAddress?: string } }>;
  };

  return (recordsData.value ?? [])
    .map((r) => r.attendee?.emailAddress?.toLowerCase() ?? "")
    .filter(Boolean);
}

// ── Main action ──────────────────────────────────────────────────────────────

export const syncTeamsHuddles = internalAction({
  args: {},
  handler: async (ctx) => {
    const tenantId = process.env.TEAMS_TENANT_ID;
    const clientId = process.env.TEAMS_CLIENT_ID;
    const clientSecret = process.env.TEAMS_CLIENT_SECRET;
    const calendarOwnerEmail = process.env.TEAMS_CALENDAR_OWNER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !calendarOwnerEmail) {
      throw new Error(
        "Missing Teams env vars. Set TEAMS_TENANT_ID, TEAMS_CLIENT_ID, " +
          "TEAMS_CLIENT_SECRET, TEAMS_CALENDAR_OWNER_EMAIL via: npx convex env set <KEY> <VALUE>"
      );
    }

    await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
      module: MODULE,
      status: "running",
      lastSyncAt: new Date().toISOString(),
    });

    try {
      // 1. Get active NJs with DOJ within last 14 days
      const allNJs = await ctx.runQuery(internal.queries.newJoiners.listAllInternal, {});
      const recentNJs = allNJs.filter((nj) => nj.isActive && isWithinLastNDays(nj.joinDate, 14));

      if (recentNJs.length === 0) {
        await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
          module: MODULE,
          status: "success",
          lastSyncAt: new Date().toISOString(),
          recordsProcessed: 0,
        });
        return;
      }

      // 2. Get access token
      const token = await getAccessToken(tenantId, clientId, clientSecret);

      // 3. Fetch calendar events for the date range (includes end time + Teams join URL)
      const today = new Date().toISOString().split("T")[0];
      const nowISO = new Date().toISOString();
      const allExpectedDates = recentNJs.flatMap((nj) => computeHuddleDates(nj.joinDate));
      const startDate = allExpectedDates.reduce((a, b) => (a < b ? a : b));
      const events = await fetchCalendarEvents(token, calendarOwnerEmail, startDate, today);

      // 4. Build date → events lookup (keep full event data for attendance checks)
      const eventsByDate: Record<
        string,
        Array<{ subject: string; id: string; joinUrl?: string; endDateTime: string }>
      > = {};
      for (const ev of events) {
        if (!ev.start?.dateTime) continue;
        const evDate = ev.start.dateTime.split("T")[0];
        if (!eventsByDate[evDate]) eventsByDate[evDate] = [];
        eventsByDate[evDate].push({
          subject: (ev.subject ?? "").toLowerCase(),
          id: ev.id,
          joinUrl: ev.onlineMeeting?.joinUrl ?? undefined,
          endDateTime: ev.end?.dateTime ?? ev.start.dateTime,
        });
      }

      // 5. Cache joinUrl → attendees to avoid redundant API calls per meeting
      const attendeeCache = new Map<string, string[]>();

      // 6. Upsert huddle logs per NJ × date
      let count = 0;
      for (const nj of recentNJs) {
        const njNameLower = nj.name.toLowerCase();
        const njEmailLower = (nj.email ?? "").toLowerCase();
        const huddleDates = computeHuddleDates(nj.joinDate).filter((d) => d <= today);

        for (const date of huddleDates) {
          const dayEvents = eventsByDate[date] ?? [];
          const matchedEvent = dayEvents.find((e) =>
            e.subject.includes(`huddle with hr - ${njNameLower}`)
          );

          let completed = false;

          if (matchedEvent) {
            const meetingEnded = matchedEvent.endDateTime < nowISO;

            if (!matchedEvent.joinUrl) {
              // In-person / non-Teams meeting — existence means done
              completed = true;
            } else if (!meetingEnded) {
              // Teams meeting scheduled but not yet finished — leave as pending
              completed = false;
            } else if (!njEmailLower) {
              // Teams meeting ended but NJ has no email stored — fall back to existence
              completed = true;
            } else {
              // Teams meeting ended — check if NJ actually joined
              let attendees = attendeeCache.get(matchedEvent.joinUrl);
              if (!attendees) {
                const meetingId = await fetchMeetingId(
                  token,
                  calendarOwnerEmail,
                  matchedEvent.joinUrl
                );
                attendees = meetingId
                  ? await fetchAttendees(token, calendarOwnerEmail, meetingId)
                  : [];
                attendeeCache.set(matchedEvent.joinUrl, attendees);
              }
              completed = attendees.includes(njEmailLower);
            }
          }

          await ctx.runMutation(internal.mutations.huddleLogs.upsertHuddle, {
            njId: nj._id as Id<"newJoiners">,
            date,
            completed,
            conductedBy: calendarOwnerEmail,
            teamsEventId: matchedEvent?.id,
          });
          count++;
        }
      }

      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "success",
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: count,
      });
    } catch (err) {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "error",
        lastSyncAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
});

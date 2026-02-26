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
 * Azure AD app needs application permission: Calendars.Read
 * (grant admin consent in Azure Portal → App registrations → API permissions)
 *
 * Meeting subject format must be: "Huddle with HR - <NJ Full Name>"
 * Huddles are synced for NJs whose DOJ is within the last 14 days.
 * Expected huddle days: day 2 through day 14 from DOJ (weekdays only, Mon–Fri).
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const MODULE = "teams_huddles";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD strings for Mon–Fri, day 2 through day 14 from DOJ. */
function computeHuddleDates(dojISO: string): string[] {
  const doj = new Date(dojISO);
  const dates: string[] = [];
  for (let offset = 1; offset <= 13; offset++) {
    const d = new Date(doj);
    d.setDate(doj.getDate() + offset);
    const dow = d.getDay(); // 0=Sun, 6=Sat
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
}

/**
 * Fetch calendar events between startDate and endDate (YYYY-MM-DD) for a user.
 * Handles OData @odata.nextLink pagination automatically.
 */
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
    `&$select=id,subject,start&$top=100`;

  const events: GraphEvent[] = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph calendarView failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      value: GraphEvent[];
      "@odata.nextLink"?: string;
    };

    events.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? "";
  }

  return events;
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
      // 1. Get all active NJs
      const allNJs = await ctx.runQuery(internal.queries.newJoiners.listAllInternal, {});
      const activeNJs = allNJs.filter((nj) => nj.isActive);

      // 2. Keep only NJs whose DOJ is within the last 14 days
      const recentNJs = activeNJs.filter((nj) => isWithinLastNDays(nj.joinDate, 14));

      if (recentNJs.length === 0) {
        await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
          module: MODULE,
          status: "success",
          lastSyncAt: new Date().toISOString(),
          recordsProcessed: 0,
        });
        return;
      }

      // 3. Get access token
      const token = await getAccessToken(tenantId, clientId, clientSecret);

      // 4. Determine date range to query: earliest expected huddle date → today
      const today = new Date().toISOString().split("T")[0];
      const allExpectedDates = recentNJs.flatMap((nj) => computeHuddleDates(nj.joinDate));
      const startDate = allExpectedDates.reduce((a, b) => (a < b ? a : b));

      // 5. Fetch all calendar events in range
      const events = await fetchCalendarEvents(token, calendarOwnerEmail, startDate, today);

      // 6. Build date → [{ subject, eventId }] lookup
      const eventsByDate: Record<string, Array<{ subject: string; id: string }>> = {};
      for (const ev of events) {
        if (!ev.start?.dateTime) continue;
        const evDate = ev.start.dateTime.split("T")[0];
        if (!eventsByDate[evDate]) eventsByDate[evDate] = [];
        eventsByDate[evDate].push({ subject: (ev.subject ?? "").toLowerCase(), id: ev.id });
      }

      // 7. Upsert huddle logs for each NJ × expected date
      let count = 0;
      for (const nj of recentNJs) {
        const huddleDates = computeHuddleDates(nj.joinDate).filter((d) => d <= today);
        const njNameLower = nj.name.toLowerCase();

        for (const date of huddleDates) {
          const dayEvents = eventsByDate[date] ?? [];
          const matchedEvent = dayEvents.find((e) =>
            e.subject.includes(`huddle with hr - ${njNameLower}`)
          );

          await ctx.runMutation(internal.mutations.huddleLogs.upsertHuddle, {
            njId: nj._id as Id<"newJoiners">,
            date,
            completed: !!matchedEvent,
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

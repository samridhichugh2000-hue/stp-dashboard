/**
 * Microsoft Graph API utility
 * Uses Client Credentials flow (app-level, no user login required)
 * Permissions needed on Azure AD app (Application type, admin consent granted):
 *   Mail.Send, Calendars.ReadWrite
 */

// Fall back to OUTLOOK_ vars if TEAMS_ vars are not separately configured
const TENANT_ID     = process.env.TEAMS_TENANT_ID     ?? process.env.OUTLOOK_TENANT_ID    ?? "98deb14a-8f2f-48b2-807f-8a97c96a0ca3";
const CLIENT_ID     = process.env.TEAMS_CLIENT_ID     ?? process.env.OUTLOOK_CLIENT_ID    ?? "dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2";
const CLIENT_SECRET = process.env.TEAMS_CLIENT_SECRET ?? process.env.OUTLOOK_CLIENT_SECRET ?? "";
const SENDER_EMAIL  = process.env.TEAMS_CALENDAR_OWNER_EMAIL ?? process.env.OUTLOOK_MAILBOX ?? "";

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_URL = "https://graph.microsoft.com/v1.0";

// ── Token cache (in-memory, reused until expiry) ──────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getGraphToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         "https://graph.microsoft.com/.default",
      grant_type:    "client_credentials",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph token error: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── Email ─────────────────────────────────────────────────────────────────────

export interface EmailPayload {
  to:       string[];
  cc?:      string[];
  subject:  string;
  bodyHtml: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const token = await getGraphToken();

  const message = {
    subject: payload.subject,
    body: { contentType: "HTML", content: payload.bodyHtml },
    toRecipients:  payload.to.map(e => ({ emailAddress: { address: e } })),
    ccRecipients:  (payload.cc ?? []).map(e => ({ emailAddress: { address: e } })),
  };

  const res = await fetch(`${GRAPH_URL}/users/${SENDER_EMAIL}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sendEmail failed: ${err}`);
  }
}

// ── Calendar / Teams Meeting ───────────────────────────────────────────────────
// Uses POST /users/{id}/events with isOnlineMeeting:true
// Permissions needed: Calendars.ReadWrite (Application, admin consent)
// Graph creates the real Teams meeting and sends proper calendar invites to attendees.
// We also send a separate custom HTML notification email.

export interface CalendarEventPayload {
  subject:          string;
  bodyHtml:         string;
  startIso:         string; // "YYYY-MM-DDTHH:MM:00" in IST
  endIso:           string;
  timeZone?:        string;
  attendees:        string[];
  isOnlineMeeting?: boolean;
  rrule?:           string; // "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=10" or "FREQ=WEEKLY;COUNT=10"
}

export interface CreatedEvent {
  id:      string;
  joinUrl: string | null;
  webLink: string;
}

/** Convert RRULE string → Graph recurrence object */
function buildRecurrence(rrule: string, startDateISO: string) {
  const count = Number(rrule.match(/COUNT=(\d+)/)?.[1] ?? 10);
  const freq  = /FREQ=DAILY/.test(rrule) ? "daily" : "weekly";
  const startDate = startDateISO.slice(0, 10); // "YYYY-MM-DD"

  return {
    pattern: freq === "daily"
      ? { type: "weekly", interval: 1, daysOfWeek: ["monday","tuesday","wednesday","thursday","friday"] }
      : { type: "weekly", interval: 1 },
    range: { type: "numbered", startDate, numberOfOccurrences: count },
  };
}

export async function createCalendarEvent(
  payload: CalendarEventPayload
): Promise<CreatedEvent> {
  // Fresh token every call so permission changes take effect immediately
  cachedToken = null; tokenExpiry = 0;
  const token = await getGraphToken();

  const tz        = payload.timeZone ?? "India Standard Time";
  const startDT   = new Date(payload.startIso + "+05:30").toISOString();
  const endDT     = new Date(payload.endIso   + "+05:30").toISOString();

  const eventBody: Record<string, unknown> = {
    subject: payload.subject,
    body:    { contentType: "HTML", content: payload.bodyHtml },
    start:   { dateTime: startDT, timeZone: tz },
    end:     { dateTime: endDT,   timeZone: tz },
    attendees: payload.attendees.map(e => ({
      emailAddress: { address: e },
      type: "required",
    })),
    isOnlineMeeting:       true,
    onlineMeetingProvider: "teamsForBusiness",
    allowNewTimeProposals: false,
  };

  if (payload.rrule) {
    eventBody.recurrence = buildRecurrence(payload.rrule, payload.startIso);
  }

  // Step 1: Create calendar event → Graph sends proper Teams invite to all attendees
  const evtRes = await fetch(`${GRAPH_URL}/users/${SENDER_EMAIL}/events`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!evtRes.ok) {
    const err = await evtRes.text();
    throw new Error(`createCalendarEvent failed (${evtRes.status}): ${err}`);
  }

  const evtData = await evtRes.json() as {
    id:      string;
    webLink: string;
    onlineMeeting?: { joinUrl?: string };
  };

  const eventId = evtData.id;
  const joinUrl = evtData.onlineMeeting?.joinUrl ?? null;
  const webLink = evtData.webLink ?? "";

  // Step 2: Send our custom notification email with the Teams join link
  // (Graph already sent the standard calendar invite; this is the NJ-details notification)
  const joinSection = joinUrl
    ? `<div style="margin:20px 0;padding:16px 20px;background:#f5f5f5;border-left:4px solid #6264a7;font-family:'Segoe UI',sans-serif">
        <div style="font-size:14px;font-weight:600;color:#252424;margin-bottom:10px">Microsoft Teams meeting</div>
        <a href="${joinUrl}" style="display:inline-block;background:#6264a7;color:#ffffff;font-size:13px;font-weight:600;padding:8px 20px;border-radius:4px;text-decoration:none">Join</a>
      </div>`
    : "";

  const notifMessage = {
    subject: payload.subject,
    body:    { contentType: "HTML", content: `${payload.bodyHtml}${joinSection}` },
    toRecipients: payload.attendees.map(e => ({ emailAddress: { address: e } })),
  };

  const mailRes = await fetch(`${GRAPH_URL}/users/${SENDER_EMAIL}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: notifMessage, saveToSentItems: false }),
  });

  if (!mailRes.ok) {
    // Don't fail the whole thing — event is already created
    console.error("[msGraph] notification email failed:", await mailRes.text());
  }

  return { id: eventId, joinUrl, webLink };
}

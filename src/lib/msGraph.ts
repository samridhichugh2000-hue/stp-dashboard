/**
 * Microsoft Graph API utility
 * Uses Client Credentials flow (app-level, no user login required)
 * Permissions needed on Azure AD app:
 *   Mail.Send, Calendars.ReadWrite (Application permissions)
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

// ── Calendar ──────────────────────────────────────────────────────────────────

export interface CalendarEventPayload {
  subject:      string;
  bodyHtml:     string;
  startIso:     string; // e.g. "2026-04-10T10:00:00"
  endIso:       string;
  timeZone?:    string; // default "India Standard Time"
  attendees:    string[]; // email addresses
  isOnlineMeeting?: boolean;
}

export interface CreatedEvent {
  id:          string;
  joinUrl:     string | null;
  webLink:     string;
}

export async function createCalendarEvent(
  payload: CalendarEventPayload
): Promise<CreatedEvent> {
  const token = await getGraphToken();
  const tz = payload.timeZone ?? "India Standard Time";

  const body = {
    subject: payload.subject,
    body:    { contentType: "HTML", content: payload.bodyHtml },
    start:   { dateTime: payload.startIso, timeZone: tz },
    end:     { dateTime: payload.endIso,   timeZone: tz },
    attendees: payload.attendees.map(e => ({
      emailAddress: { address: e },
      type: "required",
    })),
    isOnlineMeeting:       payload.isOnlineMeeting ?? true,
    onlineMeetingProvider: "teamsForBusiness",
  };

  const res = await fetch(`${GRAPH_URL}/users/${SENDER_EMAIL}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`createCalendarEvent failed: ${err}`);
  }

  const data = await res.json() as {
    id: string;
    webLink: string;
    onlineMeeting?: { joinUrl?: string };
  };

  return {
    id:      data.id,
    joinUrl: data.onlineMeeting?.joinUrl ?? null,
    webLink: data.webLink,
  };
}

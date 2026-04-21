/**
 * GET /api/cron/dsr-reminder
 *
 * Runs at 16:30, 19:00, 21:00 UTC on weekdays.
 * For each run, processes NJs whose local time is currently ~22:00 (10 PM).
 * If their DSR is missing for today (in their timezone), sends a reminder
 * email to their personal email address — once per NJ per day.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/lib/db";
import { newJoiners, dsrSubmissions, reminderLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const TENANT_ID     = process.env.OUTLOOK_TENANT_ID    ?? "98deb14a-8f2f-48b2-807f-8a97c96a0ca3";
const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID     ?? "dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2";
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET!;
const MAILBOX       = process.env.OUTLOOK_MAILBOX!;

// ── Timezone map: location keyword → UTC offset in hours ─────────────────────
// Matched case-insensitively against nj.location

const LOCATION_TZ: Array<[string, number]> = [
  // India (IST = UTC+5:30)
  ["india",      5.5], ["delhi",      5.5], ["new delhi",   5.5],
  ["mumbai",     5.5], ["bangalore",  5.5], ["bengaluru",   5.5],
  ["chennai",    5.5], ["hyderabad",  5.5], ["kolkata",     5.5],
  ["pune",       5.5], ["jaipur",     5.5], ["ahmedabad",   5.5],
  ["noida",      5.5], ["gurugram",   5.5], ["gurgaon",     5.5],
  // Nigeria / West Africa (WAT = UTC+1)
  ["lagos",      1],   ["nigeria",    1],   ["abuja",       1],
  // Kenya / East Africa (EAT = UTC+3)
  ["nairobi",    3],   ["kenya",      3],   ["mombasa",     3],
  // UAE / Gulf (GST = UTC+4)
  ["dubai",      4],   ["abu dhabi",  4],   ["uae",         4],
  ["sharjah",    4],   ["doha",       3],   ["qatar",       3],
  ["riyadh",     3],   ["saudi",      3],
  // UK (GMT = UTC+0)
  ["london",     0],   ["uk",         0],   ["manchester",  0],
  // South Africa (SAST = UTC+2)
  ["johannesburg", 2], ["south africa", 2], ["cape town",   2],
  // Default fallback handled separately
];

function tzOffset(location: string | null): number {
  if (!location) return 5.5; // default IST
  const loc = location.toLowerCase();
  for (const [key, offset] of LOCATION_TZ) {
    if (loc.includes(key)) return offset;
  }
  return 5.5; // default IST
}

/** Returns the NJ's local time as { hour, date } for a given UTC offset */
function localTimeForOffset(offsetHours: number): { hour: number; minute: number; date: string } {
  const utcMs   = Date.now() + offsetHours * 3_600_000;
  const d       = new Date(utcMs);
  const hour    = d.getUTCHours();
  const minute  = d.getUTCMinutes();
  const date    = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { hour, minute, date };
}

/** True if the NJ's local hour is 22 (10 PM window this cron run covers) */
function isReminderWindow(offsetHours: number): boolean {
  const { hour } = localTimeForOffset(offsetHours);
  return hour === 22;
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

async function getGraphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );
  const d = await res.json();
  if (!d.access_token) throw new Error("Graph token failed");
  return d.access_token;
}

async function sendReminderEmail(token: string, toEmail: string, njName: string, date: string): Promise<void> {
  const firstName = njName.split(" ")[0];
  const displayDate = new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">

        <!-- Header -->
        <tr>
          <td bgcolor="#4f46e5" style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 28px">
            <div style="font-size:10px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">DSR Reminder</div>
            <div style="font-size:22px;font-weight:800;color:#f0f0ff">Daily Sales Report</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e2e8f0;border-top:none">

            <p style="font-size:15px;color:#111827;font-weight:600;margin:0 0 12px">Hi ${firstName},</p>

            <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 16px">
              This is a friendly reminder that your <strong>Daily Sales Report (DSR)</strong> for
              <strong>${displayDate}</strong> has not been received yet.
            </p>

            <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:0 0 20px">
              <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px">⏰ Action Required</div>
              <div style="font-size:12px;color:#78350f;line-height:1.5">
                Please send your DSR email with the subject
                <strong>"Your sales training plan"</strong> before end of day.
              </div>
            </div>

            <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 20px">
              Consistent DSR submissions are tracked as part of your STP evaluation.
              If you have already sent it, please disregard this message.
            </p>

            <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:11px;color:#9ca3af;text-align:center">
              Sent by STP Dashboard &nbsp;·&nbsp; ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>

          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: `Reminder: Please submit your DSR for ${displayDate}`,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: toEmail } }],
        },
        saveToSentItems: "true",
      }),
    }
  );
  if (!res.ok) throw new Error(`sendMail failed ${res.status}: ${await res.text()}`);
}

// ── Working-day helpers ───────────────────────────────────────────────────────

function workingDaysSince(dojISO: string): number {
  const [y, mo, da] = dojISO.split("-").map(Number);
  const doj   = new Date(y, mo - 1, da);
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj); d.setDate(d.getDate() + 1);
  while (d <= today) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronForbidden();

  if (!CLIENT_SECRET || !MAILBOX)
    return NextResponse.json({ error: "Graph credentials not set" }, { status: 500 });

  try {
    // Load all active NJs in STP window (wds ≤ 18, not stpClosed, has email)
    const allNJs = await db.select().from(newJoiners).where(eq(newJoiners.isActive, true)).all();
    const stpNJs = allNJs.filter(nj =>
      !nj.stpClosed &&
      nj.email &&
      workingDaysSince(nj.joinDate) <= 18
    );

    if (stpNJs.length === 0)
      return NextResponse.json({ ok: true, message: "No NJs in STP window", sent: 0 });

    // Already-sent reminders today: load reminder_logs for type DSRReminder
    const todayUTC = new Date().toISOString().split("T")[0];
    const sentTodayRes = await client.execute({
      sql: `SELECT recipient_email FROM reminder_logs
            WHERE reminder_type = 'DSRReminder' AND sent_at >= ? AND status = 'sent'`,
      args: [`${todayUTC}T00:00:00`],
    });
    const alreadySent = new Set(sentTodayRes.rows.map(r => String(r.recipient_email).toLowerCase()));

    let token: string | null = null;
    const results: { name: string; email: string; action: string }[] = [];

    for (const nj of stpNJs) {
      const email  = nj.email!.toLowerCase();
      const offset = tzOffset(nj.location);

      // Only process NJs whose local time is currently in the 10 PM window
      if (!isReminderWindow(offset)) {
        results.push({ name: nj.name, email, action: "skipped — not 10 PM yet" });
        continue;
      }

      if (alreadySent.has(email)) {
        results.push({ name: nj.name, email, action: "skipped — reminder already sent today" });
        continue;
      }

      // Their local today date
      const { date: localToday } = localTimeForOffset(offset);

      // Check if DSR submitted for their local today
      const dsrToday = await db
        .select({ id: dsrSubmissions.id })
        .from(dsrSubmissions)
        .where(and(eq(dsrSubmissions.njId, nj.id), eq(dsrSubmissions.date, localToday)))
        .get();

      if (dsrToday) {
        results.push({ name: nj.name, email, action: "skipped — DSR already submitted" });
        continue;
      }

      // Send reminder
      try {
        if (!token) token = await getGraphToken();
        await sendReminderEmail(token, nj.email!, nj.name, localToday);

        // Log to reminder_logs
        await client.execute({
          sql: `INSERT INTO reminder_logs (recipient_email, recipient_role, reminder_type, sent_at, status)
                VALUES (?, 'nj', 'DSRReminder', ?, 'sent')`,
          args: [email, new Date().toISOString()],
        });

        alreadySent.add(email);
        results.push({ name: nj.name, email, action: "reminder sent" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await client.execute({
          sql: `INSERT INTO reminder_logs (recipient_email, recipient_role, reminder_type, sent_at, status, error_message)
                VALUES (?, 'nj', 'DSRReminder', ?, 'failed', ?)`,
          args: [email, new Date().toISOString(), msg],
        });
        results.push({ name: nj.name, email, action: `error: ${msg}` });
      }
    }

    const sent = results.filter(r => r.action === "reminder sent").length;
    return NextResponse.json({ ok: true, utcTime: new Date().toISOString(), sent, results });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

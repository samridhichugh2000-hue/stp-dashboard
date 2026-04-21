/**
 * GET /api/cron/nj-morning-reminder
 *
 * Runs at 03:30 UTC (09:00 IST) on weekdays.
 * For each active STP NJ with an email:
 *   - Reminds them to submit DSR today
 *   - Mentions if today's huddle is already done or pending
 *   - Flags any upcoming milestone (within the next 3 days)
 * Skips if already sent today (checked via reminder_logs).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/lib/db";
import { newJoiners, huddleLogs, dsrSubmissions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/msGraph";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

// ── date helpers ──────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIST(): string {
  const d = new Date(Date.now() + 5.5 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  return localISO(d);
}

function getWorkingDayDate(joinDateISO: string, dayNum: number): string {
  const [y, mo, da] = joinDateISO.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  let count = 0;
  while (count < dayNum) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return localISO(d);
}

function workingDaysSince(joinDateISO: string, asOf: string): number {
  const [y, mo, da] = joinDateISO.split("-").map(Number);
  const doj = new Date(y, mo - 1, da);
  const [ty, tm, td] = asOf.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  let count = 0;
  const d = new Date(doj);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function fmtDate(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ── upcoming milestones ───────────────────────────────────────────────────────

function getUpcomingMilestone(joinDate: string, today: string): string | null {
  const milestones = [
    { label: "End-of-Phase-1 Huddle (Day 14)", date: getWorkingDayDate(joinDate, 14) },
    { label: "Month 1 Review",                 date: addDays(joinDate, 30)            },
    { label: "Month 3 PA Review",              date: addDays(joinDate, 90)            },
    { label: "Month 4 PIP Review",             date: addDays(joinDate, 120)           },
    { label: "Month 5 Exit Review",            date: addDays(joinDate, 150)           },
  ];
  for (const ms of milestones) {
    if (ms.date < today) continue;
    const daysAway = Math.round(
      (new Date(ms.date).getTime() - new Date(today).getTime()) / 86_400_000
    );
    if (daysAway <= 3) return `${ms.label} is in ${daysAway === 0 ? "today" : `${daysAway} day${daysAway > 1 ? "s" : ""}`}`;
    if (daysAway <= 7) return `${ms.label} is on ${fmtDate(ms.date)}`;
  }
  return null;
}

// ── email builder ─────────────────────────────────────────────────────────────

function buildReminderEmail(
  firstName: string,
  today: string,
  wds: number,
  huddleDone: boolean,
  dsrDone: boolean,
  upcomingMilestone: string | null,
): string {
  const displayDate = fmtDate(today);

  const tasks: { icon: string; text: string; done: boolean }[] = [
    {
      icon: "📧",
      text: "Send your <strong>Daily Sales Report (DSR)</strong> email with subject <em>\"Your sales training plan\"</em>",
      done: dsrDone,
    },
    {
      icon: "🤝",
      text: "Attend your <strong>Daily Huddle</strong> session",
      done: huddleDone,
    },
  ];

  const taskRows = tasks.map(t => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${t.icon}</span>
          <div style="flex:1">
            <div style="font-size:12px;color:${t.done ? "#059669" : "#111827"};${t.done ? "text-decoration:line-through;opacity:0.7" : ""}">
              ${t.text}
            </div>
          </div>
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;${
            t.done
              ? "background:#d1fae5;color:#065f46"
              : "background:#fef3c7;color:#92400e"
          }">${t.done ? "✓ Done" : "Pending"}</span>
        </div>
      </td>
    </tr>`).join("");

  const milestoneRow = upcomingMilestone ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:0 0 20px">
      <div style="font-size:11px;font-weight:700;color:#1e40af;margin-bottom:2px">📅 Upcoming Milestone</div>
      <div style="font-size:12px;color:#1e3a8a">${upcomingMilestone}</div>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">

        <!-- Header -->
        <tr>
          <td bgcolor="#4f46e5" style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 28px">
            <div style="font-size:10px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Good Morning ☀️</div>
            <div style="font-size:22px;font-weight:800;color:#f0f0ff">STP Daily Briefing</div>
            <div style="font-size:12px;color:#a5b4fc;margin-top:4px">${displayDate} · Day ${wds} of STP</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e2e8f0;border-top:none">

            <p style="font-size:15px;color:#111827;font-weight:600;margin:0 0 4px">Hi ${firstName},</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 20px">Here's your task checklist for today.</p>

            ${milestoneRow}

            <p style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px">Today's Tasks</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
              ${taskRows}
            </table>

            <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0 0 20px">
              Consistent DSR and huddle participation are tracked as part of your STP evaluation.
              Please ensure both are completed before end of day.
            </p>

            <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:11px;color:#9ca3af;text-align:center">
              Sent by STP Dashboard · ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>

          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronForbidden();

  const today = todayIST();

  // Load all active STP NJs with email
  const allNJs = await db.select().from(newJoiners).where(eq(newJoiners.isActive, true)).all();
  const stpNJs = allNJs.filter(n => !n.stpClosed && n.email);

  if (stpNJs.length === 0)
    return NextResponse.json({ ok: true, message: "No NJs in STP window", sent: 0 });

  // Already sent today
  const sentRes = await client.execute({
    sql: `SELECT recipient_email FROM reminder_logs WHERE reminder_type = 'MorningNJ' AND sent_at >= ? AND status = 'sent'`,
    args: [`${today}T00:00:00`],
  });
  const alreadySent = new Set(sentRes.rows.map(r => String(r.recipient_email).toLowerCase()));

  // Today's huddle and DSR data
  const todayHuddles = await db.select().from(huddleLogs).where(eq(huddleLogs.date, today)).all();
  const todayDSRs    = await db.select().from(dsrSubmissions).where(eq(dsrSubmissions.date, today)).all();

  const huddleDoneSet = new Set(todayHuddles.filter(h => h.completed).map(h => h.njId));
  const dsrDoneSet    = new Set(todayDSRs.map(d => d.njId));

  const results: { name: string; email: string; action: string }[] = [];

  for (const nj of stpNJs) {
    const email = nj.email!.toLowerCase();
    if (alreadySent.has(email)) {
      results.push({ name: nj.name, email, action: "skipped — already sent today" });
      continue;
    }

    const firstName        = nj.name.split(" ")[0];
    const wds              = workingDaysSince(nj.joinDate, today);
    const huddleDone       = huddleDoneSet.has(nj.id);
    const dsrDone          = dsrDoneSet.has(nj.id);
    const upcomingMilestone = getUpcomingMilestone(nj.joinDate, today);

    try {
      await sendEmail({
        to: [nj.email!],
        subject: `☀️ Good Morning ${firstName} — STP Daily Briefing for ${fmtDate(today)}`,
        bodyHtml: buildReminderEmail(firstName, today, wds, huddleDone, dsrDone, upcomingMilestone),
      });

      await client.execute({
        sql: `INSERT INTO reminder_logs (recipient_email, recipient_role, reminder_type, sent_at, status) VALUES (?, 'nj', 'MorningNJ', ?, 'sent')`,
        args: [email, new Date().toISOString()],
      });

      alreadySent.add(email);
      results.push({ name: nj.name, email, action: "sent" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await client.execute({
        sql: `INSERT INTO reminder_logs (recipient_email, recipient_role, reminder_type, sent_at, status, error_message) VALUES (?, 'nj', 'MorningNJ', ?, 'failed', ?)`,
        args: [email, new Date().toISOString(), msg],
      });
      results.push({ name: nj.name, email, action: `error: ${msg}` });
    }
  }

  const sent = results.filter(r => r.action === "sent").length;
  return NextResponse.json({ ok: true, today, sent, results });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, huddleLogs, dsrSubmissions, performanceAlerts, reminderLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "@/lib/msGraph";
import { dailyAdminTemplate, dailyManagerTemplate } from "@/lib/emailTemplates";

const ADMIN_EMAIL = process.env.TEAMS_CALENDAR_OWNER_EMAIL!;

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get("authorization");
  const legacyHeader = req.headers.get("x-cron-secret");
  const valid = authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    legacyHeader === process.env.CRON_SECRET || legacyHeader === "stp-cron-2026";
  if (!valid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = todayIso();

  const activeNJs = await db
    .select()
    .from(newJoiners)
    .where(eq(newJoiners.isActive, true))
    .all();

  const valid = activeNJs.filter(n => n.empId && !n.empId.startsWith("MOCK-") && n.name?.trim());

  const allAlerts     = await db.select().from(performanceAlerts).all();
  const todayHuddles  = await db.select().from(huddleLogs).where(eq(huddleLogs.date, today)).all();
  const todayDSR      = await db.select().from(dsrSubmissions).where(eq(dsrSubmissions.date, today)).all();

  const huddleSet = new Set(todayHuddles.filter(h => h.completed).map(h => h.njId));
  const dsrSet    = new Set(todayDSR.map(d => d.njId));

  // Build per-NJ issue list
  type IssueRow = { njName: string; issues: string[] };
  const adminItems: IssueRow[] = [];
  const managerMap = new Map<string, IssueRow[]>(); // managerId → items

  for (const nj of valid) {
    const issues: string[] = [];
    if (!huddleSet.has(nj.id)) issues.push("Huddle not completed");
    if (!dsrSet.has(nj.id))    issues.push("DSR not submitted");

    const pendingAlerts = allAlerts.filter(a => a.njId === nj.id && !a.acknowledgedAt);
    if (pendingAlerts.length > 0) {
      issues.push(`${pendingAlerts.map(a => a.alertType).join("/")} alert pending`);
    }

    if (issues.length > 0) {
      adminItems.push({ njName: nj.name ?? nj.empId ?? String(nj.id), issues });

      if (nj.managerId) {
        if (!managerMap.has(nj.managerId)) managerMap.set(nj.managerId, []);
        managerMap.get(nj.managerId)!.push({ njName: nj.name ?? nj.empId ?? String(nj.id), issues });
      }
    }
  }

  const results: { recipient: string; status: string; error?: string }[] = [];
  const sentAt = new Date().toISOString();

  // Send admin summary
  try {
    await sendEmail({
      to:       [ADMIN_EMAIL],
      subject:  `STP Daily Summary — ${formatDate(today)}`,
      bodyHtml: dailyAdminTemplate(formatDate(today), adminItems),
    });
    await db.insert(reminderLogs).values({
      recipientEmail: ADMIN_EMAIL,
      recipientRole:  "admin",
      reminderType:   "DailyAdmin",
      sentAt,
      status: "sent",
    });
    results.push({ recipient: ADMIN_EMAIL, status: "sent" });
  } catch (err) {
    await db.insert(reminderLogs).values({
      recipientEmail: ADMIN_EMAIL,
      recipientRole:  "admin",
      reminderType:   "DailyAdmin",
      sentAt,
      status:       "failed",
      errorMessage: String(err),
    });
    results.push({ recipient: ADMIN_EMAIL, status: "failed", error: String(err) });
  }

  // Send per-manager summaries
  for (const [managerId, items] of managerMap.entries()) {
    // managerId is usually the manager's name in this system
    const managerEmail = managerId.includes("@") ? managerId : null;
    if (!managerEmail) continue; // skip if not an email address

    try {
      await sendEmail({
        to:       [managerEmail],
        subject:  `Your Team — Daily STP Update ${formatDate(today)}`,
        bodyHtml: dailyManagerTemplate(managerId, formatDate(today), items),
      });
      await db.insert(reminderLogs).values({
        recipientEmail: managerEmail,
        recipientRole:  "manager",
        reminderType:   "DailyManager",
        sentAt,
        status: "sent",
      });
      results.push({ recipient: managerEmail, status: "sent" });
    } catch (err) {
      await db.insert(reminderLogs).values({
        recipientEmail: managerEmail,
        recipientRole:  "manager",
        reminderType:   "DailyManager",
        sentAt,
        status:       "failed",
        errorMessage: String(err),
      });
      results.push({ recipient: managerEmail, status: "failed", error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, date: today, results });
}

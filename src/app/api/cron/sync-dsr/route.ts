import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/lib/db";
import { dsrSubmissions, newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";

const TENANT_ID     = process.env.OUTLOOK_TENANT_ID    ?? process.env.TEAMS_TENANT_ID!;
const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID    ?? process.env.TEAMS_CLIENT_ID!;
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET ?? process.env.TEAMS_CLIENT_SECRET!;
const MAILBOX       = process.env.OUTLOOK_MAILBOX      ?? process.env.TEAMS_CALENDAR_OWNER_EMAIL!;
const MODULE        = "dsr_sync";

const SUBJECT_KEYWORD = "your sales training plan";

async function getToken(): Promise<string> {
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
  if (!res.ok) throw new Error(`Token failed ${res.status}: ${await res.text()}`);
  const d = await res.json() as { access_token: string };
  return d.access_token;
}

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  from: { emailAddress: { address: string } };
}

async function fetchDSREmails(token: string, date: string): Promise<GraphMessage[]> {
  const search = encodeURIComponent(`subject:training received:${date}`);
  const url = `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages` +
    `?$search="${search}"&$select=id,subject,receivedDateTime,from&$top=200`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Messages fetch ${res.status}: ${await res.text()}`);
  const data = await res.json() as { value: GraphMessage[] };

  return (data.value ?? []).filter(m =>
    m.subject?.toLowerCase().includes(SUBJECT_KEYWORD) &&
    m.receivedDateTime?.startsWith(date)
  );
}

async function upsertSyncLog(status: "running" | "success" | "error", extra: { errorMessage?: string; recordsProcessed?: number } = {}) {
  await client.execute({
    sql: `INSERT INTO sync_logs (module, last_sync_at, status, error_message, records_processed)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(module) DO UPDATE SET
            last_sync_at = excluded.last_sync_at,
            status       = excluded.status,
            error_message = excluded.error_message,
            records_processed = excluded.records_processed`,
    args: [MODULE, new Date().toISOString(), status, extra.errorMessage ?? null, extra.recordsProcessed ?? null],
  });
}

export async function GET(req: NextRequest) {
  // Accept both Vercel standard auth (Authorization: Bearer) and legacy header
  const authHeader = req.headers.get("authorization");
  const legacyHeader = req.headers.get("x-cron-secret");
  const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validLegacy = legacyHeader === process.env.CRON_SECRET || legacyHeader === "stp-cron-2026";

  if (!validBearer && !validLegacy) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await upsertSyncLog("running");

  try {
    const today = new Date().toISOString().split("T")[0];

    const allNJs = await db
      .select({ id: newJoiners.id, email: newJoiners.email })
      .from(newJoiners)
      .where(eq(newJoiners.isActive, true))
      .all();

    const njsByEmail = new Map<string, number>();
    for (const nj of allNJs) {
      if (nj.email) njsByEmail.set(nj.email.toLowerCase(), nj.id);
    }

    if (njsByEmail.size === 0) {
      await upsertSyncLog("success", { recordsProcessed: 0 });
      return NextResponse.json({ ok: true, message: "No NJs with emails", synced: 0 });
    }

    const token    = await getToken();
    const messages = await fetchDSREmails(token, today);

    let synced = 0;
    for (const msg of messages) {
      const senderEmail = msg.from?.emailAddress?.address?.toLowerCase();
      const njId = senderEmail ? njsByEmail.get(senderEmail) : undefined;
      if (!njId) continue;

      const existing = await db
        .select({ id: dsrSubmissions.id })
        .from(dsrSubmissions)
        .where(eq(dsrSubmissions.emailId, msg.id))
        .get();

      if (!existing) {
        await db.insert(dsrSubmissions).values({
          njId,
          date:        today,
          emailId:     msg.id,
          submittedAt: msg.receivedDateTime,
        });
        synced++;
      }
    }

    await upsertSyncLog("success", { recordsProcessed: synced });
    return NextResponse.json({ ok: true, date: today, emailsChecked: messages.length, synced });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog("error", { errorMessage: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

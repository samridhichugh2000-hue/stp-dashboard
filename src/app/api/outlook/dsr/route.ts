import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dsrSubmissions, newJoiners } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

const TENANT_ID     = process.env.OUTLOOK_TENANT_ID    ?? "98deb14a-8f2f-48b2-807f-8a97c96a0ca3";
const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID     ?? "dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2";
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET!;
const MAILBOX       = process.env.OUTLOOK_MAILBOX!;  // samridhi.chugh@koenig-solutions.com

const SUBJECT_SEARCH  = "sales training plan";  // KQL search term
const SUBJECT_KEYWORD = "Your sales training plan"; // in-code guard

// ── MS Graph auth ─────────────────────────────────────────────────────────────

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
  if (!res.ok) throw new Error(`Graph token HTTP ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`Graph auth failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

// ── Fetch today's DSR emails ──────────────────────────────────────────────────

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  from: { emailAddress: { address: string; name: string } };
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

async function fetchTodayDSREmails(token: string): Promise<GraphMessage[]> {
  const today = todayIso();
  // KQL: subject keyword + received today
  const search = encodeURIComponent(`subject:${SUBJECT_SEARCH} received:${today}`);
  const url =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages` +
    `?$search="${search}"&$select=id,subject,receivedDateTime,from&$top=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Graph DSR fetch HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const all: GraphMessage[] = data.value ?? [];

  // Guard: subject must contain keyword, and received today
  return all.filter((m) => {
    const subjectMatch = m.subject?.toLowerCase().includes(SUBJECT_KEYWORD.toLowerCase());
    const dateMatch    = m.receivedDateTime?.startsWith(today);
    return subjectMatch && dateMatch;
  });
}

// ── GET — sync today's DSRs, return all STP WIP NJs with today's DSR status ──
// ?njId=X  →  return full submission history for that NJ (no sync)

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const njId = req.nextUrl.searchParams.get("njId");
  if (njId) {
    const submissions = await db
      .select({ date: dsrSubmissions.date, submittedAt: dsrSubmissions.submittedAt })
      .from(dsrSubmissions)
      .where(eq(dsrSubmissions.njId, parseInt(njId)))
      .all();
    return NextResponse.json(submissions);
  }

  if (!CLIENT_SECRET || !MAILBOX) {
    return NextResponse.json({ error: "OUTLOOK_CLIENT_SECRET / OUTLOOK_MAILBOX not set" }, { status: 500 });
  }

  try {
    const today = todayIso();

    // 1. Get all active NJs that have an email (only STP WIP check is done on client for display)
    const allNJs = await db
      .select({ id: newJoiners.id, name: newJoiners.name, email: newJoiners.email, joinDate: newJoiners.joinDate, isActive: newJoiners.isActive })
      .from(newJoiners)
      .where(eq(newJoiners.isActive, true))
      .all();

    const njsByEmail = new Map<string, typeof allNJs[number]>();
    for (const nj of allNJs) {
      if (nj.email) njsByEmail.set(nj.email.toLowerCase(), nj);
    }

    // 2. Fetch today's emails from mailbox
    const token    = await getGraphToken();
    const messages = await fetchTodayDSREmails(token);

    // 3. Upsert DSR submissions for matched NJs
    for (const msg of messages) {
      const senderEmail = msg.from?.emailAddress?.address?.toLowerCase();
      if (!senderEmail) continue;

      const nj = njsByEmail.get(senderEmail);
      if (!nj) continue; // sender not an NJ in our DB

      // Upsert by emailId (unique constraint prevents duplicates)
      const existing = await db
        .select({ id: dsrSubmissions.id })
        .from(dsrSubmissions)
        .where(eq(dsrSubmissions.emailId, msg.id))
        .get();

      if (!existing) {
        await db.insert(dsrSubmissions).values({
          njId:        nj.id,
          date:        today,
          emailId:     msg.id,
          submittedAt: msg.receivedDateTime,
        });
      }
    }

    // 4. Load today's submissions from DB
    const todaySubmissions = await db
      .select()
      .from(dsrSubmissions)
      .where(eq(dsrSubmissions.date, today))
      .all();

    const submittedNjIds = new Set(todaySubmissions.map((s) => s.njId));

    // 5. Return all active NJs enriched with today's DSR status
    const result = allNJs.map((nj) => ({
      njId:         nj.id,
      name:         nj.name,
      email:        nj.email,
      dsrToday:     submittedNjIds.has(nj.id),
      submittedAt:  todaySubmissions.find((s) => s.njId === nj.id)?.submittedAt ?? null,
    }));

    return NextResponse.json({ date: today, njs: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

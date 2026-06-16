import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { joiningLeads } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

const TENANT_ID     = process.env.OUTLOOK_TENANT_ID   ?? "98deb14a-8f2f-48b2-807f-8a97c96a0ca3";
const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID    ?? "dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2";
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET!;
const MAILBOX       = process.env.OUTLOOK_MAILBOX!;   // e.g. gunjan.setia@koenig-solutions.com

const SENDER_EMAIL     = "Mokshi.Puri@koenig-solutions.com";
const SUBJECT_SEARCH   = "New Sales Hires";          // KQL search term (no apostrophes)
const SUBJECT_KEYWORD  = "PLI's of New Sales Hires"; // secondary in-code match

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

// ── Fetch messages from mailbox ───────────────────────────────────────────────

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  body: { content: string; contentType: string };
  from: { emailAddress: { address: string } };
}

async function fetchMessages(token: string): Promise<GraphMessage[]> {
  // Use KQL $search — supports from: and subject: without OData filter complexity
  const search = encodeURIComponent(`from:${SENDER_EMAIL} subject:${SUBJECT_SEARCH}`);
  const url =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages` +
    `?$search="${search}"&$select=id,subject,receivedDateTime,body,from&$top=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Graph messages HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const all: GraphMessage[] = data.value ?? [];

  // Secondary guard — ensure sender and subject still match
  return all.filter(
    (m) =>
      m.from?.emailAddress?.address?.toLowerCase() === SENDER_EMAIL.toLowerCase() &&
      m.subject?.toLowerCase().includes(SUBJECT_KEYWORD.toLowerCase())
  );
}

// ── Email body parser ─────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/[ \t]+/g, " ");
}

interface ParsedJoining {
  name: string;
  manager: string;
  country: string;
  tentativeDoj: string;
}

/** Match a labeled field: "Name: John Doe" or "Name - John Doe" or "Name : John Doe" */
function extractField(text: string, labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(
      `${label}\\s*[:\\-–]\\s*([^\\n\\r]+)`,
      "i"
    );
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim().replace(/[*_]/g, "");
  }
  return "";
}

/**
 * Parse one or more joining records from an email body.
 * Handles the table format used by Mokshi.Puri:
 *   1
 *   Diana (Jasmeet)
 *   Nigeria
 *   16th March 2026
 *   ...
 */
function parseJoinings(rawBody: string, contentType: string): ParsedJoining[] {
  const text = contentType === "html" ? stripHtml(rawBody) : rawBody;

  // Only parse the top (latest) reply — stop at the quoted chain "From: ..."
  const chainIdx = text.search(/\n\s*From:\s+\w/i);
  const topText = chainIdx > 0 ? text.slice(0, chainIdx) : text;

  const lines = topText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const results: ParsedJoining[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    // Row entry starts with a standalone number (1, 2, 3 ...)
    if (!/^\d+$/.test(lines[i])) continue;

    const nameLine   = lines[i + 1] ?? "";
    const nextLine   = lines[i + 2] ?? "";
    const afterNext  = lines[i + 3] ?? "";

    // Name line must start with a letter
    if (!/^[A-Za-z]/.test(nameLine)) continue;
    // Skip header-like values
    if (/^(name|country|tentative|annual|target|no\.)/i.test(nameLine)) continue;

    // Extract name and manager from "Diana (Jasmeet)" format
    const nameMatch = nameLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const name    = nameMatch ? nameMatch[1].trim() : nameLine.trim();
    const manager = nameMatch ? nameMatch[2].trim() : "";

    if (!name || name.length < 2) continue;

    // Skip garbage names (URLs, emails)
    if (/[@.]com|http/i.test(name)) continue;

    // Country: next line if it starts with a letter and isn't salary/currency
    const isSalary = (s: string) => /USD|INR|EUR|GBP|lac|lacs/i.test(s) || /\b\d{5,}\b/.test(s);
    const isCountry = (s: string) => /^[A-Za-z]/.test(s) && !isSalary(s);

    const country      = isCountry(nextLine)  ? nextLine  : "";
    const rawDoj       = country              ? afterNext : nextLine;
    const tentativeDoj = isSalary(rawDoj)     ? ""        : rawDoj;

    // Clean salary suffix from name e.g. "Danish – 1.7 lacs"
    const cleanName = name.replace(/[\u2013\u2014\-]\s*[\d.,]+\s*(lacs?|k|usd|inr)?.*$/i, "").trim();
    if (!cleanName || cleanName.length < 2) continue;

    results.push({ name: cleanName, manager, country, tentativeDoj });
  }

  return results;
}

// ── GET — fetch emails, upsert into DB, return all records ───────────────────

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!CLIENT_SECRET) {
    return NextResponse.json({ error: "OUTLOOK_CLIENT_SECRET env var not set" }, { status: 500 });
  }
  if (!MAILBOX) {
    return NextResponse.json({ error: "OUTLOOK_MAILBOX env var not set" }, { status: 500 });
  }

  try {
    const token    = await getGraphToken();
    const messages = await fetchMessages(token);

    for (const msg of messages) {
      const joinings = parseJoinings(msg.body.content, msg.body.contentType);

      for (const joining of joinings) {
        // Use composite key: messageId + name to handle multiple joinings in one email
        const emailId = `${msg.id}::${joining.name}`;

        // Upsert — preserve existing status if already set
        const existing = await db
          .select({ id: joiningLeads.id, status: joiningLeads.status })
          .from(joiningLeads)
          .where(eq(joiningLeads.emailId, emailId))
          .get();

        if (existing) {
          // Update parsed fields but keep status
          await db
            .update(joiningLeads)
            .set({
              name:            joining.name,
              manager:         joining.manager || null,
              country:         joining.country || null,
              tentativeDoj:    joining.tentativeDoj || null,
              emailSubject:    msg.subject,
              emailReceivedAt: msg.receivedDateTime,
            })
            .where(eq(joiningLeads.emailId, emailId));
        } else {
          await db.insert(joiningLeads).values({
            emailId,
            name:            joining.name,
            manager:         joining.manager || null,
            country:         joining.country || null,
            tentativeDoj:    joining.tentativeDoj || null,
            status:          "pending",
            emailSubject:    msg.subject,
            emailReceivedAt: msg.receivedDateTime,
          });
        }
      }
    }

    // Return all records, newest email first — deduplicated by name (keep latest per person)
    const all = await db
      .select()
      .from(joiningLeads)
      .orderBy(sql`email_received_at DESC`)
      .all();

    const seen = new Set<string>();
    const deduped = all.filter(r => {
      const key = r.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(deduped);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── PATCH — update status (joined | backed_out | pending) ────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json() as { id: number; status: string };
  if (!id || !["pending", "joined", "backed_out"].includes(status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await db
    .update(joiningLeads)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(joiningLeads.id, id));

  return NextResponse.json({ ok: true });
}

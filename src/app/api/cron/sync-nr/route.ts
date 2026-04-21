import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nrRecords, newJoiners, syncLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const MODULE = "nr";
const API_BASE_URL = "https://api.koenig-solutions.com";

async function getAuthToken() {
  const username = process.env.NR_API_USERNAME;
  const password = process.env.NR_API_PASSWORD;
  const role = process.env.NR_API_ROLE ?? "PMS";
  if (!username || !password) throw new Error("NR_API credentials not set");
  const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, userPassword: password, userRole: role }),
  });
  if (!res.ok) throw new Error(`GetToken HTTP ${res.status}`);
  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`GetToken failed: ${data.message}`);
  return { accessToken: data.content.accessToken as string, deviceToken: data.content.deviceToken as string };
}

const MONTH_ABBR: Record<string, number> = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
};

function parseMonthKey(key: string): { month: number; year: number } | null {
  const parts = key.split("-");
  if (parts.length !== 2) return null;
  const month = MONTH_ABBR[parts[0].toLowerCase().slice(0, 3)];
  const year = parseInt(parts[1], 10);
  if (!month || isNaN(year)) return null;
  return { month, year };
}

async function upsertSyncLog(status: string, extra: Record<string, unknown> = {}) {
  const existing = await db.select().from(syncLogs).where(eq(syncLogs.module, MODULE)).get();
  const now = new Date().toISOString();
  if (existing) {
    await db.update(syncLogs).set({ status, lastSyncAt: now, ...extra }).where(eq(syncLogs.module, MODULE));
  } else {
    await db.insert(syncLogs).values({ module: MODULE, status, lastSyncAt: now, ...extra } as never);
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronForbidden();

  await upsertSyncLog("running");

  try {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

    const { accessToken, deviceToken } = await getAuthToken();

    const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetCCENRData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: { accessToken, deviceToken }, startDate: fmt(startDate), endDate: fmt(today) }),
    });
    if (!res.ok) throw new Error(`GetCCENRData HTTP ${res.status}`);
    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`GetCCENRData failed: ${data.message}`);

    const rawRecords: Record<string, unknown>[] = Array.isArray(data.content) ? data.content : [];

    // Build empId → njId map
    const allNJs = await db.select().from(newJoiners).all();
    const empIdToNjId = new Map(allNJs.filter(nj => nj.empId).map(nj => [nj.empId!, nj.id]));

    let count = 0;
    for (const raw of rawRecords) {
      const empIdRaw = raw.EmpId ?? raw.empId;
      if (!empIdRaw) continue;
      const empId = String(empIdRaw).trim();
      const njId = empIdToNjId.get(empId);
      if (!njId) continue;

      const monthly = raw.MonthlyRevenue;
      if (!monthly || typeof monthly !== "object" || Array.isArray(monthly)) continue;

      for (const [key, val] of Object.entries(monthly as Record<string, unknown>)) {
        const parsed = parseMonthKey(key);
        if (!parsed) continue;
        const nrValue = typeof val === "string"
          ? parseFloat(val.replace(/,/g, ""))
          : Number(val);
        if (isNaN(nrValue)) continue;

        const existing = await db
          .select()
          .from(nrRecords)
          .where(and(
            eq(nrRecords.njId, njId),
            eq(nrRecords.month, parsed.month),
            eq(nrRecords.year, parsed.year)
          ))
          .get();

        if (existing) {
          await db.update(nrRecords).set({ nrValue, isPositive: nrValue > 0 })
            .where(eq(nrRecords.id, existing.id));
        } else {
          await db.insert(nrRecords).values({
            njId, month: parsed.month, year: parsed.year,
            nrValue, isPositive: nrValue > 0, source: "RMS",
          });
        }
        count++;
      }
    }

    // Re-evaluate categories
    await evaluateCategories(allNJs, empIdToNjId);

    await upsertSyncLog("success", { recordsProcessed: count });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    await upsertSyncLog("error", { errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function evaluateCategories(
  allNJs: (typeof newJoiners.$inferSelect)[],
  empIdToNjId: Map<string, number>
) {
  const allNR = await db.select().from(nrRecords).all();
  for (const nj of allNJs) {
    if (!nj.isActive) continue;
    const njNR = allNR.filter((r) => r.njId === nj.id);
    if (njNR.length === 0) continue;

    const totalNR = njNR.reduce((s, r) => s + r.nrValue, 0);
    // Simple category: Developed if total NR > 0
    const category = totalNR > 0 ? "Developed" : nj.category === "Uncategorised" ? "Uncategorised" : "Non-Performer";
    await db.update(newJoiners).set({ category }).where(eq(newJoiners.id, nj.id));
  }
}

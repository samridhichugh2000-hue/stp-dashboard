import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rcbSummary, newJoiners, syncLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const MODULE = "rcb";
const API_BASE_URL = "https://api.koenig-solutions.com";

async function getAuthToken() {
  const username = process.env.RCB_API_USERNAME;
  const password = process.env.RCB_API_PASSWORD;
  const role = process.env.RCB_API_ROLE ?? "HR";
  if (!username || !password) throw new Error("RCB_API credentials not set");
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

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
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
    const startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const { accessToken, deviceToken } = await getAuthToken();

    const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetRCBData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: { accessToken, deviceToken },
        EmpId: "0",
        startDate: fmt(startDate),
        endDate: fmt(today),
      }),
    });
    if (!res.ok) throw new Error(`GetRCBData HTTP ${res.status}`);
    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`GetRCBData failed: ${data.message}`);

    const rawRecords: Record<string, unknown>[] = Array.isArray(data.content) ? data.content : [];

    // Build empId → njId map
    const allNJs = await db.select().from(newJoiners).all();
    const empIdToNjId = new Map(allNJs.filter(nj => nj.empId).map(nj => [nj.empId!, nj.id]));

    // Aggregate by empId
    const aggregated = new Map<string, { claimedCorporates: number; nrFromCorporates: number; noOfClients: number }>();
    for (const raw of rawRecords) {
      const empIdRaw = raw.EmpId ?? raw.empId ?? raw.EmpID;
      if (!empIdRaw) continue;
      const empId = String(empIdRaw).trim();
      if (!empId || empId === "0") continue;

      const nrFromCorporates = parseNum(raw.NR ?? raw.nr ?? raw.Revenue ?? 0);
      const noOfClients = parseNum(raw.NoOfClients ?? raw.noOfClients ?? 0);
      const existing = aggregated.get(empId);
      if (existing) {
        existing.claimedCorporates += 1;
        existing.nrFromCorporates += nrFromCorporates;
        existing.noOfClients += noOfClients;
      } else {
        aggregated.set(empId, { claimedCorporates: 1, nrFromCorporates, noOfClients });
      }
    }

    let count = 0;
    for (const [empId, agg] of aggregated) {
      const njId = empIdToNjId.get(empId);
      if (!njId) continue;

      const existingSummary = await db.select().from(rcbSummary).where(eq(rcbSummary.njId, njId)).get();
      const now = new Date().toISOString();

      if (existingSummary) {
        await db.update(rcbSummary).set({
          claimedCorporates: agg.claimedCorporates,
          nrFromCorporates: agg.nrFromCorporates,
          noOfClients: agg.noOfClients,
          lastSyncAt: now,
        }).where(eq(rcbSummary.njId, njId));
      } else {
        await db.insert(rcbSummary).values({
          njId,
          claimedCorporates: agg.claimedCorporates,
          nrFromCorporates: agg.nrFromCorporates,
          noOfClients: agg.noOfClients,
          lastSyncAt: now,
        });
      }
      count++;
    }

    await upsertSyncLog("success", { recordsProcessed: count });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    await upsertSyncLog("error", { errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

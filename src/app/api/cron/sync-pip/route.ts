import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, syncLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const MODULE      = "pip";
const API_BASE    = "https://api.koenig-solutions.com";
const USERNAME    = "Sakshipandey";
const PASSWORD    = "Sakshipandey@123";
const ROLE        = "GetIncidentData";
const API_KEY     = "38";
const EMP_CODE    = 2847; // Sakshipandey's emp code — returns all accessible records

async function getAuthToken() {
  const res = await fetch(`${API_BASE}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: USERNAME, userPassword: PASSWORD, userRole: ROLE }),
  });
  if (!res.ok) throw new Error(`GetToken HTTP ${res.status}`);
  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`GetToken failed: ${data.message}`);
  return { accessToken: data.content.accessToken as string, deviceToken: data.content.deviceToken as string };
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
    const { accessToken, deviceToken } = await getAuthToken();

    // Broad date range to capture all currently active PA/PIP records
    const today = new Date();
    const fromDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
      .toISOString().split("T")[0];
    const toDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
      .toISOString().split("T")[0];

    const url =
      `${API_BASE}/api/Kites/Operator/common` +
      `?apikey=${API_KEY}` +
      `&accessToken=${encodeURIComponent(accessToken)}` +
      `&deviceToken=${encodeURIComponent(deviceToken)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ EmpCode: EMP_CODE, From: fromDate, To: toDate, Type: 8 }),
    });
    if (!res.ok) throw new Error(`PIP API HTTP ${res.status}`);
    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`PIP API failed: ${data.message}`);

    const raw: Record<string, unknown>[] = typeof data.content === "string"
      ? JSON.parse(data.content)
      : (Array.isArray(data.content) ? data.content : []);

    // Keep only currently active records; per empcode keep the one with the highest Id
    // (most recent). "Performance Alert" → "PA", "PIP" → "PIP"
    const pipMap = new Map<string, { status: string; fromDate: string; toDate: string }>();
    for (const r of raw) {
      if (!r.isActive) continue;
      const empCode = String(r.Empcode ?? "").trim();
      if (!empCode || empCode === "0") continue;
      const rawType = String(r.Type ?? "").trim();
      const status  = rawType === "PIP" ? "PIP" : rawType === "Performance Alert" ? "PA" : null;
      if (!status) continue;

      const existing = pipMap.get(empCode);
      const id = Number(r.Id ?? 0);
      if (!existing || id > Number(existing.fromDate)) {
        pipMap.set(empCode, {
          status,
          fromDate: String(r.FromDate ?? ""),
          toDate:   String(r.ToDate ?? ""),
        });
      }
    }

    // Update all NJs in DB
    const allNJs = await db
      .select({ id: newJoiners.id, empId: newJoiners.empId, pipStatus: newJoiners.pipStatus, pipFirstSeenAt: newJoiners.pipFirstSeenAt })
      .from(newJoiners).all();
    const now = new Date().toISOString();
    let updated = 0;

    for (const nj of allNJs) {
      if (!nj.empId) continue;
      const entry     = pipMap.get(nj.empId) ?? null;
      const newStatus = entry?.status ?? null;
      const newFrom   = entry?.fromDate ?? null;
      const newTo     = entry?.toDate ?? null;
      const changed   = newStatus !== (nj.pipStatus ?? null);

      if (changed) {
        await db.update(newJoiners).set({
          pipStatus:      newStatus,
          pipFirstSeenAt: newStatus && !nj.pipStatus ? now : (newStatus ? nj.pipFirstSeenAt : null),
          pipFromDate:    newFrom,
          pipToDate:      newTo,
        } as never).where(eq(newJoiners.id, nj.id));
        updated++;
      } else if (newStatus && (newFrom || newTo)) {
        // Status unchanged but update dates in case they changed
        await db.update(newJoiners).set({
          pipFromDate: newFrom,
          pipToDate:   newTo,
        } as never).where(eq(newJoiners.id, nj.id));
      }
    }

    await upsertSyncLog("success", { recordsProcessed: pipMap.size });
    return NextResponse.json({ ok: true, onPipOrPa: pipMap.size, updated });
  } catch (err) {
    await upsertSyncLog("error", { errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

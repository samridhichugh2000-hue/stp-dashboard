import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, syncLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const MODULE   = "pip";
const API_BASE = "https://api.koenig-solutions.com";
const PIP_USERNAME = "Samridhi_GetPIPPanelData";
const PIP_PASSWORD = "fLRcQ3!!v8Gs";
const PIP_ROLE     = "Get_PIPPanel_Data";
const API_KEY      = "18";

async function getAuthToken() {
  const res = await fetch(`${API_BASE}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: PIP_USERNAME, userPassword: PIP_PASSWORD, userRole: PIP_ROLE }),
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
    const url =
      `${API_BASE}/api/Kites/Operator/common` +
      `?apikey=${API_KEY}` +
      `&accessToken=${encodeURIComponent(accessToken)}` +
      `&deviceToken=${encodeURIComponent(deviceToken)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ EmpCode: "", From: "", To: "" }),
    });
    if (!res.ok) throw new Error(`PIP API HTTP ${res.status}`);
    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`PIP API failed: ${data.message}`);

    const raw: Record<string, unknown>[] = typeof data.content === "string"
      ? JSON.parse(data.content)
      : (Array.isArray(data.content) ? data.content : []);

    // Build empId → pipStatus map (only PA/PIP entries)
    const pipMap = new Map<string, string>();
    for (const r of raw) {
      const empCode = String(r["Emp Code"] ?? "").trim();
      const status  = String(r["PIP Status"] ?? "").trim();
      if (empCode && (status === "PA" || status === "PIP")) {
        pipMap.set(empCode, status);
      }
    }

    // Update all NJs in DB
    const allNJs = await db.select({ id: newJoiners.id, empId: newJoiners.empId, pipStatus: newJoiners.pipStatus, pipFirstSeenAt: newJoiners.pipFirstSeenAt }).from(newJoiners).all();
    const now = new Date().toISOString();
    let updated = 0;

    for (const nj of allNJs) {
      if (!nj.empId) continue;
      const newStatus = pipMap.get(nj.empId) ?? null;
      const changed   = newStatus !== (nj.pipStatus ?? null);

      if (changed) {
        await db.update(newJoiners).set({
          pipStatus:      newStatus,
          pipFirstSeenAt: newStatus && !nj.pipStatus ? now : (newStatus ? nj.pipFirstSeenAt : null),
        }).where(eq(newJoiners.id, nj.id));
        updated++;
      }
    }

    await upsertSyncLog("success", { recordsProcessed: pipMap.size });
    return NextResponse.json({ ok: true, onPipOrPa: pipMap.size, updated });
  } catch (err) {
    await upsertSyncLog("error", { errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

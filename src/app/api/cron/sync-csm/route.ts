import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, syncLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";

const MODULE = "csm";
const API_BASE_URL = "https://api.koenig-solutions.com";

async function getAuthToken() {
  const username = process.env.NR_API_USERNAME;
  const password = process.env.NR_API_PASSWORD;
  const role = process.env.NR_API_ROLE ?? "PMS";
  if (!username || !password) throw new Error("NR_API_USERNAME and NR_API_PASSWORD not set");

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

function parseDOJ(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const MONTH_ABBR: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };
  const match = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return null;
  const [, dd, mon, yrRaw] = match;
  const mm = MONTH_ABBR[mon.toLowerCase()];
  if (!mm) return null;
  const yr = yrRaw.length === 2 ? `20${yrRaw}` : yrRaw;
  return `${yr}-${mm}-${dd.padStart(2, "0")}`;
}

function tenureMonths(joinDateISO: string): number {
  const join = new Date(joinDateISO);
  const today = new Date();
  return Math.max(0, (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth()));
}

function derivePhase(months: number): "Orientation" | "Training" | "Field" | "Graduated" {
  if (months < 1) return "Orientation";
  if (months < 3) return "Training";
  if (months < 6) return "Field";
  return "Graduated";
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
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await upsertSyncLog("running");

  try {
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;

    const { accessToken, deviceToken } = await getAuthToken();

    const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetSalesData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: { accessToken, deviceToken }, From: fmtLocal(oneYearAgo), To: fmtLocal(today) }),
    });
    if (!res.ok) throw new Error(`GetSalesData HTTP ${res.status}`);
    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`GetSalesData failed: ${data.message}`);

    const rawRecords: Record<string, unknown>[] = Array.isArray(data.content) ? data.content : [];
    const upsertedEmpIds: string[] = [];
    let count = 0;

    for (const raw of rawRecords) {
      const empIdRaw = raw.EmpCode ?? raw.EmpId ?? raw.empId;
      if (!empIdRaw) continue;
      const empId = String(empIdRaw).trim();
      if (!empId) continue;

      const department = String(raw.Department ?? raw.Dept ?? raw.Division ?? "").trim();
      if (!department.toLowerCase().includes("sales")) continue;

      const managerName = String(raw.ReportingManager ?? raw.ManagerName ?? raw.Manager ?? "").trim();
      if (managerName.length >= 25 && !/\s/.test(managerName) && /^[a-zA-Z0-9]+$/.test(managerName)) continue;

      const dojRaw = String(raw.DOJ ?? raw.DateOfJoining ?? raw.JoiningDate ?? "").trim();
      const joinDate = parseDOJ(dojRaw);
      if (!joinDate) continue;

      const months = tenureMonths(joinDate);
      const name = String(raw.Name ?? raw.EmployeeName ?? "").trim();
      const location = String(raw.BaseLocation ?? raw.Location ?? raw.City ?? "").trim();
      const email = String(raw.Email ?? raw.EmailId ?? raw.WorkEmail ?? "").trim();
      const designation = String(raw.Designation ?? "").trim();
      const statusRaw = String(raw.Status ?? "Active").trim();
      const isActive = statusRaw.toLowerCase() === "active";

      const existing = await db.select().from(newJoiners).where(eq(newJoiners.empId, empId)).get();
      const record = {
        empId,
        name,
        managerId: managerName,
        location: location || null,
        department: department || null,
        email: email || null,
        joinDate,
        tenureMonths: months,
        currentPhase: derivePhase(months),
        designation: designation || null,
        isActive,
      };

      if (existing) {
        await db.update(newJoiners).set(record).where(eq(newJoiners.empId, empId));
      } else {
        await db.insert(newJoiners).values({ ...record, category: "Uncategorised" });
      }
      upsertedEmpIds.push(empId);
      count++;
    }

    // Deactivate NJs no longer in the API
    const allNJs = await db.select().from(newJoiners).all();
    for (const nj of allNJs) {
      if (nj.empId && !upsertedEmpIds.includes(nj.empId) && nj.isActive) {
        await db.update(newJoiners).set({ isActive: false }).where(eq(newJoiners.id, nj.id));
      }
    }

    await upsertSyncLog("success", { recordsProcessed: count });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    await upsertSyncLog("error", { errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, syncLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { isCronAuthorized, cronForbidden } from "@/lib/cron-auth";

const MODULE = "csm";
const API_BASE_URL = "https://api.koenig-solutions.com";

async function getAuthToken() {
  // Prefer NR_API creds; fall back to RCB_API creds (same Koenig instance, HR role also has Sales access)
  const username = process.env.NR_API_USERNAME || process.env.RCB_API_USERNAME;
  const password = process.env.NR_API_PASSWORD || process.env.RCB_API_PASSWORD;
  const role     = process.env.NR_API_ROLE || process.env.RCB_API_ROLE || "HR";
  if (!username || !password) throw new Error("No Koenig API credentials set (NR_API or RCB_API)");

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

  // YYYY-MM-DD (possibly with time suffix)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const MONTH_ABBR: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };

  // DD-Mon-YY or DD-Mon-YYYY  (e.g. 02-Apr-26 or 02-Apr-2026)
  const monMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (monMatch) {
    const [, dd, mon, yrRaw] = monMatch;
    const mm = MONTH_ABBR[mon.toLowerCase()];
    if (mm) {
      const yr = yrRaw.length === 2 ? `20${yrRaw}` : yrRaw;
      return `${yr}-${mm}-${dd.padStart(2, "0")}`;
    }
  }

  // DD/MM/YYYY  (e.g. 02/04/2026)
  const slashDM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDM) {
    const [, dd, mm, yyyy] = slashDM;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // MM/DD/YYYY  — try only when month > 12 is impossible (ambiguous, but common from US locale)
  // Handled by slashDM above; skip separate case to avoid ambiguity.

  // "April 2, 2026" or "2 April 2026"
  const MONTH_FULL: Record<string, string> = {
    january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",
    july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
  };
  const longFull = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (longFull) {
    const [, dd, mon, yyyy] = longFull;
    const mm = MONTH_FULL[mon.toLowerCase()] ?? MONTH_ABBR[mon.toLowerCase().slice(0, 3)];
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
  }
  const longFull2 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (longFull2) {
    const [, mon, dd, yyyy] = longFull2;
    const mm = MONTH_FULL[mon.toLowerCase()] ?? MONTH_ABBR[mon.toLowerCase().slice(0, 3)];
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
  }

  return null;
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
  if (!isCronAuthorized(req)) return cronForbidden();

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
    let skippedNoDept = 0, skippedBadDOJ = 0, skippedGarbage = 0, skippedNoEmpId = 0;

    for (const raw of rawRecords) {
      const empIdRaw = raw.EmpCode ?? raw.EmpId ?? raw.empId;
      if (!empIdRaw) { skippedNoEmpId++; continue; }
      const empId = String(empIdRaw).trim();
      if (!empId) { skippedNoEmpId++; continue; }

      const department = String(raw.Department ?? raw.Dept ?? raw.Division ?? "").trim();
      // Allow blank department (new joiners may not have it set yet in Koenig).
      // Only skip if department is explicitly something other than sales.
      if (department && !department.toLowerCase().includes("sales")) {
        skippedNoDept++;
        continue;
      }

      const managerName = String(
        raw.ReportingManager ?? raw.ReportingManagerName ?? raw.ManagerName ??
        raw.Manager ?? raw.RM ?? raw.RMName ?? ""
      ).trim();
      if (managerName.length >= 25 && !/\s/.test(managerName) && /^[a-zA-Z0-9]+$/.test(managerName)) {
        skippedGarbage++;
        continue;
      }

      const dojRaw = String(raw.DOJ ?? raw.DateOfJoining ?? raw.JoiningDate ?? "").trim();
      const joinDate = parseDOJ(dojRaw);
      if (!joinDate) { skippedBadDOJ++; continue; }

      const months = tenureMonths(joinDate);
      const name = String(raw.Name ?? raw.EmployeeName ?? "").trim();
      const location = String(raw.BaseLocation ?? raw.Location ?? raw.City ?? "").trim();
      const email = String(raw.Email ?? raw.EmailId ?? raw.WorkEmail ?? "").trim();
      const designation = String(raw.Designation ?? "").trim();
      const statusRaw = String(raw.Status ?? "Active").trim();
      const isActive = statusRaw.toLowerCase() === "active";

      const existing = await db.select().from(newJoiners).where(eq(newJoiners.empId, empId)).get();

      // Respect admin-set isActiveOverride; fall back to API status
      const resolvedIsActive =
        existing?.isActiveOverride !== null && existing?.isActiveOverride !== undefined
          ? existing.isActiveOverride
          : isActive;

      // Preserve existing non-empty managerId when API returns empty (protects manual fixes)
      const resolvedManager =
        managerName || (existing?.managerId ?? "");

      const record = {
        empId,
        name,
        managerId: resolvedManager,
        location: location || null,
        department: department || null,
        email: email || null,
        joinDate,
        tenureMonths: months,
        currentPhase: derivePhase(months),
        designation: designation || null,
        isActive: resolvedIsActive,
      };

      if (existing) {
        await db.update(newJoiners).set(record).where(eq(newJoiners.empId, empId));
      } else {
        await db.insert(newJoiners).values({ ...record, category: "Uncategorised" });
      }
      upsertedEmpIds.push(empId);
      count++;
    }

    // Deactivate NJs no longer in the API (skip those with an admin-locked isActiveOverride)
    const allNJs = await db.select().from(newJoiners).all();
    for (const nj of allNJs) {
      if (
        nj.empId &&
        !upsertedEmpIds.includes(nj.empId) &&
        nj.isActive &&
        (nj.isActiveOverride === null || nj.isActiveOverride === undefined)
      ) {
        await db.update(newJoiners).set({ isActive: false }).where(eq(newJoiners.id, nj.id));
      }
    }

    await upsertSyncLog("success", { recordsProcessed: count });
    return NextResponse.json({
      ok: true,
      synced: count,
      skipped: { noEmpId: skippedNoEmpId, nonSalesDept: skippedNoDept, badDOJ: skippedBadDOJ, garbageManager: skippedGarbage },
      rawTotal: rawRecords.length,
    });
  } catch (err) {
    await upsertSyncLog("error", { errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

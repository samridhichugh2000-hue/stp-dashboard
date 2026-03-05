"use node";
/**
 * Sync CSM (Customer Success Manager) headcount from the Koenig GetSalesData API.
 * NJ data is now sourced here instead of Google Sheets.
 *
 * Two-step auth (same as syncNRFromAPI):
 *   1. POST /api/Kites/Operator/GetToken → { accessToken, deviceToken }
 *   2. POST /api/Kites/Operator/GetSalesData → CSM records
 *
 * Reuses env vars:
 *   NR_API_USERNAME, NR_API_PASSWORD, NR_API_ROLE
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const MODULE = "csm";
const API_BASE_URL = "https://api.koenig-solutions.com";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<{ accessToken: string; deviceToken: string }> {
  const username = process.env.NR_API_USERNAME;
  const password = process.env.NR_API_PASSWORD;
  const role = process.env.NR_API_ROLE ?? "PMS";

  if (!username || !password) {
    throw new Error(
      "NR_API_USERNAME and NR_API_PASSWORD env vars must be set. " +
        "Run: npx convex env set NR_API_USERNAME <username>"
    );
  }

  const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: username,
      userPassword: password,
      userRole: role,
    }),
  });

  if (!res.ok) {
    throw new Error(`GetToken HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.statuscode !== 200) {
    throw new Error(`GetToken failed (${data.statuscode}): ${data.message}`);
  }

  return {
    accessToken: data.content.accessToken as string,
    deviceToken: data.content.deviceToken as string,
  };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DDTHH:mm:ss (ISO-like, no timezone) for the API. */
function formatISOLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
}

const MONTH_ABBR: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Parse DOJ formats from the API:
 *   "27-Feb-2026" → "2026-02-27"
 *   "27-Feb-26"   → "2026-02-27"  (2-digit year treated as 20xx)
 *   "2026-02-27"  → "2026-02-27"  (already ISO)
 */
function parseDOJ(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-Mon-YYYY or DD-Mon-YY
  const match = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return null;
  const [, dd, mon, yrRaw] = match;
  const mm = MONTH_ABBR[mon.toLowerCase()];
  if (!mm) return null;
  const yr = yrRaw.length === 2 ? `20${yrRaw}` : yrRaw;
  return `${yr}-${mm}-${dd.padStart(2, "0")}`;
}

// ── Phase / tenure helpers ────────────────────────────────────────────────────

function tenureMonths(joinDateISO: string): number {
  const join = new Date(joinDateISO);
  const today = new Date();
  return Math.max(
    0,
    (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
  );
}

function derivePhase(months: number): "Orientation" | "Training" | "Field" | "Graduated" {
  if (months < 1) return "Orientation";
  if (months < 3) return "Training";
  if (months < 6) return "Field";
  return "Graduated";
}

// ── Record parsing ────────────────────────────────────────────────────────────

interface CSMRecord {
  empId: string;
  name: string;
  designation: string;
  managerName: string;
  location: string;
  department: string;
  email: string;
  joinDate: string;
  tenureMonths: number;
  currentPhase: "Orientation" | "Training" | "Field" | "Graduated";
  isActive: boolean;
}

function parseCSMRecord(raw: Record<string, unknown>): CSMRecord | null {
  // EmpCode or EmpId
  const empIdRaw = raw.EmpCode ?? raw.EmpId ?? raw.empId;
  if (empIdRaw === undefined || empIdRaw === null) return null;
  const empId = String(empIdRaw).trim();
  if (!empId) return null;

  const designation = String(raw.Designation ?? raw.designation ?? "").trim();
  const department  = String(raw.Department ?? raw.Dept ?? raw.Division ?? raw.department ?? "").trim();
  if (!department.toLowerCase().includes("sales")) return null;

  const name = String(raw.Name ?? raw.EmployeeName ?? raw.name ?? "").trim();
  const managerName = String(raw.ReportingManager ?? raw.ManagerName ?? raw.Manager ?? raw.managerName ?? "").trim();
  // Reject if manager name is a Convex document ID (garbage data)
  if (managerName.length >= 25 && !/\s/.test(managerName) && /^[a-zA-Z0-9]+$/.test(managerName)) return null;
  const location = String(raw.BaseLocation ?? raw.Location ?? raw.City ?? raw.location ?? "").trim();
  const email = String(raw.Email ?? raw.EmailId ?? raw.EmailAddress ?? raw.WorkEmail ?? raw.email ?? "").trim();

  const dojRaw = String(raw.DOJ ?? raw.DateOfJoining ?? raw.JoiningDate ?? "").trim();
  const joinDate = parseDOJ(dojRaw);
  if (!joinDate) return null;

  const months = tenureMonths(joinDate);

  const statusRaw = String(raw.Status ?? raw.status ?? "Active").trim();
  const isActive = statusRaw.toLowerCase() === "active";

  return {
    empId,
    name,
    designation,
    managerName,
    location,
    department,
    email,
    joinDate,
    tenureMonths: months,
    currentPhase: derivePhase(months),
    isActive,
  };
}

// ── Main action ───────────────────────────────────────────────────────────────

export const syncCSMFromAPI = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
      module: MODULE,
      status: "running",
      lastSyncAt: new Date().toISOString(),
    });

    try {
      // Date range: 1 year ago → today
      const today = new Date();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

      // Step 1: Authenticate
      const { accessToken, deviceToken } = await getAuthToken();

      // Step 2: Fetch sales data
      const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetSalesData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: { accessToken, deviceToken },
          From: formatISOLocal(oneYearAgo),
          To: formatISOLocal(today),
        }),
      });

      if (!res.ok) {
        throw new Error(`GetSalesData HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.statuscode !== 200) {
        throw new Error(`GetSalesData failed (${data.statuscode}): ${data.message}`);
      }

      const rawRecords: unknown[] = Array.isArray(data.content) ? data.content : [];

      // Dump full first record so we can identify every field name + value
      if (rawRecords.length > 0) {
        console.log(`[syncCSMFromAPI] First record sample: ${JSON.stringify(rawRecords[0])}`);
        // Log EmpCode vs EmpId for all records to detect ID mismatches with CCE NR API
        const idSamples = rawRecords.slice(0, 5).map(r => {
          const rec = r as Record<string, unknown>;
          return `EmpCode=${rec.EmpCode ?? "?"} EmpId=${rec.EmpId ?? "?"} Name="${rec.Name ?? rec.EmployeeName ?? "?"}"`;
        });
        console.log(`[syncCSMFromAPI] ID field samples (first 5): ${idSamples.join(" | ")}`);
      }

      // Parse and filter for Customer Success
      const csms: CSMRecord[] = [];
      let skipped = 0;
      for (const raw of rawRecords) {
        const record = parseCSMRecord(raw as Record<string, unknown>);
        if (!record) {
          skipped++;
          const r = raw as Record<string, unknown>;
          console.log(
            `[syncCSMFromAPI] Skipped — EmpCode=${r.EmpCode ?? r.EmpId ?? "?"} Name="${r.Name ?? r.EmployeeName ?? "?"}" Designation="${r.Designation ?? "?"}" DOJ="${r.DOJ ?? "?"}" Status="${r.Status ?? "?"}"`
          );
          continue;
        }
        csms.push(record);
      }

      // Upsert each CSM into newJoiners
      const upsertedEmpIds: string[] = [];
      for (const csm of csms) {
        await ctx.runMutation(internal.mutations.newJoiners.upsertNewJoiner, {
          empId: csm.empId,
          name: csm.name,
          managerName: csm.managerName,
          location: csm.location || undefined,
          department: csm.department || undefined,
          email: csm.email || undefined,
          joinDate: csm.joinDate,
          tenureMonths: csm.tenureMonths,
          currentPhase: csm.currentPhase,
          designation: csm.designation,
          isActive: csm.isActive,
          // category intentionally omitted → preserved for existing, "Uncategorised" for new
        });
        upsertedEmpIds.push(csm.empId);
      }

      // Deactivate any NJs no longer in the API response
      await ctx.runMutation(internal.mutations.newJoiners.deactivateNJsExcept, {
        empIds: upsertedEmpIds,
      });

      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "success",
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: csms.length,
      });

      console.log(
        `[syncCSMFromAPI] Done — ${csms.length} upserted, ${skipped} skipped (non-CS or parse failures).`
      );
    } catch (err) {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "error",
        lastSyncAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
});

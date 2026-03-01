"use node";
/**
 * Sync NR data from the Koenig CCE NR live API.
 *
 * Two-step auth:
 *   1. POST /api/Kites/Operator/GetToken → { accessToken, deviceToken }
 *   2. POST /api/Kites/Operator/GetCCENRData (with tokens + date range) → NR records
 *
 * Required Convex env vars:
 *   npx convex env set NR_API_USERNAME "Samridhi"
 *   npx convex env set NR_API_PASSWORD "Samridhi@2025"
 *   npx convex env set NR_API_ROLE "PMS"
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const MODULE = "nr";
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

/** Format a Date as DD/MM/YYYY (used by the Koenig API). */
function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ── Response parsing ──────────────────────────────────────────────────────────
// API response shape (one record per CSM):
// {
//   "EmpId": 58,
//   "CCE": "Rimpy Srivastava-Rimpy",
//   "DOJ": "2008-06-16",
//   "MonthlyRevenue": { "Mar-2026": "332753.00", "Feb-2026": "1141545.00", ... }
// }

interface ParsedNRRecord {
  empId: string;
  month: number;
  year: number;
  nrValue: number;
}

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse a MonthlyRevenue key like "Mar-2026" → { month: 3, year: 2026 }. */
function parseMonthKey(key: string): { month: number; year: number } | null {
  const parts = key.split("-");
  if (parts.length !== 2) return null;
  const month = MONTH_ABBR[parts[0].toLowerCase().slice(0, 3)];
  const year = parseInt(parts[1], 10);
  if (!month || isNaN(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

/** Expand one CSM record into one ParsedNRRecord per month in MonthlyRevenue. */
function parseCSMRecord(raw: Record<string, unknown>): ParsedNRRecord[] {
  const empIdRaw = raw.EmpId ?? raw.empId;
  if (empIdRaw === undefined || empIdRaw === null) return [];
  const empId = String(empIdRaw).trim();
  if (!empId) return [];

  const monthly = raw.MonthlyRevenue;
  if (!monthly || typeof monthly !== "object" || Array.isArray(monthly)) return [];

  const records: ParsedNRRecord[] = [];
  for (const [key, val] of Object.entries(monthly as Record<string, unknown>)) {
    const parsed = parseMonthKey(key);
    if (!parsed) continue;
    const nrValue =
      typeof val === "string"
        ? parseFloat(val.replace(/,/g, ""))
        : Number(val);
    if (isNaN(nrValue)) continue;
    records.push({ empId, month: parsed.month, year: parsed.year, nrValue });
  }
  return records;
}

// ── Main action ───────────────────────────────────────────────────────────────

export const syncNRFromAPI = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
      module: MODULE,
      status: "running",
      lastSyncAt: new Date().toISOString(),
    });

    try {
      // Date range: first day 12 months ago → today
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);

      // Step 1: Authenticate
      const { accessToken, deviceToken } = await getAuthToken();

      // Step 2: Fetch NR data
      const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetCCENRData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: { accessToken, deviceToken },
          startDate: formatDate(startDate),
          endDate: formatDate(today),
        }),
      });

      if (!res.ok) {
        throw new Error(`GetCCENRData HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.statuscode !== 200) {
        throw new Error(`GetCCENRData failed (${data.statuscode}): ${data.message}`);
      }

      const rawRecords: unknown[] = Array.isArray(data.content) ? data.content : [];

      // Collect all (empId, month, year) → nrValue entries
      const aggregated = new Map<string, ParsedNRRecord>();
      let skipped = 0;

      for (const raw of rawRecords) {
        const records = parseCSMRecord(raw as Record<string, unknown>);
        if (records.length === 0) { skipped++; continue; }
        for (const record of records) {
          // Deduplicate in case the API ever returns duplicate entries
          const key = `${record.empId}|${record.year}|${record.month}`;
          if (!aggregated.has(key)) aggregated.set(key, record);
        }
      }

      // Upsert each aggregated record
      let count = 0;
      for (const record of aggregated.values()) {
        await ctx.runMutation(internal.mutations.nr.upsertNRByEmpId, {
          empId: record.empId,
          month: record.month,
          year: record.year,
          nrValue: record.nrValue,
          isPositive: record.nrValue > 0,
          source: "RMS",
        });
        count++;
      }

      // Re-evaluate categories based on fresh NR data
      await ctx.runAction(internal.actions.evaluateCategories.evaluateCategories, {});

      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "success",
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: count,
      });

      console.log(
        `[syncNRFromAPI] Done — ${count} upserted, ${skipped} skipped (parse failures).`
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

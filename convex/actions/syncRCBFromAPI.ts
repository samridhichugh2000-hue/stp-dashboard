"use node";
/**
 * Sync RCB (Regular Corporate Business) summary from the Koenig live API.
 *
 * Two-step auth:
 *   1. POST /api/Kites/Operator/GetToken → { accessToken, deviceToken }
 *   2. POST /api/Kites/Operator/GetRCBData (EmpId=0 for all) → per-CSM summary
 *
 * API response shape per record:
 *   { UserName, EmpId, CCEEmailId, Corporates, NR, NoOfClients }
 *
 * Required Convex env vars:
 *   npx convex env set RCB_API_USERNAME "Samridhi"
 *   npx convex env set RCB_API_PASSWORD "Samridhi@26"
 *   npx convex env set RCB_API_ROLE "HR"
 */

import { internalAction, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const MODULE = "rcb";
const API_BASE_URL = "https://api.koenig-solutions.com";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<{ accessToken: string; deviceToken: string }> {
  const username = process.env.RCB_API_USERNAME;
  const password = process.env.RCB_API_PASSWORD;
  const role = process.env.RCB_API_ROLE ?? "HR";

  if (!username || !password) {
    throw new Error(
      "RCB_API_USERNAME and RCB_API_PASSWORD env vars must be set. " +
        "Run: npx convex env set RCB_API_USERNAME <username>"
    );
  }

  const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, userPassword: password, userRole: role }),
  });

  if (!res.ok) throw new Error(`GetToken HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`GetToken failed (${data.statuscode}): ${data.message}`);

  return {
    accessToken: data.content.accessToken as string,
    deviceToken: data.content.deviceToken as string,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const n = parseFloat(String(raw ?? "0").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// ── Response parsing ──────────────────────────────────────────────────────────
// API response shape (one summary record per CSM):
// { "UserName": "Gurpreet Kaur", "EmpId": "2253", "CCEEmailId": "...",
//   "Corporates": "7", "NR": "206666757.35", "NoOfClients": "11" }

interface ParsedRCBSummary {
  empId: string;
  claimedCorporates: number;
  nrFromCorporates: number;
  noOfClients: number;
}

function parseRCBSummaryRecord(raw: Record<string, unknown>): ParsedRCBSummary | null {
  const empIdRaw = raw.EmpId ?? raw.empId ?? raw.EmpID;
  if (empIdRaw === undefined || empIdRaw === null) return null;
  const empId = String(empIdRaw).trim();
  if (!empId || empId === "0") return null;

  return {
    empId,
    claimedCorporates: parseNumber(raw.Corporates ?? raw.corporates ?? 0),
    nrFromCorporates: parseNumber(raw.NR ?? raw.nr ?? raw.Revenue ?? 0),
    noOfClients: parseNumber(raw.NoOfClients ?? raw.noOfClients ?? 0),
  };
}

// ── Main action ───────────────────────────────────────────────────────────────

export const syncRCBFromAPI = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
      module: MODULE,
      status: "running",
      lastSyncAt: new Date().toISOString(),
    });

    try {
      const today = new Date();
      const startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

      const { accessToken, deviceToken } = await getAuthToken();

      const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetRCBData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: { accessToken, deviceToken },
          EmpId: "0",
          startDate: formatDate(startDate),
          endDate: formatDate(today),
        }),
      });

      if (!res.ok) throw new Error(`GetRCBData HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();
      if (data.statuscode !== 200) throw new Error(`GetRCBData failed (${data.statuscode}): ${data.message}`);

      const rawRecords: unknown[] = Array.isArray(data.content) ? data.content : [];
      console.log(`[syncRCBFromAPI] Received ${rawRecords.length} detail records.`);

      // API returns one row per corporate (not one per CSM), so aggregate by empId first.
      const aggregated = new Map<string, { claimedCorporates: number; nrFromCorporates: number; noOfClients: number }>();
      let skipped = 0;

      for (const raw of rawRecords) {
        const parsed = parseRCBSummaryRecord(raw as Record<string, unknown>);
        if (!parsed) { skipped++; continue; }
        const existing = aggregated.get(parsed.empId);
        if (existing) {
          existing.claimedCorporates += 1; // each row = one corporate
          existing.nrFromCorporates += parsed.nrFromCorporates;
          existing.noOfClients += parsed.noOfClients;
        } else {
          aggregated.set(parsed.empId, {
            claimedCorporates: 1,
            nrFromCorporates: parsed.nrFromCorporates,
            noOfClients: parsed.noOfClients,
          });
        }
      }

      let count = 0;
      for (const [empId, agg] of aggregated) {
        await ctx.runMutation(internal.mutations.rcb.upsertRCBSummary, {
          empId,
          claimedCorporates: agg.claimedCorporates,
          nrFromCorporates: agg.nrFromCorporates,
          noOfClients: agg.noOfClients,
        });
        count++;
      }

      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "success",
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: count,
      });

      console.log(`[syncRCBFromAPI] Done — ${count} upserted, ${skipped} skipped.`);
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

// ── Public action: fetch RCB data for a custom date range (no DB write) ───────

export const getRCBForRange = action({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),   // YYYY-MM-DD
  },
  handler: async (_ctx, args): Promise<Array<{ empId: string; claimedCorporates: number; nrFromCorporates: number; noOfClients: number }>> => {
    const { accessToken, deviceToken } = await getAuthToken();

    const res = await fetch(`${API_BASE_URL}/api/Kites/Operator/GetRCBData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: { accessToken, deviceToken },
        EmpId: "0",
        startDate: args.startDate,
        endDate: args.endDate,
      }),
    });

    if (!res.ok) throw new Error(`GetRCBData HTTP ${res.status}: ${res.statusText}`);

    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`GetRCBData failed (${data.statuscode}): ${data.message}`);

    const rawRecords: unknown[] = Array.isArray(data.content) ? data.content : [];

    // Aggregate by empId: one row per corporate in API response.
    const aggregated = new Map<string, { claimedCorporates: number; nrFromCorporates: number; noOfClients: number }>();
    for (const raw of rawRecords) {
      const parsed = parseRCBSummaryRecord(raw as Record<string, unknown>);
      if (!parsed) continue;
      const existing = aggregated.get(parsed.empId);
      if (existing) {
        existing.claimedCorporates += 1;
        existing.nrFromCorporates += parsed.nrFromCorporates;
        existing.noOfClients += parsed.noOfClients;
      } else {
        aggregated.set(parsed.empId, { claimedCorporates: 1, nrFromCorporates: parsed.nrFromCorporates, noOfClients: parsed.noOfClients });
      }
    }

    return Array.from(aggregated.entries()).map(([empId, agg]) => ({ empId, ...agg }));
  },
});

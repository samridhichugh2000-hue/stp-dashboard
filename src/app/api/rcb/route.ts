import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rcbSummary, newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "summary";

  if (mode === "range") {
    // Custom date range — proxy to Koenig API
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }
    const result = await fetchRCBForRange(startDate, endDate);
    return NextResponse.json(result);
  }

  // Default: allCorpSummary — join rcbSummary with newJoiners
  const njs = await db.select().from(newJoiners).where(eq(newJoiners.isActive, true)).all();
  const summaries = await db.select().from(rcbSummary).all();

  const summaryMap = new Map(summaries.map((s) => [s.njId, s]));

  const rows = njs
    .filter((nj) => {
      if (!nj.empId) return false;
      if (nj.empId.startsWith("MOCK-")) return false;
      if (nj.managerId.length >= 25 && !nj.managerId.includes(" ") && /^[a-z0-9]+$/.test(nj.managerId)) return false;
      return true;
    })
    .map((nj) => {
      const s = summaryMap.get(nj.id);
      return {
        id: nj.id,
        empId: nj.empId,
        name: nj.name,
        designation: nj.designation,
        tenureMonths: nj.tenureMonths,
        joinDate: nj.joinDate,
        claimedCorporates: s?.claimedCorporates ?? 0,
        nrFromCorporates: s?.nrFromCorporates ?? 0,
        managerId: nj.managerId,
      };
    });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { startDate, endDate } = body;
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }
  try {
    const result = await fetchRCBForRange(startDate, endDate);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

async function fetchRCBForRange(
  startDate: string,
  endDate: string
): Promise<Array<{ empId: string; claimedCorporates: number; nrFromCorporates: number; noOfClients: number }>> {
  const username = process.env.RCB_API_USERNAME;
  const password = process.env.RCB_API_PASSWORD;
  const role = process.env.RCB_API_ROLE ?? "HR";

  if (!username || !password) throw new Error("RCB_API_USERNAME and RCB_API_PASSWORD not set");

  const BASE = "https://api.koenig-solutions.com";

  const tokenRes = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, userPassword: password, userRole: role }),
  });
  if (!tokenRes.ok) throw new Error(`GetToken HTTP ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  if (tokenData.statuscode !== 200) throw new Error(`GetToken failed: ${tokenData.message}`);

  const { accessToken, deviceToken } = tokenData.content;

  const res = await fetch(`${BASE}/api/Kites/Operator/GetRCBData`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: { accessToken, deviceToken },
      EmpId: "0",
      startDate,
      endDate,
    }),
  });
  if (!res.ok) throw new Error(`GetRCBData HTTP ${res.status}`);
  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`GetRCBData failed: ${data.message}`);

  const rawRecords: Record<string, unknown>[] = Array.isArray(data.content) ? data.content : [];
  const aggregated = new Map<string, { claimedCorporates: number; nrFromCorporates: number; noOfClients: number }>();

  for (const raw of rawRecords) {
    const empIdRaw = raw.EmpId ?? raw.empId ?? raw.EmpID;
    if (!empIdRaw) continue;
    const empId = String(empIdRaw).trim();
    if (!empId || empId === "0") continue;

    const parseNum = (v: unknown) => {
      if (typeof v === "number") return v;
      const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
      return isNaN(n) ? 0 : n;
    };

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

  return Array.from(aggregated.entries()).map(([empId, agg]) => ({ empId, ...agg }));
}

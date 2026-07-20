import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nrRecords, newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

const BASE = "https://api.koenig-solutions.com/";

async function getROIToken(): Promise<{ accessToken: string; deviceToken: string }> {
  const res = await fetch(`${BASE}api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: "Samridhi",
      userPassword: "Samridhi@2025",
      userRole: "PMS",
    }),
  });
  if (!res.ok) throw new Error(`GetToken HTTP ${res.status}`);
  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`Auth failed: ${data.message}`);
  return { accessToken: data.content.accessToken, deviceToken: data.content.deviceToken };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { from_date, to_date, display_column } = body;

  try {
    const { accessToken, deviceToken } = await getROIToken();
    const res = await fetch(`${BASE}api/Kites/Operator/GetROIData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: { accessToken, deviceToken },
        from_date,
        to_date,
        display_column: display_column ?? "CCE",
      }),
    });
    if (!res.ok) throw new Error(`GetROIData HTTP ${res.status}`);
    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // GET /api/roi → currentROISummary (replaces Convex query)
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allNRRecords = await db.select().from(nrRecords).all();
  const activeNJs = await db
    .select()
    .from(newJoiners)
    .where(eq(newJoiners.isActive, true))
    .all();

  const totals = new Map<number, number>();
  for (const r of allNRRecords) {
    totals.set(r.njId, (totals.get(r.njId) ?? 0) + r.nrValue);
  }

  const rows = [...activeNJs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((nj) => ({
      id: nj.id,
      name: nj.name,
      designation: nj.designation,
      tenureMonths: nj.tenureMonths,
      joinDate: nj.joinDate,
      managerId: nj.managerId,
      totalNR: totals.has(nj.id) ? totals.get(nj.id)! : null,
      pipStatus: nj.pipStatus ?? null,
      pipFirstSeenAt: nj.pipFirstSeenAt ?? null,
    }));

  return NextResponse.json(rows);
}

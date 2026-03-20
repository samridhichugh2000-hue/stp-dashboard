import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, nrRecords } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

function isGarbage(nj: { empId: string | null; managerId: string; name: string }): boolean {
  if (!nj.name?.trim()) return true;
  if (!nj.empId) return true;
  if (nj.empId.startsWith("MOCK-")) return true;
  const mid = nj.managerId ?? "";
  if (mid.length >= 25 && !/\s/.test(mid) && /^[a-zA-Z0-9]+$/.test(mid)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  let all = await db.select().from(newJoiners).all();

  if (!includeInactive) {
    all = all.filter((nj) => nj.isActive);
  }

  const valid = all.filter((nj) => !isGarbage(nj));

  // Attach hasPositiveNR: true if NJ has at least one positive NR record
  const allNR = await db.select({ njId: nrRecords.njId, isPositive: nrRecords.isPositive }).from(nrRecords).all();
  const positiveNJIds = new Set(allNR.filter(r => r.isPositive).map(r => r.njId));

  const result = valid.map(nj => ({ ...nj, hasPositiveNR: positiveNJIds.has(nj.id) }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.empId) {
    return NextResponse.json({ error: "empId required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(newJoiners)
    .where(eq(newJoiners.empId, body.empId))
    .get();

  if (existing) {
    await db.update(newJoiners).set(body).where(eq(newJoiners.empId, body.empId));
  } else {
    await db.insert(newJoiners).values(body);
  }

  return NextResponse.json({ ok: true });
}

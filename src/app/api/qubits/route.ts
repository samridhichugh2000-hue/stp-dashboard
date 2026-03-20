import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qubitScores, newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const njIdParam = searchParams.get("njId");

  if (njIdParam) {
    const njId = parseInt(njIdParam, 10);
    const scores = await db
      .select()
      .from(qubitScores)
      .where(eq(qubitScores.njId, njId))
      .all();
    scores.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(scores);
  }

  // allSummary — one record per active NJ with qubit data
  const activeNJs = await db
    .select()
    .from(newJoiners)
    .where(eq(newJoiners.isActive, true))
    .all();

  const allScores = await db.select().from(qubitScores).all();
  const scoreMap = new Map<number, (typeof allScores)[0]>();
  for (const s of allScores) {
    const existing = scoreMap.get(s.njId);
    if (!existing || s.date > existing.date) {
      scoreMap.set(s.njId, s);
    }
  }

  const summary = activeNJs
    .filter((nj) => nj.empId && !nj.empId.startsWith("MOCK-"))
    .map((nj) => ({
      id: nj.id,
      name: nj.name,
      empId: nj.empId,
      designation: nj.designation,
      joinDate: nj.joinDate,
      latestScore: scoreMap.get(nj.id)?.score ?? null,
      latestDate: scoreMap.get(nj.id)?.date ?? null,
    }))
    .sort((a, b) => b.joinDate.localeCompare(a.joinDate));

  return NextResponse.json(summary);
}

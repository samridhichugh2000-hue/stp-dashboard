import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nrRecords, newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "monthlyGrid";
  const njIdParam = searchParams.get("njId");

  if (q === "byNJ" && njIdParam) {
    const njId = parseInt(njIdParam, 10);
    const records = await db
      .select()
      .from(nrRecords)
      .where(eq(nrRecords.njId, njId))
      .all();
    records.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
    return NextResponse.json(records);
  }

  if (q === "stats") {
    const all = await db.select().from(nrRecords).all();
    const activeNJs = await db
      .select()
      .from(newJoiners)
      .where(eq(newJoiners.isActive, true))
      .all();

    let totalPositive = 0, totalNegative = 0, positiveWithin4 = 0, negativeAfter4 = 0;

    for (const nj of activeNJs) {
      const njRecords = all.filter((r) => r.njId === nj.id);
      if (njRecords.length === 0) continue;
      const latest = [...njRecords].sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.month - a.month
      )[0];
      if (latest.isPositive) {
        totalPositive++;
        if (nj.tenureMonths <= 4) positiveWithin4++;
      } else {
        totalNegative++;
        if (nj.tenureMonths > 4) negativeAfter4++;
      }
    }
    return NextResponse.json({ totalPositive, totalNegative, positiveWithin4, negativeAfter4 });
  }

  // monthlyGrid (default)
  const all = await db.select().from(nrRecords).all();
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const months = [
    ...new Set([currentKey, ...all.map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`)])
  ].sort().reverse();

  return NextResponse.json({ records: all, months });
}

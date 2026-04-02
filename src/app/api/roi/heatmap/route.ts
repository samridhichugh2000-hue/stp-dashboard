import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roiRecords, newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeNJs = await db
    .select()
    .from(newJoiners)
    .where(eq(newJoiners.isActive, true))
    .all();

  const valid = activeNJs.filter(
    nj => nj.empId && !nj.empId.startsWith("MOCK-") && nj.name?.trim()
  );

  const allROI = await db.select().from(roiRecords).all();

  // Group ROI by njId → weekStart
  const roiByNJ = new Map<number, Map<string, { roiValue: number; colorCode: string }>>();
  for (const r of allROI) {
    if (!roiByNJ.has(r.njId)) roiByNJ.set(r.njId, new Map());
    roiByNJ.get(r.njId)!.set(r.weekStart, { roiValue: r.roiValue, colorCode: r.colorCode });
  }

  // Collect all unique weekStarts, sorted ascending
  const allWeeks = [...new Set(allROI.map(r => r.weekStart))].sort();

  const rows = valid
    .sort((a, b) => b.joinDate.localeCompare(a.joinDate))
    .map(nj => {
      const njROI = roiByNJ.get(nj.id) ?? new Map();
      // Count consecutive red weeks (most recent trailing streak)
      let consecutiveRed = 0;
      for (let i = allWeeks.length - 1; i >= 0; i--) {
        const cell = njROI.get(allWeeks[i]);
        if (cell?.colorCode === "Red") consecutiveRed++;
        else break;
      }
      return {
        id:             nj.id,
        name:           nj.name,
        empId:          nj.empId,
        joinDate:       nj.joinDate,
        tenureMonths:   nj.tenureMonths,
        managerId:      nj.managerId,
        weeks:          Object.fromEntries(njROI),
        consecutiveRed,
      };
    });

  return NextResponse.json({ weeks: allWeeks, rows });
}

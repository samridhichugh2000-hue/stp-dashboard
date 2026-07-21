import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, nrRecords } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

function isValidNJ(nj: { empId: string | null; managerId: string }): boolean {
  if (!nj.empId) return false;
  if (nj.empId.startsWith("MOCK-")) return false;
  if (nj.managerId.length >= 25 && !nj.managerId.includes(" ") && /^[a-z0-9]+$/.test(nj.managerId)) return false;
  return true;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const njs = (await db.select().from(newJoiners).where(eq(newJoiners.isActive, true)).all()).filter(isValidNJ);
  const allNR = await db.select().from(nrRecords).all();

  const now = new Date();

  function livetenureMonths(joinDateISO: string): number {
    const doj = new Date(joinDateISO);
    return (now.getFullYear() - doj.getFullYear()) * 12 + (now.getMonth() - doj.getMonth());
  }

  const rows = [...njs].sort((a, b) => b.joinDate.localeCompare(a.joinDate)).map((nj) => {
    const njNRRecords = allNR.filter((r) => r.njId === nj.id);

    let nrStatus: "Positive" | "Negative" | null = null;
    let nrPositiveMonth: number | null = null;
    let roiStatus: "Positive" | "Negative" | null = null;

    if (njNRRecords.length > 0) {
      const latest = [...njNRRecords].sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.month - a.month
      )[0];
      nrStatus = latest.isPositive ? "Positive" : "Negative";

      const totalNR = njNRRecords.reduce((s, r) => s + r.nrValue, 0);
      roiStatus = totalNR > 0 ? "Positive" : "Negative";

      const joinDate = new Date(nj.joinDate);
      const joinYear = joinDate.getFullYear();
      const joinMonth = joinDate.getMonth() + 1;

      const positiveEarly = njNRRecords
        .map((r) => ({ ...r, tenureMonth: (r.year - joinYear) * 12 + (r.month - joinMonth) }))
        .filter((r) => r.isPositive && r.tenureMonth >= 1 && r.tenureMonth <= 4)
        .sort((a, b) => a.tenureMonth - b.tenureMonth);

      if (positiveEarly.length > 0) {
        nrPositiveMonth = positiveEarly[0].tenureMonth;
      }
    }

    return {
      id: nj.id,
      name: nj.name,
      designation: nj.designation,
      joinDate: nj.joinDate,
      tenureMonths: livetenureMonths(nj.joinDate),
      category: nj.category,
      nrStatus,
      nrPositiveMonth,
      roiStatus,
      claimedCorporates: 0,
      pipStatus: nj.pipStatus ?? null,
      pipFirstSeenAt: nj.pipFirstSeenAt ?? null,
      pipFromDate: nj.pipFromDate ?? null,
      pipToDate: nj.pipToDate ?? null,
    };
  });

  return NextResponse.json(rows);
}


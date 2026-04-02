import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { performanceAlerts, newJoiners, nrRecords } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/auth";

// Auto-generate alerts for NJs that hit tenure milestones with negative NR
async function ensureAlerts() {
  const activeNJs = await db
    .select()
    .from(newJoiners)
    .where(eq(newJoiners.isActive, true))
    .all();

  const allNR = await db.select().from(nrRecords).all();
  const existing = await db.select().from(performanceAlerts).all();

  const existingSet = new Set(existing.map(a => `${a.njId}-${a.alertType}`));

  const toInsert: { njId: number; alertType: string; triggeredAt: string }[] = [];

  for (const nj of activeNJs) {
    if (!nj.empId || nj.empId.startsWith("MOCK-")) continue;

    const njNR = allNR
      .filter(r => r.njId === nj.id)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    if (njNR.length === 0) continue;
    const latestNR = njNR[njNR.length - 1];
    const isNeg = !latestNR.isPositive;
    const tenure = nj.tenureMonths ?? 0;

    if (isNeg && tenure >= 3 && !existingSet.has(`${nj.id}-PA`)) {
      toInsert.push({ njId: nj.id, alertType: "PA", triggeredAt: new Date().toISOString() });
      existingSet.add(`${nj.id}-PA`);
    }
    if (isNeg && tenure >= 4 && !existingSet.has(`${nj.id}-PIP`)) {
      toInsert.push({ njId: nj.id, alertType: "PIP", triggeredAt: new Date().toISOString() });
      existingSet.add(`${nj.id}-PIP`);
    }
    if (isNeg && tenure >= 5 && !existingSet.has(`${nj.id}-EXIT`)) {
      toInsert.push({ njId: nj.id, alertType: "EXIT", triggeredAt: new Date().toISOString() });
      existingSet.add(`${nj.id}-EXIT`);
    }
  }

  for (const row of toInsert) {
    await db.insert(performanceAlerts).values(row);
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureAlerts();

  const alerts = await db.select().from(performanceAlerts).all();
  const njs    = await db.select().from(newJoiners).all();
  const njMap  = new Map(njs.map(n => [n.id, { name: n.name, empId: n.empId }]));

  const result = alerts
    .map(a => ({
      ...a,
      njName:  njMap.get(a.njId)?.name  ?? "Unknown",
      njEmpId: njMap.get(a.njId)?.empId ?? "",
    }))
    .sort((a, b) => {
      // Pending first, then by triggered date desc
      const aPending = !a.acknowledgedAt;
      const bPending = !b.acknowledgedAt;
      if (aPending !== bPending) return aPending ? -1 : 1;
      return b.triggeredAt.localeCompare(a.triggeredAt);
    });

  return NextResponse.json(result);
}

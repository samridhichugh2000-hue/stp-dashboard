import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners, nrRecords, performanceAlerts } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

function workingDaysSince(dojISO: string): number {
  const doj = new Date(dojISO);
  doj.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allNJs = await db.select().from(newJoiners).all();
  const today = new Date().toISOString().split("T")[0];
  let updated = 0;

  for (const nj of allNJs) {
    if (!nj.isActive) continue;

    const joinDate = new Date(nj.joinDate);
    const todayDate = new Date(today);
    const tenureMs = todayDate.getTime() - joinDate.getTime();
    const tenureMonths = Math.floor(tenureMs / (1000 * 60 * 60 * 24 * 30));

    // Update tenureMonths
    await db.update(newJoiners).set({ tenureMonths }).where(eq(newJoiners.id, nj.id));

    async function ensureAlert(alertType: "PA" | "PIP" | "EXIT") {
      const existing = await db
        .select()
        .from(performanceAlerts)
        .where(and(eq(performanceAlerts.njId, nj.id), eq(performanceAlerts.alertType, alertType)))
        .get();
      if (!existing) {
        await db.insert(performanceAlerts).values({
          njId: nj.id,
          alertType,
          triggeredAt: new Date().toISOString(),
        });
      }
    }

    // ── STP transition fallback ──────────────────────────────────────────────
    // If the teams-huddle cron missed the day-19 transition, catch it here
    if (nj.category === "Uncategorised" && workingDaysSince(nj.joinDate) > 18) {
      const allNR       = await db.select().from(nrRecords).where(eq(nrRecords.njId, nj.id)).all();
      const isDeveloped = allNR.some(r => r.isPositive);
      await db.update(newJoiners)
        .set({ category: isDeveloped ? "Developed" : "Non-Performer" })
        .where(eq(newJoiners.id, nj.id));
    }

    if (tenureMonths >= 3) await ensureAlert("PA");

    if (tenureMonths >= 4) {
      const allNR = await db
        .select()
        .from(nrRecords)
        .where(eq(nrRecords.njId, nj.id))
        .all();

      const todayObj = new Date();
      const lastMonth = todayObj.getMonth() === 0 ? 12 : todayObj.getMonth();
      const lastMonthYear = todayObj.getMonth() === 0 ? todayObj.getFullYear() - 1 : todayObj.getFullYear();

      const lastMonthNR = allNR.find(r => r.month === lastMonth && r.year === lastMonthYear);

      if (lastMonthNR && !lastMonthNR.isPositive) {
        await ensureAlert("PIP");
      }

      if (tenureMonths >= 5 && lastMonthNR && !lastMonthNR.isPositive) {
        await ensureAlert("EXIT");
      }
    }

    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}

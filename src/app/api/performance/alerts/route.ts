import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { performanceAlerts } from "@/lib/schema";
import { auth } from "@/auth";
import { isNull, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await db
    .select()
    .from(performanceAlerts)
    .where(isNull(performanceAlerts.acknowledgedAt))
    .all();

  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { alertId } = await req.json();
  if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  await db
    .update(performanceAlerts)
    .set({ acknowledgedAt: new Date().toISOString(), acknowledgedBy: (session.user as { name?: string })?.name ?? "Admin" })
    .where(eq(performanceAlerts.id, alertId));

  return NextResponse.json({ ok: true });
}

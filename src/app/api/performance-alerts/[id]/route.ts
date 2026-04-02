import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { performanceAlerts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(session.user?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const alertId = parseInt(id, 10);
  if (isNaN(alertId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await db
    .update(performanceAlerts)
    .set({
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: session.user?.email ?? session.user?.name ?? "unknown",
    })
    .where(eq(performanceAlerts.id, alertId));

  return NextResponse.json({ ok: true });
}

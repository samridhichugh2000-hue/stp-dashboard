import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

type ProgressField = "managerHuddle" | "stpMetrics";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const njId = parseInt(id, 10);
  if (isNaN(njId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { field, done } = await req.json() as { field: ProgressField; done: boolean };
  const by   = done ? (session.user?.email ?? session.user?.name ?? "admin") : null;
  const at   = done ? new Date().toISOString() : null;

  const updates =
    field === "managerHuddle"
      ? { managerHuddleDone: done, managerHuddleDoneAt: at, managerHuddleDoneBy: by }
      : { stpMetricsDone: done, stpMetricsDoneAt: at, stpMetricsDoneBy: by };

  await db.update(newJoiners).set(updates).where(eq(newJoiners.id, njId));

  return NextResponse.json({ ok: true });
}

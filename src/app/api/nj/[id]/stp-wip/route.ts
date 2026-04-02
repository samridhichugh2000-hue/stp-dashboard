import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

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

  const { mark, note } = await req.json() as { mark: boolean; note?: string };

  await db
    .update(newJoiners)
    .set({
      stpWipMarked:   mark,
      stpWipNote:     mark ? (note ?? null) : null,
      stpWipMarkedAt: mark ? new Date().toISOString() : null,
      stpWipMarkedBy: mark ? (session.user?.email ?? session.user?.name ?? "admin") : null,
    })
    .where(eq(newJoiners.id, njId));

  return NextResponse.json({ ok: true });
}

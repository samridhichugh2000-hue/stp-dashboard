import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newJoiners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const njId = parseInt(id, 10);
  if (isNaN(njId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const nj = await db.select().from(newJoiners).where(eq(newJoiners.id, njId)).get();
  if (!nj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(nj);
}

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

  const nj = await db.select().from(newJoiners).where(eq(newJoiners.id, njId)).get();
  if (!nj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    managerId?: string;
    isActive?: boolean;
    isActiveOverride?: boolean | null;  // null clears the override (re-enables sync control)
  };

  const patch: Record<string, unknown> = {};

  if (body.managerId !== undefined) {
    patch.managerId = body.managerId;
  }

  if (body.isActive !== undefined) {
    patch.isActive = body.isActive;
    // Setting isActive manually also sets the override so sync won't undo it
    patch.isActiveOverride = body.isActive;
  }

  // Allow explicit override control (e.g. pass null to clear/re-enable sync)
  if ("isActiveOverride" in body) {
    patch.isActiveOverride = body.isActiveOverride ?? null;
    if (body.isActiveOverride !== undefined && body.isActiveOverride !== null) {
      patch.isActive = body.isActiveOverride;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(newJoiners).set(patch).where(eq(newJoiners.id, njId));
  return NextResponse.json({ ok: true });
}

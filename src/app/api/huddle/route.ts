import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { huddleLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const njIdParam = searchParams.get("njId");

  if (njIdParam) {
    const njId = parseInt(njIdParam, 10);
    const logs = await db
      .select()
      .from(huddleLogs)
      .where(eq(huddleLogs.njId, njId))
      .all();
    logs.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(logs);
  }

  const all = await db.select().from(huddleLogs).all();
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, huddleId, ...data } = body;

  if (action === "markComplete" && huddleId) {
    await db
      .update(huddleLogs)
      .set({ completed: true })
      .where(eq(huddleLogs.id, parseInt(huddleId, 10)));
    return NextResponse.json({ ok: true });
  }

  // Create new huddle log
  await db.insert(huddleLogs).values({
    njId: data.njId,
    date: data.date,
    type: data.type ?? "Daily",
    conductedBy: data.conductedBy ?? "System",
    completed: data.completed ?? false,
    notes: data.notes,
    teamsEventId: data.teamsEventId,
  });
  return NextResponse.json({ ok: true });
}

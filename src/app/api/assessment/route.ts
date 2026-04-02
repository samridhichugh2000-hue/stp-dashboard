import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessmentChecklists } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const njId = parseInt(searchParams.get("njId") ?? "", 10);
  if (isNaN(njId)) return NextResponse.json({ error: "njId required" }, { status: 400 });

  const records = await db
    .select()
    .from(assessmentChecklists)
    .where(eq(assessmentChecklists.njId, njId))
    .all();

  records.sort((a, b) => b.filledAt.localeCompare(a.filledAt));
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(session.user?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { njId, managerNotes, hrNotes, outcome, checklistData } = body;

  await db.insert(assessmentChecklists).values({
    njId,
    filledBy:      session.user?.email ?? session.user?.name ?? "unknown",
    filledAt:      new Date().toISOString(),
    managerNotes:  managerNotes ?? null,
    hrNotes:       hrNotes ?? null,
    outcome:       outcome ?? "Pending",
    checklistData: checklistData ? JSON.stringify(checklistData) : null,
  });

  return NextResponse.json({ ok: true });
}

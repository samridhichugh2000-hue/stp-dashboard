import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stpTaskOverrides } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const njId = parseInt(searchParams.get("njId") ?? "", 10);
  if (isNaN(njId)) return NextResponse.json({ error: "njId required" }, { status: 400 });

  const overrides = await db
    .select()
    .from(stpTaskOverrides)
    .where(eq(stpTaskOverrides.njId, njId))
    .all();

  return NextResponse.json(overrides);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { njId, date, task, done } = await req.json() as {
    njId: number;
    date: string;
    task: "huddle" | "qubits" | "dsr";
    done: boolean;
  };

  const by = session.user?.email ?? session.user?.name ?? "admin";
  const at = new Date().toISOString();

  // Upsert — delete existing then insert
  await db
    .delete(stpTaskOverrides)
    .where(
      and(
        eq(stpTaskOverrides.njId, njId),
        eq(stpTaskOverrides.date, date),
        eq(stpTaskOverrides.task, task)
      )
    );

  await db.insert(stpTaskOverrides).values({ njId, date, task, done, overriddenBy: by, overriddenAt: at });

  return NextResponse.json({ ok: true });
}

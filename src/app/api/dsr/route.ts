import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dsrSubmissions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const njIdParam = searchParams.get("njId");
  if (!njIdParam) return NextResponse.json({ error: "njId required" }, { status: 400 });

  const njId = parseInt(njIdParam, 10);
  const records = await db
    .select()
    .from(dsrSubmissions)
    .where(eq(dsrSubmissions.njId, njId))
    .all();

  return NextResponse.json(records);
}

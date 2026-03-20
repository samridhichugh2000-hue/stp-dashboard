import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/schema";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = await db.select().from(syncLogs).all();
  return NextResponse.json(all);
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = await db.select().from(documents).all();
  all.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, id, ...data } = body;

  if (action === "delete" && id) {
    await db.delete(documents).where(eq(documents.id, parseInt(id, 10)));
    return NextResponse.json({ ok: true });
  }

  // create
  await db.insert(documents).values({
    title: data.title,
    category: data.category,
    description: data.description,
    fileName: data.fileName,
    fileSize: data.fileSize,
    fileType: data.fileType,
    linkUrl: data.linkUrl,
    uploadedBy: data.uploadedBy ?? "Admin",
    uploadedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

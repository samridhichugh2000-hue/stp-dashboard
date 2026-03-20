import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { faqs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = await db.select().from(faqs).all();
  all.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, id, ...data } = body;

  if (action === "update" && id) {
    await db.update(faqs).set(data).where(eq(faqs.id, parseInt(id, 10)));
    return NextResponse.json({ ok: true });
  }

  if (action === "delete" && id) {
    await db.delete(faqs).where(eq(faqs.id, parseInt(id, 10)));
    return NextResponse.json({ ok: true });
  }

  // create
  await db.insert(faqs).values({
    question: data.question,
    answer: data.answer,
    category: data.category,
    order: data.order,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

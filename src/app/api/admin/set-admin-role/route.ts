/**
 * GET /api/admin/set-admin-role?email=you@example.com&secret=stp-admin-bootstrap
 * One-time bootstrap: promotes a user to admin role.
 * Protected by a hardcoded secret so it cannot be abused.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

const BOOTSTRAP_SECRET = "stp-admin-bootstrap-2026";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const email  = req.nextUrl.searchParams.get("email");

  if (secret !== BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // No email → list all users so you can find the right one
  if (!email) {
    const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).all();
    return NextResponse.json({ users: allUsers });
  }

  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  await db.update(users).set({ role: "admin" }).where(eq(users.email, email));

  return NextResponse.json({ ok: true, message: `${user.name} (${email}) is now admin. Log out and log back in.` });
}

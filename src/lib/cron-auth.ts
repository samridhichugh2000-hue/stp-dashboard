import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

export function isCronAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const bearer = req.headers.get("authorization");
  const legacy = req.headers.get("x-cron-secret");
  return bearer === `Bearer ${CRON_SECRET}` || legacy === CRON_SECRET;
}

export function cronForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function getCronSecret(): string {
  if (!CRON_SECRET) throw new Error("CRON_SECRET env var is not set");
  return CRON_SECRET;
}

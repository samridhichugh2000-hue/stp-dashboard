/**
 * POST /api/admin/trigger-sync
 * Admin-only endpoint to manually trigger any cron sync.
 * Body: { module: "csm" | "nr" | "rcb" | "huddles" | "dsr" | "milestones" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCronSecret } from "@/lib/cron-auth";

const MODULE_PATHS: Record<string, string> = {
  csm:        "/api/cron/sync-csm",
  nr:         "/api/cron/sync-nr",
  rcb:        "/api/cron/sync-rcb",
  huddles:    "/api/cron/sync-teams-huddles",
  dsr:        "/api/cron/sync-dsr",
  milestones: "/api/cron/evaluate-milestones",
  reminders:  "/api/cron/daily-reminders",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { module } = await req.json() as { module: string };
  const path = MODULE_PATHS[module];
  if (!path) {
    return NextResponse.json({ error: `Unknown module. Valid: ${Object.keys(MODULE_PATHS).join(", ")}` }, { status: 400 });
  }

  const base = req.nextUrl.origin;
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${getCronSecret()}` },
  });

  const body = await res.json();
  return NextResponse.json({ module, status: res.status, result: body });
}

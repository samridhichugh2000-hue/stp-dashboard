/**
 * POST /api/sync/auto
 *
 * Triggered on dashboard load (useEffect in DashboardShell).
 * Runs the key syncs if last sync was > 4 hours ago.
 * Uses session auth — no CRON_SECRET needed from the browser.
 * Fires syncs in the background and returns immediately so it never blocks the UI.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

// The syncs we trigger on page load (in order of importance)
const SYNC_ROUTES = [
  "/api/cron/sync-csm",
  "/api/cron/sync-nr",
  "/api/cron/sync-rcb",
  "/api/cron/sync-dsr",
];

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check last successful CSM sync
  const lastLog = await db
    .select()
    .from(syncLogs)
    .where(eq(syncLogs.module, "csm"))
    .orderBy(desc(syncLogs.lastSyncAt))
    .limit(1)
    .get();

  const lastSyncAt = lastLog?.lastSyncAt ? new Date(lastLog.lastSyncAt).getTime() : 0;
  const msSince    = Date.now() - lastSyncAt;

  if (msSince < COOLDOWN_MS) {
    return NextResponse.json({
      ok:      true,
      synced:  false,
      reason:  "recent",
      lastSync: lastLog?.lastSyncAt,
      nextSyncIn: Math.round((COOLDOWN_MS - msSince) / 60_000) + " min",
    });
  }

  // Fire all syncs in background — don't await so the response returns immediately
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://stp-dashboard-lovat.vercel.app";
  const secret  = process.env.CRON_SECRET ?? "";

  void Promise.allSettled(
    SYNC_ROUTES.map(path =>
      fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(55_000),
      }).catch(e => console.error(`[auto-sync] ${path} failed:`, e))
    )
  );

  return NextResponse.json({ ok: true, synced: true, triggered: SYNC_ROUTES });
}

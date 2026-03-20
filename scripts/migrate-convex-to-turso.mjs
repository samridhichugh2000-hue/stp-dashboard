/**
 * Migrates all data from Convex export (JSONL files) → Turso (libSQL)
 * Run: node scripts/migrate-convex-to-turso.mjs
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = join(__dirname, "../convex-export-data");

const TURSO_URL   = "libsql://stp-koenig-solutions.aws-ap-south-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzM1OTk2NjIsImlkIjoiMDE5Y2YyYzUtYjIwMS03MDY2LWI5MTEtOThmZjliZTlmY2E2IiwicmlkIjoiMGMxYzMwMWYtNzdiNy00N2Y0LTkwODUtZWEwMTFiYmQ4NjA1In0.oiBJRNuS-rdNdKd_9kHr-rRZHfjBxgYVnQU5DmhHr4vSfKp-Z_kDMrVTaN9bL2k9DywRHXzm0B9eJ7tVES1HAA";

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

function readJsonl(table) {
  try {
    const path = join(EXPORT_DIR, table, "documents.jsonl");
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

// convexId → tursoId mapping for newJoiners
const njIdMap = new Map();

async function migrateNewJoiners() {
  const rows = readJsonl("newJoiners");
  const valid = rows.filter(r =>
    r.empId &&
    !r.empId.startsWith("MOCK-") &&
    !(r.managerId?.length >= 25 && !/\s/.test(r.managerId) && /^[a-zA-Z0-9]+$/.test(r.managerId))
  );

  console.log(`newJoiners: ${rows.length} total, ${valid.length} valid`);
  let inserted = 0;

  for (const r of valid) {
    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO new_joiners
              (name, emp_id, department, location, email, designation, join_date,
               manager_id, current_phase, category, tenure_months, is_active,
               team_id, claimed_corporates, nr_from_corporates)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          r.name ?? "",
          r.empId ?? null,
          r.department ?? null,
          r.location ?? null,
          r.email ?? null,
          r.designation ?? null,
          r.joinDate ?? "",
          r.managerId ?? "",
          r.currentPhase ?? "Orientation",
          r.category ?? "Uncategorised",
          r.tenureMonths ?? 0,
          r.isActive ? 1 : 0,
          r.teamId ?? null,
          r.claimedCorporates ?? null,
          r.nrFromCorporates ?? null,
        ],
      });

      if (result.rowsAffected > 0) {
        // Get the inserted ID
        const row = await db.execute({
          sql: "SELECT id FROM new_joiners WHERE emp_id = ?",
          args: [r.empId],
        });
        if (row.rows.length > 0) {
          njIdMap.set(r._id, Number(row.rows[0].id));
          inserted++;
        }
      } else {
        // Already exists, still need the mapping
        const row = await db.execute({
          sql: "SELECT id FROM new_joiners WHERE emp_id = ?",
          args: [r.empId],
        });
        if (row.rows.length > 0) {
          njIdMap.set(r._id, Number(row.rows[0].id));
        }
      }
    } catch (e) {
      console.warn(`  NJ ${r.name}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, ID map size: ${njIdMap.size}`);
}

async function migrateNRRecords() {
  const rows = readJsonl("nrRecords");
  console.log(`nrRecords: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO nr_records (nj_id, month, year, nr_value, is_positive, source)
              VALUES (?,?,?,?,?,?)`,
        args: [njId, r.month, r.year, r.nrValue ?? 0, r.isPositive ? 1 : 0, r.source ?? "RMS"],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  NR ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped (no NJ): ${skipped}`);
}

async function migrateROIRecords() {
  const rows = readJsonl("roiRecords");
  console.log(`roiRecords: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO roi_records
              (nj_id, week_start, roi_value, color_code, from_date, to_date, leads, registrations, conversion_rate)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [njId, r.weekStart ?? "", r.roiValue ?? 0, r.colorCode ?? "Green",
               r.fromDate ?? null, r.toDate ?? null, r.leads ?? null,
               r.registrations ?? null, r.conversionRate ?? null],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  ROI ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migrateQubitScores() {
  const rows = readJsonl("qubitScores");
  console.log(`qubitScores: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO qubit_scores (nj_id, date, score, category, recordings_completed)
              VALUES (?,?,?,?,?)`,
        args: [njId, r.date ?? "", r.score ?? 0, r.category ?? "", r.recordingsCompleted ?? 0],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  Qubit ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migrateLeads() {
  const rows = readJsonl("leads");
  console.log(`leads: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO leads
              (nj_id, lead_id, allocated_date, last_action_date, status, tat_hours, tat_breached, is_self_gen)
              VALUES (?,?,?,?,?,?,?,?)`,
        args: [njId, r.leadId ?? "", r.allocatedDate ?? "", r.lastActionDate ?? "",
               r.status ?? "New", r.tatHours ?? 0, r.tatBreached ? 1 : 0, r.isSelfGen ? 1 : 0],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  Lead ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migrateRCBClaims() {
  const rows = readJsonl("rcbClaims");
  console.log(`rcbClaims: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO rcb_claims (nj_id, corporate_name, claim_date, status, revenue_linked)
              VALUES (?,?,?,?,?)`,
        args: [njId, r.corporateName ?? "", r.claimDate ?? "", r.status ?? "Pending", r.revenueLinked ?? 0],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  RCB ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migrateRCBSummary() {
  const rows = readJsonl("rcbSummary");
  console.log(`rcbSummary: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR REPLACE INTO rcb_summary (nj_id, claimed_corporates, nr_from_corporates, no_of_clients, last_sync_at)
              VALUES (?,?,?,?,?)`,
        args: [njId, r.claimedCorporates ?? 0, r.nrFromCorporates ?? 0,
               r.noOfClients ?? null, r.lastSyncAt ?? new Date().toISOString()],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  RCBSum ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migratePerformanceAlerts() {
  const rows = readJsonl("performanceAlerts");
  console.log(`performanceAlerts: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO performance_alerts (nj_id, alert_type, triggered_at, acknowledged_at, acknowledged_by)
              VALUES (?,?,?,?,?)`,
        args: [njId, r.alertType ?? "PA", r.triggeredAt ?? new Date().toISOString(),
               r.acknowledgedAt ?? null, r.acknowledgedBy ?? null],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  Alert ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migrateHuddleLogs() {
  const rows = readJsonl("huddleLogs");
  console.log(`huddleLogs: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const njId = njIdMap.get(r.njId);
    if (!njId) { skipped++; continue; }

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO huddle_logs (nj_id, date, type, conducted_by, completed, notes, teams_event_id)
              VALUES (?,?,?,?,?,?,?)`,
        args: [njId, r.date ?? "", r.type ?? "Daily", r.conductedBy ?? "",
               r.completed ? 1 : 0, r.notes ?? null, r.teamsEventId ?? null],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  Huddle ${r._id}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}, skipped: ${skipped}`);
}

async function migrateUsers() {
  const rows = readJsonl("users");
  console.log(`users: ${rows.length} rows`);
  let inserted = 0;

  for (const r of rows) {
    // Skip seeded/test users without real emails
    if (!r.email || r.email.includes("seed.stp")) continue;

    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO users (name, email, role)
              VALUES (?,?,?)`,
        args: [r.name ?? r.email, r.email, r.role ?? "viewer"],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  User ${r.email}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}`);
}

async function migrateSyncLogs() {
  const rows = readJsonl("syncLogs");
  console.log(`syncLogs: ${rows.length} rows`);
  let inserted = 0;

  for (const r of rows) {
    try {
      const result = await db.execute({
        sql: `INSERT OR REPLACE INTO sync_logs (module, last_sync_at, status, error_message, records_processed)
              VALUES (?,?,?,?,?)`,
        args: [r.module ?? "", r.lastSyncAt ?? new Date().toISOString(),
               r.status ?? "success", r.errorMessage ?? null, r.recordsProcessed ?? null],
      });
      if (result.rowsAffected > 0) inserted++;
    } catch (e) {
      console.warn(`  SyncLog ${r.module}: ${e.message}`);
    }
  }
  console.log(`  ✓ Inserted: ${inserted}`);
}

async function main() {
  console.log("=== Convex → Turso Migration ===\n");

  // Order matters: newJoiners must go first (other tables reference its ID)
  await migrateNewJoiners();
  await migrateNRRecords();
  await migrateROIRecords();
  await migrateQubitScores();
  await migrateLeads();
  await migrateRCBClaims();
  await migrateRCBSummary();
  await migratePerformanceAlerts();
  await migrateHuddleLogs();
  await migrateUsers();
  await migrateSyncLogs();

  // Verify counts
  console.log("\n=== Final counts in Turso ===");
  for (const table of ["new_joiners","nr_records","roi_records","qubit_scores","leads","rcb_claims","rcb_summary","performance_alerts","huddle_logs","users","sync_logs"]) {
    const r = await db.execute(`SELECT COUNT(*) as n FROM ${table}`);
    console.log(`  ${table}: ${r.rows[0].n}`);
  }

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

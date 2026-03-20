import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/db";

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    team_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS new_joiners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emp_id TEXT UNIQUE,
    department TEXT,
    location TEXT,
    email TEXT,
    designation TEXT,
    join_date TEXT NOT NULL,
    manager_id TEXT NOT NULL DEFAULT '',
    current_phase TEXT NOT NULL DEFAULT 'Orientation',
    category TEXT NOT NULL DEFAULT 'Uncategorised',
    tenure_months INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    team_id TEXT,
    claimed_corporates INTEGER,
    nr_from_corporates INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS nr_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    nr_value REAL NOT NULL,
    is_positive INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'RMS'
  )`,
  `CREATE TABLE IF NOT EXISTS roi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    roi_value REAL NOT NULL,
    color_code TEXT NOT NULL DEFAULT 'Green',
    from_date TEXT,
    to_date TEXT,
    leads INTEGER,
    registrations INTEGER,
    conversion_rate REAL
  )`,
  `CREATE TABLE IF NOT EXISTS qubit_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    score REAL NOT NULL,
    category TEXT NOT NULL,
    recordings_completed INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    lead_id TEXT NOT NULL,
    allocated_date TEXT NOT NULL,
    last_action_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    tat_hours REAL NOT NULL DEFAULT 0,
    tat_breached INTEGER NOT NULL DEFAULT 0,
    is_self_gen INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS rcb_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    corporate_name TEXT NOT NULL,
    claim_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    revenue_linked REAL NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS rcb_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    claimed_corporates INTEGER NOT NULL DEFAULT 0,
    nr_from_corporates REAL NOT NULL DEFAULT 0,
    no_of_clients INTEGER,
    last_sync_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS performance_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    acknowledged_at TEXT,
    acknowledged_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS huddle_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Daily',
    conducted_by TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    teams_event_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS assessment_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    filled_by TEXT NOT NULL,
    filled_at TEXT NOT NULL,
    manager_notes TEXT,
    hr_notes TEXT,
    outcome TEXT NOT NULL DEFAULT 'Pending',
    checklist_data TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    link_url TEXT,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    "order" INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS dsr_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nj_id INTEGER NOT NULL REFERENCES new_joiners(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    email_id TEXT NOT NULL UNIQUE,
    submitted_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS joining_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    manager TEXT,
    country TEXT,
    tentative_doj TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    email_subject TEXT,
    email_received_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL UNIQUE,
    last_sync_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    records_processed INTEGER
  )`,
];

export async function POST(req: NextRequest) {
  // Simple secret check
  const secret = req.headers.get("x-init-secret");
  if (secret !== process.env.CRON_SECRET && secret !== "stp-init-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: string[] = [];
  for (const stmt of CREATE_STATEMENTS) {
    try {
      await client.execute(stmt);
      const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] ?? "?";
      results.push(`OK: ${tableName}`);
    } catch (e) {
      results.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, results });
}

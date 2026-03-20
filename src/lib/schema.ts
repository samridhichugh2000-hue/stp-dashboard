import {
  sqliteTable,
  integer,
  text,
  real,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── users ─────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role:         text("role").notNull().default("viewer"), // admin|manager|viewer|nj
  teamId:       text("team_id"),
  createdAt:    text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ── newJoiners ─────────────────────────────────────────────────────────────────

export const newJoiners = sqliteTable("new_joiners", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  name:           text("name").notNull(),
  empId:          text("emp_id").unique(),
  department:     text("department"),
  location:       text("location"),
  email:          text("email"),
  designation:    text("designation"),
  joinDate:       text("join_date").notNull(),   // ISO date YYYY-MM-DD
  managerId:      text("manager_id").notNull().default(""),
  currentPhase:   text("current_phase").notNull().default("Orientation"),
  // Orientation | Training | Field | Graduated
  category:       text("category").notNull().default("Uncategorised"),
  // Developed | Performer | Performance Falling | Non-Performer | Uncategorised
  tenureMonths:   integer("tenure_months").notNull().default(0),
  isActive:       integer("is_active", { mode: "boolean" }).notNull().default(true),
  teamId:         text("team_id"),
  claimedCorporates: integer("claimed_corporates"),
  nrFromCorporates:  integer("nr_from_corporates"),
  stpExtendedDays: integer("stp_extended_days").notNull().default(0),
  // Number of completed huddle days beyond the standard 14-day STP window
});

// ── nrRecords ──────────────────────────────────────────────────────────────────

export const nrRecords = sqliteTable("nr_records", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  njId:       integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  month:      integer("month").notNull(),    // 1-12
  year:       integer("year").notNull(),
  nrValue:    real("nr_value").notNull(),
  isPositive: integer("is_positive", { mode: "boolean" }).notNull(),
  source:     text("source").notNull().default("RMS"), // RMS | Manual
});

// ── roiRecords ─────────────────────────────────────────────────────────────────

export const roiRecords = sqliteTable("roi_records", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  njId:           integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  weekStart:      text("week_start").notNull(),  // ISO date
  roiValue:       real("roi_value").notNull(),
  colorCode:      text("color_code").notNull().default("Green"), // Green|Black|Red|Yellow
  fromDate:       text("from_date"),
  toDate:         text("to_date"),
  leads:          integer("leads"),
  registrations:  integer("registrations"),
  conversionRate: real("conversion_rate"),
});

// ── qubitScores ────────────────────────────────────────────────────────────────

export const qubitScores = sqliteTable("qubit_scores", {
  id:                   integer("id").primaryKey({ autoIncrement: true }),
  njId:                 integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  date:                 text("date").notNull(),  // ISO date
  score:                real("score").notNull(),
  category:             text("category").notNull(),
  recordingsCompleted:  integer("recordings_completed").notNull().default(0),
});

// ── leads ──────────────────────────────────────────────────────────────────────

export const leads = sqliteTable("leads", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  njId:           integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  leadId:         text("lead_id").notNull(),
  allocatedDate:  text("allocated_date").notNull(),
  lastActionDate: text("last_action_date").notNull(),
  status:         text("status").notNull().default("New"),
  // New | Contacted | Qualified | Proposal | Won | Lost | Stale
  tatHours:       real("tat_hours").notNull().default(0),
  tatBreached:    integer("tat_breached", { mode: "boolean" }).notNull().default(false),
  isSelfGen:      integer("is_self_gen", { mode: "boolean" }).notNull().default(false),
});

// ── rcbClaims ──────────────────────────────────────────────────────────────────

export const rcbClaims = sqliteTable("rcb_claims", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  njId:           integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  corporateName:  text("corporate_name").notNull(),
  claimDate:      text("claim_date").notNull(),
  status:         text("status").notNull().default("Pending"),
  // Pending | Approved | Rejected | Under Review
  revenueLinked:  real("revenue_linked").notNull().default(0),
});

// ── rcbSummary ─────────────────────────────────────────────────────────────────

export const rcbSummary = sqliteTable("rcb_summary", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  njId:              integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  claimedCorporates: integer("claimed_corporates").notNull().default(0),
  nrFromCorporates:  real("nr_from_corporates").notNull().default(0),
  noOfClients:       integer("no_of_clients"),
  lastSyncAt:        text("last_sync_at").notNull(),
});

// ── performanceAlerts ─────────────────────────────────────────────────────────

export const performanceAlerts = sqliteTable("performance_alerts", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  njId:           integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  alertType:      text("alert_type").notNull(), // PA | PIP | EXIT
  triggeredAt:    text("triggered_at").notNull(),
  acknowledgedAt: text("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"),
});

// ── huddleLogs ─────────────────────────────────────────────────────────────────

export const huddleLogs = sqliteTable("huddle_logs", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  njId:         integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  date:         text("date").notNull(),  // ISO date
  type:         text("type").notNull().default("Daily"), // Daily|Weekly|Monthly|Ad-hoc
  conductedBy:  text("conducted_by").notNull(),
  completed:    integer("completed", { mode: "boolean" }).notNull().default(false),
  notes:        text("notes"),
  teamsEventId: text("teams_event_id"),
  isExtended:   integer("is_extended", { mode: "boolean" }).notNull().default(false),
  // true = beyond standard 14-day STP window (days 15-18)
});

// ── assessmentChecklists ───────────────────────────────────────────────────────

export const assessmentChecklists = sqliteTable("assessment_checklists", {
  id:            integer("id").primaryKey({ autoIncrement: true }),
  njId:          integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  filledBy:      text("filled_by").notNull(),
  filledAt:      text("filled_at").notNull(),
  managerNotes:  text("manager_notes"),
  hrNotes:       text("hr_notes"),
  outcome:       text("outcome").notNull().default("Pending"), // Pass|Fail|Pending|Deferred
  checklistData: text("checklist_data"), // JSON string
});

// ── documents ─────────────────────────────────────────────────────────────────

export const documents = sqliteTable("documents", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  title:       text("title").notNull(),
  category:    text("category").notNull(),
  description: text("description"),
  fileName:    text("file_name"),
  fileSize:    integer("file_size"),
  fileType:    text("file_type"),
  linkUrl:     text("link_url"),
  uploadedBy:  text("uploaded_by").notNull(),
  uploadedAt:  text("uploaded_at").notNull(),
});

// ── faqs ──────────────────────────────────────────────────────────────────────

export const faqs = sqliteTable("faqs", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  question:  text("question").notNull(),
  answer:    text("answer").notNull(),
  category:  text("category"),
  order:     integer("order"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ── dsrSubmissions ────────────────────────────────────────────────────────────

export const dsrSubmissions = sqliteTable("dsr_submissions", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  njId:        integer("nj_id").notNull().references(() => newJoiners.id, { onDelete: "cascade" }),
  date:        text("date").notNull(),          // YYYY-MM-DD — the day of submission
  emailId:     text("email_id").notNull().unique(), // MS Graph message id
  submittedAt: text("submitted_at").notNull(),  // ISO datetime
});

// ── joiningLeads ──────────────────────────────────────────────────────────────

export const joiningLeads = sqliteTable("joining_leads", {
  id:               integer("id").primaryKey({ autoIncrement: true }),
  emailId:          text("email_id").notNull().unique(),  // MS Graph message id
  name:             text("name").notNull(),
  manager:          text("manager"),
  country:          text("country"),
  tentativeDoj:     text("tentative_doj"),   // free-text date as written in email
  status:           text("status").notNull().default("pending"), // pending | joined | backed_out
  emailSubject:     text("email_subject"),
  emailReceivedAt:  text("email_received_at"),
  updatedAt:        text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── syncLogs ──────────────────────────────────────────────────────────────────

export const syncLogs = sqliteTable("sync_logs", {
  id:               integer("id").primaryKey({ autoIncrement: true }),
  module:           text("module").notNull().unique(),
  lastSyncAt:       text("last_sync_at").notNull(),
  status:           text("status").notNull(), // success | error | running
  errorMessage:     text("error_message"),
  recordsProcessed: integer("records_processed"),
});

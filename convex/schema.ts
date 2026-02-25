import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // New Joiners master table
  newJoiners: defineTable({
    name: v.string(),
    empId: v.optional(v.string()),              // Google Sheets employee ID
    department: v.optional(v.string()),         // e.g. "Sales"
    location: v.optional(v.string()),           // Base location
    email: v.optional(v.string()),              // Work email
    claimedCorporates: v.optional(v.number()), // Count from "Claimed" column
    nrFromCorporates: v.optional(v.number()),  // Value from "NR from Corporates" column
    joinDate: v.string(), // ISO date string
    managerId: v.string(),
    currentPhase: v.union(
      v.literal("Orientation"),
      v.literal("Training"),
      v.literal("Field"),
      v.literal("Graduated")
    ),
    category: v.union(
      v.literal("Developed"),
      v.literal("Performer"),
      v.literal("Performance Falling"),
      v.literal("Non-Performer"),
      v.literal("Uncategorised")
    ),
    tenureMonths: v.number(),
    isActive: v.boolean(),
    teamId: v.optional(v.string()),
  })
    .index("by_manager", ["managerId"])
    .index("by_active", ["isActive"])
    .index("by_emp_id", ["empId"]),

  // Qubit (call quality) scores from RMS
  qubitScores: defineTable({
    njId: v.id("newJoiners"),
    date: v.string(), // ISO date
    score: v.number(), // 0-100
    category: v.string(),
    recordingsCompleted: v.number(),
  })
    .index("by_nj", ["njId"])
    .index("by_nj_date", ["njId", "date"]),

  // Lead allocation and tracking
  leads: defineTable({
    njId: v.id("newJoiners"),
    leadId: v.string(), // RMS lead ID
    allocatedDate: v.string(),
    lastActionDate: v.string(),
    status: v.union(
      v.literal("New"),
      v.literal("Contacted"),
      v.literal("Qualified"),
      v.literal("Proposal"),
      v.literal("Won"),
      v.literal("Lost"),
      v.literal("Stale")
    ),
    tatHours: v.number(),
    tatBreached: v.boolean(),
    isSelfGen: v.boolean(),
  })
    .index("by_nj", ["njId"])
    .index("by_tat_breached", ["tatBreached"])
    .index("by_lead_id", ["leadId"]),

  // NR (Net Revenue) monthly records
  nrRecords: defineTable({
    njId: v.id("newJoiners"),
    month: v.number(), // 1-12
    year: v.number(),
    nrValue: v.number(), // in rupees
    isPositive: v.boolean(),
    source: v.union(v.literal("RMS"), v.literal("Manual")),
  })
    .index("by_nj", ["njId"])
    .index("by_nj_month_year", ["njId", "year", "month"]),

  // ROI weekly records
  roiRecords: defineTable({
    njId: v.id("newJoiners"),
    weekStart: v.string(), // ISO date of Monday
    roiValue: v.number(),
    colorCode: v.union(
      v.literal("Green"),
      v.literal("Black"),
      v.literal("Red"),
      v.literal("Yellow")
    ),
  })
    .index("by_nj", ["njId"])
    .index("by_nj_week", ["njId", "weekStart"]),

  // RCB (Recruited Corporate Business) claims
  rcbClaims: defineTable({
    njId: v.id("newJoiners"),
    corporateName: v.string(),
    claimDate: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Rejected"),
      v.literal("Under Review")
    ),
    revenueLinked: v.number(),
  }).index("by_nj", ["njId"]),

  // Performance alerts (PA, PIP, EXIT)
  performanceAlerts: defineTable({
    njId: v.id("newJoiners"),
    alertType: v.union(v.literal("PA"), v.literal("PIP"), v.literal("EXIT")),
    triggeredAt: v.string(),
    acknowledgedAt: v.optional(v.string()),
    acknowledgedBy: v.optional(v.string()),
  })
    .index("by_nj", ["njId"])
    .index("by_type", ["alertType"]),

  // Huddle session logs
  huddleLogs: defineTable({
    njId: v.id("newJoiners"),
    date: v.string(),
    type: v.union(
      v.literal("Daily"),
      v.literal("Weekly"),
      v.literal("Monthly"),
      v.literal("Ad-hoc")
    ),
    conductedBy: v.string(),
    completed: v.boolean(),
    notes: v.optional(v.string()),
  }).index("by_nj", ["njId"]),

  // Assessment & checklist submissions
  assessmentChecklists: defineTable({
    njId: v.id("newJoiners"),
    filledBy: v.string(),
    filledAt: v.string(),
    managerNotes: v.optional(v.string()),
    hrNotes: v.optional(v.string()),
    outcome: v.union(
      v.literal("Pass"),
      v.literal("Fail"),
      v.literal("Pending"),
      v.literal("Deferred")
    ),
    checklistData: v.optional(v.any()),
  }).index("by_nj", ["njId"]),

  // Users / roles
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("manager"),
      v.literal("viewer"),
      v.literal("nj")
    ),
    teamId: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_token", ["tokenIdentifier"]),

  // Sync logs for RMS adapter health
  syncLogs: defineTable({
    module: v.string(),
    lastSyncAt: v.string(),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("running")),
    errorMessage: v.optional(v.string()),
    recordsProcessed: v.optional(v.number()),
  }).index("by_module", ["module"]),

  // Convex Auth tables
  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
  })
    .index("by_provider_account", ["provider", "providerAccountId"])
    .index("by_user", ["userId"]),

  authSessions: defineTable({
    userId: v.id("users"),
    expirationTime: v.number(),
  }).index("by_user", ["userId"]),

  authVerificationCodes: defineTable({
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    code: v.string(),
    expirationTime: v.number(),
    verifiedTime: v.optional(v.number()),
    provider: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"]),

  authRefreshTokens: defineTable({
    sessionId: v.id("authSessions"),
    expirationTime: v.number(),
  }).index("by_session", ["sessionId"]),

  authRateLimits: defineTable({
    identifier: v.string(),
    lastAttemptTime: v.number(),
    attemptsCount: v.number(),
  }).index("by_identifier", ["identifier"]),
});

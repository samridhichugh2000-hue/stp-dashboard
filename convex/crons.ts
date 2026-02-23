import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync Qubits every 15 minutes
crons.interval("syncQubits", { minutes: 15 }, internal.actions.syncQubits.syncQubits);

// Sync Leads every 30 minutes
crons.interval("syncLeads", { minutes: 30 }, internal.actions.syncLeads.syncLeads);

// Sync NR daily at 01:00 IST (UTC+5:30 → 19:30 UTC previous day)
crons.daily("syncNR", { hourUTC: 19, minuteUTC: 30 }, internal.actions.syncNR.syncNR);

// Sync ROI every Monday at 06:00 IST (00:30 UTC Monday)
crons.weekly(
  "syncROI",
  { dayOfWeek: "monday", hourUTC: 0, minuteUTC: 30 },
  internal.actions.syncROI.syncROI
);

// Sync RCB every 60 minutes
crons.interval("syncRCB", { minutes: 60 }, internal.actions.syncRCB.syncRCB);

// Evaluate milestones daily at 02:00 IST (20:30 UTC previous day)
crons.daily(
  "evaluateMilestones",
  { hourUTC: 20, minuteUTC: 30 },
  internal.actions.evaluateMilestones.evaluateMilestones
);

export default crons;

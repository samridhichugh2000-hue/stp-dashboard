import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync Qubits every 15 minutes
crons.interval("syncQubits", { minutes: 15 }, internal.actions.syncQubits.syncQubits);

// Sync Leads every 30 minutes
crons.interval("syncLeads", { minutes: 30 }, internal.actions.syncLeads.syncLeads);

// Sync NR from live API daily at 01:00 IST (UTC+5:30 → 19:30 UTC previous day)
crons.daily("syncNR", { hourUTC: 19, minuteUTC: 30 }, internal.actions.syncNRFromAPI.syncNRFromAPI);

// Evaluate milestones daily at 02:00 IST (20:30 UTC previous day)
crons.daily(
  "evaluateMilestones",
  { hourUTC: 20, minuteUTC: 30 },
  internal.actions.evaluateMilestones.evaluateMilestones
);

// Sync CSMs from live API daily at 05:30 IST (midnight UTC)
crons.daily("syncCSM", { hourUTC: 0, minuteUTC: 0 }, internal.actions.syncCSMFromAPI.syncCSMFromAPI);

// Sync Teams huddle attendance daily at 09:30 IST (04:00 UTC)
crons.daily(
  "syncTeamsHuddles",
  { hourUTC: 4, minuteUTC: 0 },
  internal.actions.syncTeamsHuddles.syncTeamsHuddles
);

// Sync RCB from live API daily at 02:00 IST (20:30 UTC previous day)
crons.daily(
  "syncRCB",
  { hourUTC: 20, minuteUTC: 30 },
  internal.actions.syncRCBFromAPI.syncRCBFromAPI
);

export default crons;

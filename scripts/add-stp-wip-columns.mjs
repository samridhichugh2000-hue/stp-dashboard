import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const cols = [
  "ALTER TABLE new_joiners ADD COLUMN stp_wip_marked INTEGER DEFAULT 0",
  "ALTER TABLE new_joiners ADD COLUMN stp_wip_note TEXT",
  "ALTER TABLE new_joiners ADD COLUMN stp_wip_marked_at TEXT",
  "ALTER TABLE new_joiners ADD COLUMN stp_wip_marked_by TEXT",
];

for (const sql of cols) {
  try {
    await client.execute(sql);
    console.log("✓", sql.split("ADD COLUMN")[1].trim());
  } catch (e) {
    // Column already exists — safe to ignore
    if (e.message?.includes("duplicate column")) {
      console.log("⚠ already exists:", sql.split("ADD COLUMN")[1].trim());
    } else {
      throw e;
    }
  }
}

console.log("\nDone — 4 columns added to new_joiners.");
client.close();

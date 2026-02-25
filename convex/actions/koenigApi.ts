"use node";
/**
 * Calls the Koenig Solutions API to fetch ROI/Leads data.
 * Step 1: GetToken  →  Step 2: GetROIData
 */
import { action } from "../_generated/server";
import { v } from "convex/values";

const BASE = "https://api.koenig-solutions.com/";

async function getToken(): Promise<{ accessToken: string; deviceToken: string }> {
  const res = await fetch(`${BASE}api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: "Samridhi",
      userPassword: "Samridhi@2025",
      userRole: "PMS",
    }),
  });
  if (!res.ok) throw new Error(`GetToken HTTP ${res.status}`);
  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`Auth failed: ${data.message}`);
  return {
    accessToken: data.content.accessToken,
    deviceToken: data.content.deviceToken,
  };
}

export const getROIData = action({
  args: {
    from_date: v.string(),              // "DD-Mon-YYYY"
    to_date: v.string(),                // "DD-Mon-YYYY"
    display_column: v.optional(v.string()), // default "CCE"
  },
  handler: async (_ctx, args) => {
    const { accessToken, deviceToken } = await getToken();

    const res = await fetch(`${BASE}api/Kites/Operator/GetROIData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: { accessToken, deviceToken },
        from_date: args.from_date,
        to_date: args.to_date,
        display_column: args.display_column ?? "CCE",
      }),
    });
    if (!res.ok) throw new Error(`GetROIData HTTP ${res.status}`);
    const json = await res.json();
    return json;
  },
});

/**
 * RMS client factory.
 * Reads CONVEX_RMS_MODE env var:
 *   "sheets" → GoogleSheetsRMSClient (requires GOOGLE_SHEET_ID)
 *   "live"   → LiveRMSClient (requires RMS_API_BASE_URL + RMS_BEARER_TOKEN)
 *   default  → MockRMSClient
 */

import type { RMSClient } from "./adapter";
import { MockRMSClient } from "./mockClient";
import { LiveRMSClient } from "./liveClient";
import { GoogleSheetsRMSClient } from "./googleSheetsClient";

export type { RMSClient };

export function getClient(): RMSClient {
  const mode = process.env.CONVEX_RMS_MODE;

  if (mode === "sheets") {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error(
        "sheets mode requires GOOGLE_SHEET_ID environment variable"
      );
    }
    return new GoogleSheetsRMSClient(sheetId);
  }

  if (mode === "live") {
    const baseUrl = process.env.RMS_API_BASE_URL;
    const token = process.env.RMS_BEARER_TOKEN;
    if (!baseUrl || !token) {
      throw new Error(
        "RMS live mode requires RMS_API_BASE_URL and RMS_BEARER_TOKEN environment variables"
      );
    }
    return new LiveRMSClient(baseUrl, token);
  }

  return new MockRMSClient();
}

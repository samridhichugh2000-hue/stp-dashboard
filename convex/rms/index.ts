/**
 * RMS client factory.
 * Reads CONVEX_RMS_MODE env var:
 *   "live"  → LiveRMSClient (requires RMS_API_BASE_URL + RMS_BEARER_TOKEN)
 *   default → MockRMSClient
 */

import type { RMSClient } from "./adapter";
import { MockRMSClient } from "./mockClient";
import { LiveRMSClient } from "./liveClient";

export type { RMSClient };

export function getClient(): RMSClient {
  const mode = process.env.CONVEX_RMS_MODE;

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

/**
 * Live RMS Client — wire in at M0 when RMS API credentials are available.
 * Set CONVEX_RMS_API_BASE_URL and CONVEX_RMS_BEARER_TOKEN in Convex environment.
 */

import type { RMSClient, NJRecord, QubitRecord, LeadRecord, NRRecord, ROIRecord, RCBRecord } from "./adapter";

export class LiveRMSClient implements RMSClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`RMS API error: ${res.status} ${res.statusText} at ${path}`);
    }
    return res.json() as Promise<T>;
  }

  async fetchNewJoiners(): Promise<NJRecord[]> {
    // TODO: adjust endpoint path when RMS API docs are available
    return this.get<NJRecord[]>("/api/v1/new-joiners");
  }

  async fetchQubits(): Promise<QubitRecord[]> {
    // TODO: adjust endpoint path when RMS API docs are available
    return this.get<QubitRecord[]>("/api/v1/qubits");
  }

  async fetchLeads(): Promise<LeadRecord[]> {
    return this.get<LeadRecord[]>("/api/v1/leads");
  }

  async fetchNR(): Promise<NRRecord[]> {
    return this.get<NRRecord[]>("/api/v1/nr-records");
  }

  async fetchROI(): Promise<ROIRecord[]> {
    return this.get<ROIRecord[]>("/api/v1/roi-records");
  }

  async fetchRCB(): Promise<RCBRecord[]> {
    return this.get<RCBRecord[]>("/api/v1/rcb-claims");
  }
}

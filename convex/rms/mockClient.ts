/**
 * Mock RMS Client
 * Generates 60 days of realistic data for 5 New Joiners.
 * Replace with liveClient.ts at M0 when RMS API credentials are available.
 */

import type { RMSClient, NJRecord, QubitRecord, LeadRecord, NRRecord, ROIRecord, RCBRecord } from "./adapter";

// Use NJ names as IDs — mutations match by name for type safety
export const MOCK_NJ_IDS = [
  "Priya Sharma",
  "Rahul Mehta",
  "Ananya Iyer",
  "Karan Verma",
  "Sneha Patel",
];

const NJ_NAMES = [
  "Priya Sharma",
  "Rahul Mehta",
  "Ananya Iyer",
  "Karan Verma",
  "Sneha Patel",
];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function seededRandom(seed: number): number {
  // Simple deterministic pseudo-random (LCG)
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  return ((a * seed + c) % m) / m;
}

function seededBetween(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

// Base date: 60 days ago from a fixed reference
const BASE_DATE = new Date("2025-12-22"); // ~60 days before Feb 20 2026
const TODAY = new Date("2026-02-20");

export class MockRMSClient implements RMSClient {
  async fetchQubits(): Promise<QubitRecord[]> {
    const records: QubitRecord[] = [];
    const categories = ["Objection Handling", "Product Knowledge", "Communication", "Compliance"];

    MOCK_NJ_IDS.forEach((njId, njIdx) => {
      // Generate one qubit score per day for 60 days
      for (let day = 0; day < 60; day++) {
        const date = addDays(BASE_DATE, day);
        if (date > TODAY) break;

        const seed = njIdx * 1000 + day;
        // Simulate improvement trend over time
        const baseScore = 45 + njIdx * 5 + Math.floor(day / 10) * 3;
        const variance = seededBetween(seed, -10, 10);
        const score = Math.min(100, Math.max(10, baseScore + variance));

        records.push({
          njId,
          date: isoDate(date),
          score,
          category: categories[seededBetween(seed * 3, 0, 3)],
          recordingsCompleted: seededBetween(seed * 7, 1, 5),
        });
      }
    });

    return records;
  }

  async fetchLeads(): Promise<LeadRecord[]> {
    const records: LeadRecord[] = [];
    const statuses: LeadRecord["status"][] = [
      "New", "Contacted", "Qualified", "Proposal", "Won", "Lost", "Stale",
    ];

    MOCK_NJ_IDS.forEach((njId, njIdx) => {
      // 8-15 leads per NJ
      const leadCount = 8 + njIdx * 2;
      for (let i = 0; i < leadCount; i++) {
        const seed = njIdx * 100 + i;
        const daysAgo = seededBetween(seed, 1, 55);
        const allocatedDate = isoDate(addDays(TODAY, -daysAgo));
        const actionDaysAgo = seededBetween(seed * 2, 0, daysAgo);
        const lastActionDate = isoDate(addDays(TODAY, -actionDaysAgo));
        const tatHours = seededBetween(seed * 3, 2, 96);
        const statusIdx = seededBetween(seed * 4, 0, 6);

        records.push({
          njId,
          leadId: `LEAD-${njId.slice(-3)}-${String(i + 1).padStart(3, "0")}`,
          allocatedDate,
          lastActionDate,
          status: statuses[statusIdx],
          tatHours,
          tatBreached: tatHours > 48,
          isSelfGen: seededRandom(seed * 5) > 0.7,
        });
      }
    });

    return records;
  }

  async fetchNR(): Promise<NRRecord[]> {
    const records: NRRecord[] = [];

    MOCK_NJ_IDS.forEach((njId, njIdx) => {
      // Generate NR for last 6 months
      for (let m = 5; m >= 0; m--) {
        const refDate = new Date(TODAY);
        refDate.setMonth(refDate.getMonth() - m);
        const month = refDate.getMonth() + 1;
        const year = refDate.getFullYear();
        const seed = njIdx * 200 + m * 10;

        // Vary performance by NJ: NJ 0-1 mostly positive, NJ 2-3 mixed, NJ 4 mostly negative
        const positiveChance = [0.8, 0.7, 0.5, 0.35, 0.2][njIdx];
        const isPositive = seededRandom(seed) < positiveChance;
        const baseNR = isPositive
          ? seededBetween(seed + 1, 50000, 250000)
          : seededBetween(seed + 1, -80000, -10000);

        records.push({
          njId,
          month,
          year,
          nrValue: baseNR,
          isPositive,
          source: "RMS",
        });
      }
    });

    return records;
  }

  async fetchROI(): Promise<ROIRecord[]> {
    const records: ROIRecord[] = [];
    const colorMap = (roi: number): ROIRecord["colorCode"] => {
      if (roi >= 80) return "Green";
      if (roi >= 50) return "Black";
      if (roi >= 20) return "Yellow";
      return "Red";
    };

    MOCK_NJ_IDS.forEach((njId, njIdx) => {
      // 8 weeks of ROI data
      for (let w = 7; w >= 0; w--) {
        const weekStart = new Date(TODAY);
        // Roll back to previous Monday
        const day = weekStart.getDay();
        const daysToMonday = day === 0 ? 6 : day - 1;
        weekStart.setDate(weekStart.getDate() - daysToMonday - w * 7);

        const seed = njIdx * 300 + w;
        const baseROI = [70, 60, 45, 35, 20][njIdx] + seededBetween(seed, -15, 15);
        const roiValue = Math.min(100, Math.max(0, baseROI));

        records.push({
          njId,
          weekStart: isoDate(weekStart),
          roiValue,
          colorCode: colorMap(roiValue),
        });
      }
    });

    return records;
  }

  async fetchRCB(): Promise<RCBRecord[]> {
    const records: RCBRecord[] = [];
    const companies = [
      "TechCorp India", "GlobalSoft", "Infra Holdings", "MediCare Group",
      "RetailMax", "EduFirst", "FinServ Ltd", "ManufacturePro",
    ];
    const statuses: RCBRecord["status"][] = ["Pending", "Approved", "Rejected", "Under Review"];

    MOCK_NJ_IDS.forEach((njId, njIdx) => {
      // 2-4 RCB claims per NJ
      const claimCount = 2 + (njIdx % 3);
      for (let i = 0; i < claimCount; i++) {
        const seed = njIdx * 400 + i;
        const daysAgo = seededBetween(seed, 5, 50);
        records.push({
          njId,
          corporateName: companies[seededBetween(seed * 2, 0, 7)],
          claimDate: isoDate(addDays(TODAY, -daysAgo)),
          status: statuses[seededBetween(seed * 3, 0, 3)],
          revenueLinked: seededBetween(seed * 4, 10000, 500000),
        });
      }
    });

    return records;
  }

  async fetchNewJoiners(): Promise<NJRecord[]> {
    const joinDates = ["2025-08-01", "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01"];
    const statuses = ["Green", "Yellow", "Yellow", "Red", "Red"];
    return NJ_NAMES.map((name, i) => ({
      empId: `MOCK-${1000 + i}`,
      name,
      department: "Sales",
      managerName: "Demo Manager",
      location: "Mumbai",
      email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
      joinDate: joinDates[i],
      status: statuses[i],
    }));
  }
}

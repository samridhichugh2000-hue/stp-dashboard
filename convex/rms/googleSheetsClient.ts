/**
 * Google Sheets RMS Client
 * Fetches data from a publicly shared Google Sheet (CSV export).
 * Implements the full RMSClient interface; qubits and leads return []
 * since that data is not present in the sheet.
 */

import type {
  RMSClient,
  NJRecord,
  QubitRecord,
  LeadRecord,
  NRRecord,
  ROIRecord,
  RCBRecord,
} from "./adapter";

// Month abbreviation → number (handles "Sept" and "Sep")
const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse "Mar-2026" or "Feb 2026" or "Sept 2025" into { month, year } */
function parseMonthHeader(header: string): { month: number; year: number } | null {
  const match = header.trim().match(/^(\w+)[\s\-](\d{4})$/);
  if (!match) return null;
  const month = MONTH_MAP[match[1].toLowerCase()];
  const year = parseInt(match[2]);
  if (!month || isNaN(year)) return null;
  return { month, year };
}

/** Parse NR values like "437,096", "-19,575", "0". Returns null for "—" / empty. */
function parseNRValue(raw: string): number | null {
  const s = raw.trim().replace(/["""]/g, "");
  if (!s || s === "—" || s === "–" || s === "-" || s === "NA") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

/** Parse "26-Aug-25" → "2025-08-26" */
function parseDOJ(doj: string): string {
  const match = doj.trim().match(/^(\d{1,2})-(\w+)-(\d{2})$/);
  if (!match) return new Date().toISOString().split("T")[0];
  const day = parseInt(match[1]);
  const month = MONTH_MAP[match[2].toLowerCase()] ?? 1;
  const year = 2000 + parseInt(match[3]);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Compute tenure in full months from ISO joinDate to today */
function tenureMonths(joinDateISO: string): number {
  const join = new Date(joinDateISO);
  const today = new Date();
  return Math.max(
    0,
    (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
  );
}

/** Derive phase from tenure */
function derivePhase(months: number): "Orientation" | "Training" | "Field" | "Graduated" {
  if (months < 1) return "Orientation";
  if (months < 3) return "Training";
  if (months < 6) return "Field";
  return "Graduated";
}

/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday on or before `date`.
 * Used to snap any date to its week start.
 */
function toWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/**
 * Returns all distinct Monday ISO strings whose week overlaps with the given month.
 * A week is included if its Monday falls within the month, or the month's first day
 * falls within that week.
 */
function weeksInMonth(year: number, month: number): string[] {
  const weeks = new Set<string>();
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // last day of month

  // Start from the Monday of the first week that touches this month
  const cur = new Date(firstDay);
  const dow = cur.getDay();
  cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1)); // rewind to Monday

  while (cur <= lastDay) {
    // Include this week if it overlaps with the month
    const weekEnd = new Date(cur);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd >= firstDay) {
      weeks.add(cur.toISOString().split("T")[0]);
    }
    cur.setDate(cur.getDate() + 7);
  }
  return Array.from(weeks);
}

/** Minimal CSV parser that handles quoted fields containing commas */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const cols: string[] = [];
    let cell = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cols.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cols.push(cell.trim());
    rows.push(cols);
  }
  return rows;
}

export class GoogleSheetsRMSClient implements RMSClient {
  private sheetId: string;

  constructor(sheetId: string) {
    this.sheetId = sheetId;
  }

  private async fetchRows(): Promise<{ headers: string[]; dataRows: string[][] }> {
    const url = `https://docs.google.com/spreadsheets/d/${this.sheetId}/export?format=csv`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`Google Sheets fetch failed: ${res.status} ${res.statusText}`);
    const text = await res.text();
    const all = parseCSV(text);
    if (all.length < 2) return { headers: [], dataRows: [] };

    // The sheet may have a section-header row above the actual field-name row.
    // Find the first row that contains "Emp ID" or "Name" in its first 3 columns.
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, all.length); i++) {
      const cols = all[i].slice(0, 4).map((c) => c.trim().toLowerCase());
      if (cols.includes("emp id") || cols.includes("name")) {
        headerIdx = i;
        break;
      }
    }

    return { headers: all[headerIdx], dataRows: all.slice(headerIdx + 1) };
  }

  async fetchNewJoiners(): Promise<NJRecord[]> {
    const { headers, dataRows } = await this.fetchRows();

    // Locate special columns by header name
    const statusIdx   = headers.findIndex((h) => h.toLowerCase().trim() === "status");
    const claimedIdx  = headers.findIndex((h) => h.toLowerCase().trim() === "claimed");
    const nrCorpIdx   = headers.findIndex((h) => h.toLowerCase().includes("nr from corp"));

    const results: NJRecord[] = [];
    for (const row of dataRows) {
      const empId = row[0]?.trim();
      const name = row[1]?.trim();
      // Skip rows without a numeric emp ID (handles extra header rows in the sheet)
      if (!empId || !name || !/^\d+$/.test(empId)) continue;

      const claimedRaw = claimedIdx >= 0 ? parseNRValue(row[claimedIdx] ?? "") : null;
      const nrCorpRaw  = nrCorpIdx  >= 0 ? parseNRValue(row[nrCorpIdx]  ?? "") : null;

      results.push({
        empId,
        name,
        department: row[2]?.trim() || "Sales",
        managerName: row[3]?.trim() || "",
        location: row[4]?.trim() || "",
        joinDate: parseDOJ(row[5]?.trim() || ""),
        email: row[6]?.trim() || "",
        status: statusIdx >= 0 ? (row[statusIdx]?.trim() || "") : "",
        claimedCorporates: claimedRaw !== null ? claimedRaw : undefined,
        nrFromCorporates:  nrCorpRaw  !== null ? nrCorpRaw  : undefined,
      });
    }
    return results;
  }

  async fetchNR(): Promise<NRRecord[]> {
    const { headers, dataRows } = await this.fetchRows();

    // Identify monthly NR columns by parsing headers
    const monthCols: Array<{ idx: number; month: number; year: number }> = [];
    for (let i = 7; i < headers.length; i++) {
      const parsed = parseMonthHeader(headers[i]);
      if (parsed) monthCols.push({ idx: i, ...parsed });
    }

    const results: NRRecord[] = [];
    for (const row of dataRows) {
      const empId = row[0]?.trim();
      const njId = row[1]?.trim(); // use name as njId (matches upsertNR mutation)
      if (!njId || !empId || !/^\d+$/.test(empId)) continue;

      for (const col of monthCols) {
        const nrValue = parseNRValue(row[col.idx] ?? "");
        if (nrValue === null) continue; // "—" means NJ wasn't active that month

        results.push({
          njId,
          month: col.month,
          year: col.year,
          nrValue,
          isPositive: nrValue > 0,
          source: "RMS",
        });
      }
    }
    return results;
  }

  async fetchROI(): Promise<ROIRecord[]> {
    const { headers, dataRows } = await this.fetchRows();

    const monthCols: Array<{ idx: number; month: number; year: number }> = [];
    for (let i = 7; i < headers.length; i++) {
      const parsed = parseMonthHeader(headers[i]);
      if (parsed) monthCols.push({ idx: i, ...parsed });
    }

    const results: ROIRecord[] = [];
    // Track already-seen weekStart per NJ so later months don't overwrite earlier ones
    // (process oldest-first so newest month wins, since sheet is newest-first)
    const sortedCols = [...monthCols].sort(
      (a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    for (const row of dataRows) {
      const empId = row[0]?.trim();
      const njId = row[1]?.trim();
      if (!njId || !empId || !/^\d+$/.test(empId)) continue;

      const seen = new Set<string>();
      // Process newest first so newest month's color wins on overlapping weeks
      for (const col of [...sortedCols].reverse()) {
        const nrValue = parseNRValue(row[col.idx] ?? "");
        if (nrValue === null) continue;

        const colorCode: ROIRecord["colorCode"] =
          nrValue > 0 ? "Black" : nrValue < 0 ? "Red" : "Yellow";
        const roiValue = nrValue > 0 ? 80 : nrValue < 0 ? 10 : 30;

        for (const weekStart of weeksInMonth(col.year, col.month)) {
          if (!seen.has(weekStart)) {
            seen.add(weekStart);
            results.push({ njId, weekStart, roiValue, colorCode });
          }
        }
      }
    }
    return results;
  }

  async fetchRCB(): Promise<RCBRecord[]> {
    const { headers, dataRows } = await this.fetchRows();

    const nrCorpIdx = headers.findIndex((h) =>
      h.toLowerCase().includes("nr from corp")
    );

    if (nrCorpIdx < 0) return [];

    const today = new Date().toISOString().split("T")[0];
    const results: RCBRecord[] = [];

    for (const row of dataRows) {
      const empId = row[0]?.trim();
      const njId = row[1]?.trim();
      if (!njId || !empId || !/^\d+$/.test(empId)) continue;

      const revenue = parseNRValue(row[nrCorpIdx] ?? "");
      if (revenue === null || revenue <= 0) continue;

      results.push({
        njId,
        corporateName: "Corporate Claims",
        claimDate: today,
        status: "Approved",
        revenueLinked: revenue,
      });
    }
    return results;
  }

  // Not available in Google Sheets — return empty arrays
  async fetchQubits(): Promise<QubitRecord[]> { return []; }
  async fetchLeads(): Promise<LeadRecord[]> { return []; }
}

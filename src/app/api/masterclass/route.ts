import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BASE = "https://api.koenig-solutions.com";

// Only show sessions where at least one of these emails is in the audience
const TARGET_AUDIENCE = new Set([
  "csm@koenig-solutions.com",
  "csm-india@koenig-solutions.com",
  "kites@koenig-solutions.com",
  "kites-india@koenig-solutions.com",
]);

async function getMasterclassToken(): Promise<{ accessToken: string; deviceToken: string }> {
  const res = await fetch(`${BASE}/api/Kites/Operator/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: "Gunjan",
      userPassword: "Gun@3547",
      userRole: "HR",
    }),
  });
  if (!res.ok) throw new Error(`GetToken HTTP ${res.status}`);
  const data = await res.json();
  if (data.statuscode !== 200) throw new Error(`Auth failed: ${data.message}`);
  return { accessToken: data.content.accessToken, deviceToken: data.content.deviceToken };
}

function parseAudience(raw: string): string[] {
  return raw.split(";").map((e) => e.trim()).filter(Boolean);
}

function hasTargetAudience(audience: string[]): boolean {
  return audience.some((e) => TARGET_AUDIENCE.has(e.toLowerCase()));
}

function trainingTypeLabel(type: string): string {
  const map: Record<string, string> = {
    "1": "Internal",
    "2": "External",
    "3": "Client-facing",
  };
  return map[type?.trim()] ?? `Type ${type}`;
}

export interface MasterclassItem {
  id: number;
  masterClass: string;
  conductedBy: string;
  date: string;
  dates: string;
  duration: string;
  trainingType: string;
  audience: string[];
  meetingLink: string;
  recordingLink: string; // from link / PPT / ventech fields
  completed: boolean;    // true if session date is in the past
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { accessToken, deviceToken } = await getMasterclassToken();

    const res = await fetch(`${BASE}/api/Kites/Operator/GetMasterClassList`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: { accessToken, deviceToken } }),
    });

    if (!res.ok) throw new Error(`GetMasterClassList HTTP ${res.status}`);
    const data = await res.json();
    if (data.statuscode !== 200) throw new Error(`API failed: ${data.message}`);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: MasterclassItem[] = (data.content as any[])
      .filter((r) => {
        const d = new Date(r.dates);
        if (isNaN(d.getTime())) return false;
        // Include upcoming + last 2 weeks
        if (d < twoWeeksAgo) return false;
        // Must have target audience
        const audience = parseAudience(r.Audience ?? "");
        return hasTargetAudience(audience);
      })
      .sort((a, b) => new Date(a.dates).getTime() - new Date(b.dates).getTime())
      .map((r) => {
        const sessionDate = new Date(r.dates);
        const completed = sessionDate < now;
        const recordingLink =
          (typeof r.link === "string" && r.link.trim()) ||
          (typeof r.PPT === "string" && r.PPT.trim()) ||
          (typeof r.ventech === "string" && r.ventech.trim()) ||
          "";
        return {
          id: r.id,
          masterClass: r.masterClass ?? "",
          conductedBy: r.ConductedBy ?? "",
          date: r.date ?? "",
          dates: r.dates ?? "",
          duration: r.Duration_In_Hours?.trim() ?? "",
          trainingType: trainingTypeLabel(r.TrainingType ?? ""),
          audience: parseAudience(r.Audience ?? ""),
          meetingLink: r.MeetingLink ?? "",
          recordingLink,
          completed,
        };
      });

    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

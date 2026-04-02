import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailLogs } from "@/lib/schema";
import { sendEmail } from "@/lib/msGraph";
import {
  paNoticeTemplate,
  pipNoticeTemplate,
  exitNoticeTemplate,
  customTemplate,
} from "@/lib/emailTemplates";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(session.user?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    njId?:       number;
    njName?:     string;
    to:          string[];
    cc?:         string[];
    template:    "PA" | "PIP" | "EXIT" | "Custom";
    subject?:    string;
    customBody?: string;
    triggeredAt?: string;
  };

  const { njId, njName, to, cc, template, subject, customBody, triggeredAt } = body;

  if (!to || to.length === 0) {
    return NextResponse.json({ error: "at least one recipient required" }, { status: 400 });
  }

  let emailSubject = subject ?? "";
  let bodyHtml = "";
  const managerName = session.user?.name ?? "Manager";
  const now = triggeredAt ?? new Date().toISOString();

  switch (template) {
    case "PA":
      emailSubject = emailSubject || `PA Notice — ${njName}`;
      bodyHtml = paNoticeTemplate(njName ?? "", managerName, now);
      break;
    case "PIP":
      emailSubject = emailSubject || `PIP Notice — ${njName}`;
      bodyHtml = pipNoticeTemplate(njName ?? "", managerName, now);
      break;
    case "EXIT":
      emailSubject = emailSubject || `Exit Review Notice — ${njName}`;
      bodyHtml = exitNoticeTemplate(njName ?? "", managerName, now);
      break;
    case "Custom":
      emailSubject = emailSubject || "Message from STP Dashboard";
      bodyHtml = customTemplate(emailSubject, customBody ?? "");
      break;
  }

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined;

  try {
    await sendEmail({ to, cc, subject: emailSubject, bodyHtml });
  } catch (err) {
    status = "failed";
    errorMessage = String(err);
  }

  await db.insert(emailLogs).values({
    njId:        njId ?? null,
    sentBy:      session.user?.email ?? session.user?.name ?? "unknown",
    toAddresses: JSON.stringify(to),
    subject:     emailSubject,
    template,
    bodySnippet: bodyHtml.slice(0, 200),
    sentAt:      new Date().toISOString(),
    status,
    errorMessage: errorMessage ?? null,
  });

  if (status === "failed") {
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

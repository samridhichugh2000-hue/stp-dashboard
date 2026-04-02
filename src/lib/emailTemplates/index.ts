// ── shared layout ─────────────────────────────────────────────────────────────

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 28px;">
      <p style="color:#fff;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:0 0 4px;">Koenig STP Dashboard</p>
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">${title}</h1>
    </div>
    <div style="padding:24px 28px;">${content}</div>
    <div style="padding:12px 28px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated message from the Koenig STP Dashboard · Do not reply</p>
    </div>
  </div>
</body>
</html>`;
}

function badge(text: string, color: "red" | "amber" | "green" | "blue"): string {
  const map = {
    red:   "background:#fee2e2;color:#b91c1c",
    amber: "background:#fef3c7;color:#92400e",
    green: "background:#d1fae5;color:#065f46",
    blue:  "background:#dbeafe;color:#1e40af",
  };
  return `<span style="${map[color]};font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;">${text}</span>`;
}

// ── templates ─────────────────────────────────────────────────────────────────

export function paNoticeTemplate(njName: string, managerName: string, triggeredAt: string): string {
  return layout("Performance Assessment Notice", `
    <p style="color:#374151;font-size:14px;">Dear ${managerName},</p>
    <p style="color:#374151;font-size:14px;">This is to inform you that <strong>${njName}</strong> has been flagged for a
    <strong>Performance Assessment (PA)</strong> review based on sustained negative NR performance.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">NJ Name</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${njName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Alert Type</td><td style="padding:8px 0;">${badge("PA Suggested", "amber")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Triggered</td><td style="padding:8px 0;color:#111827;font-size:13px;">${new Date(triggeredAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</td></tr>
    </table>
    <p style="color:#374151;font-size:14px;">Please schedule a PA review meeting at the earliest and update the dashboard accordingly.</p>
    <p style="color:#374151;font-size:14px;">Regards,<br/><strong>STP Dashboard</strong></p>
  `);
}

export function pipNoticeTemplate(njName: string, managerName: string, triggeredAt: string): string {
  return layout("Performance Improvement Plan Notice", `
    <p style="color:#374151;font-size:14px;">Dear ${managerName},</p>
    <p style="color:#374151;font-size:14px;"><strong>${njName}</strong> requires a formal
    <strong>Performance Improvement Plan (PIP)</strong>. NR has remained negative beyond 4 months of tenure.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">NJ Name</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${njName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Alert Type</td><td style="padding:8px 0;">${badge("PIP Required", "red")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Triggered</td><td style="padding:8px 0;color:#111827;font-size:13px;">${new Date(triggeredAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</td></tr>
    </table>
    <p style="color:#374151;font-size:14px;">Immediate action required. Please initiate PIP documentation and schedule the review.</p>
    <p style="color:#374151;font-size:14px;">Regards,<br/><strong>STP Dashboard</strong></p>
  `);
}

export function exitNoticeTemplate(njName: string, managerName: string, triggeredAt: string): string {
  return layout("Exit Review Notice", `
    <p style="color:#374151;font-size:14px;">Dear ${managerName},</p>
    <p style="color:#374151;font-size:14px;"><strong>${njName}</strong> has been flagged for an
    <strong>Exit Review</strong>. This is a mandatory review requiring Admin acknowledgement.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">NJ Name</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${njName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Alert Type</td><td style="padding:8px 0;">${badge("Exit Review", "red")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Triggered</td><td style="padding:8px 0;color:#111827;font-size:13px;">${new Date(triggeredAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</td></tr>
    </table>
    <p style="color:#374151;font-size:14px;">Please coordinate with Admin and HR immediately.</p>
    <p style="color:#374151;font-size:14px;">Regards,<br/><strong>STP Dashboard</strong></p>
  `);
}

export function dailyAdminTemplate(date: string, items: { njName: string; issues: string[] }[]): string {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:600;">${i.njName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${i.issues.join(" · ")}</td>
    </tr>`
  ).join("");

  return layout(`Daily STP Summary — ${date}`, `
    <p style="color:#374151;font-size:14px;">Here is today's STP action summary requiring your attention.</p>
    ${items.length === 0
      ? `<p style="color:#059669;font-size:14px;font-weight:600;">✓ All clear — no pending actions today.</p>`
      : `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;">NJ Name</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;">Issues</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
    }
    <p style="color:#374151;font-size:14px;">Regards,<br/><strong>STP Dashboard</strong></p>
  `);
}

export function dailyManagerTemplate(managerName: string, date: string, items: { njName: string; issues: string[] }[]): string {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:600;">${i.njName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${i.issues.join(" · ")}</td>
    </tr>`
  ).join("");

  return layout(`Your Team — Daily Update ${date}`, `
    <p style="color:#374151;font-size:14px;">Hi ${managerName},</p>
    <p style="color:#374151;font-size:14px;">Here is today's update for your team.</p>
    ${items.length === 0
      ? `<p style="color:#059669;font-size:14px;font-weight:600;">✓ All clear — no pending actions for your team today.</p>`
      : `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;">NJ Name</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;">Today's Issues</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
    }
    <p style="color:#374151;font-size:14px;">Regards,<br/><strong>STP Dashboard</strong></p>
  `);
}

export function customTemplate(subject: string, body: string): string {
  return layout(subject, `<div style="color:#374151;font-size:14px;line-height:1.6;">${body}</div>`);
}

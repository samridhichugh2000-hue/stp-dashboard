import { NextResponse } from "next/server";
import { client } from "@/lib/db";

export async function GET() {
  const result = await client.execute(`
    SELECT
      ml.id,
      ml.nj_id       AS njId,
      ml.meeting_type AS meetingType,
      ml.subject,
      ml.scheduled_at AS scheduledAt,
      ml.duration_mins AS durationMins,
      ml.created_at   AS createdAt,
      nj.name         AS njName,
      nj.emp_id       AS njEmpId
    FROM meeting_logs ml
    INNER JOIN new_joiners nj ON nj.id = ml.nj_id
    WHERE ml.status = 'Pending'
      AND nj.is_active = 1
    ORDER BY ml.scheduled_at ASC
  `);

  return NextResponse.json(result.rows);
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json();
  if (!id || !["Completed", "Cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await client.execute({
    sql: `UPDATE meeting_logs SET status = ? WHERE id = ?`,
    args: [status, id],
  });
  return NextResponse.json({ ok: true });
}

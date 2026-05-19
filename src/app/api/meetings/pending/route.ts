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
    ORDER BY ml.scheduled_at ASC
  `);

  return NextResponse.json(result.rows);
}

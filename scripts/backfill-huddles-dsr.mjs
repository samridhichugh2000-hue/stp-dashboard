/**
 * scripts/backfill-huddles-dsr.mjs
 *
 * Backfills huddle_logs and dsr_submissions for ALL active NJs regardless
 * of how many working days they are past their join date.
 *
 * Usage:
 *   node scripts/backfill-huddles-dsr.mjs
 *   node scripts/backfill-huddles-dsr.mjs --dsr-only
 *   node scripts/backfill-huddles-dsr.mjs --huddles-only
 *   node scripts/backfill-huddles-dsr.mjs --nj "Deepa Saha"
 */

import { createClient } from '@libsql/client';

const DB_URL   = 'libsql://stp-koenig-solutions.aws-ap-south-1.turso.io';
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

const GRAPH_TENANT = '98deb14a-8f2f-48b2-807f-8a97c96a0ca3';
const GRAPH_CLIENT = 'dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2';
const GRAPH_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const CALENDAR_OWNER = 'samridhi.chugh@koenig-solutions.com';  // Teams calendar owner
const MAILBOX        = 'samridhi.chugh@koenig-solutions.com';  // DSR mailbox

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

// ── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DSR_ONLY     = args.includes('--dsr-only');
const HUDDLES_ONLY = args.includes('--huddles-only');
const NJ_FILTER    = (() => {
  const i = args.indexOf('--nj');
  return i !== -1 ? args[i + 1]?.toLowerCase() : null;
})();

// ── Date helpers ─────────────────────────────────────────────────────────────

function isWeekend(date) {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

/** Returns ISO date strings for working days fromDay..toDay (1-indexed) after doj */
function computeWorkingDayRange(dojISO, fromDay, toDay) {
  const doj = new Date(dojISO);
  const dates = [];
  let wdCount = 0;
  let offset = 1;
  while (wdCount < toDay) {
    const d = new Date(doj);
    d.setDate(doj.getDate() + offset);
    if (!isWeekend(d)) {
      wdCount++;
      if (wdCount >= fromDay) dates.push(d.toISOString().split('T')[0]);
    }
    offset++;
    if (offset > 60) break; // safety
  }
  return dates;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── Microsoft Graph auth ─────────────────────────────────────────────────────

async function getGraphToken() {
  const r = await fetch(
    `https://login.microsoftonline.com/${GRAPH_TENANT}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     GRAPH_CLIENT,
        client_secret: GRAPH_SECRET,
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!r.ok) throw new Error(`Graph token failed ${r.status}: ${await r.text()}`);
  const d = await r.json();
  if (!d.access_token) throw new Error('Graph token: no access_token');
  return d.access_token;
}

// ── Calendar helpers ─────────────────────────────────────────────────────────

async function fetchCalendarEvents(token, userEmail, startDate, endDate) {
  let url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/calendarView` +
    `?startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z` +
    `&$select=id,subject,start,end,onlineMeeting&$top=100`;

  const events = [];
  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!r.ok) throw new Error(`calendarView ${r.status}: ${await r.text()}`);
    const d = await r.json();
    events.push(...(d.value ?? []));
    url = d['@odata.nextLink'] ?? '';
  }
  return events;
}

async function fetchMeetingId(token, userEmail, joinUrl) {
  const filter = `JoinWebUrl eq '${joinUrl.replace(/'/g, "''")}'`;
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/onlineMeetings` +
    `?$filter=${encodeURIComponent(filter)}&$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return d.value?.[0]?.id ?? null;
}

async function fetchAttendees(token, userEmail, meetingId) {
  const rr = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}` +
    `/onlineMeetings/${meetingId}/attendanceReports?$orderby=meetingEndDateTime desc&$top=1&$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!rr.ok) return [];
  const rd = await rr.json();
  const reportId = rd.value?.[0]?.id;
  if (!reportId) return [];

  const ar = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}` +
    `/onlineMeetings/${meetingId}/attendanceReports/${reportId}/attendanceRecords` +
    `?$select=attendee,totalAttendanceInSeconds`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!ar.ok) return [];
  const ad = await ar.json();
  return (ad.value ?? [])
    .map(r => r.attendee?.emailAddress?.toLowerCase() ?? '')
    .filter(Boolean);
}

/** attendeeCache: joinUrl → string[] */
async function checkCompleted(event, njEmailLower, token, attendeeCache) {
  if (!event) return false;
  const now = new Date();
  const ended = new Date(event.endDateTime) < now;
  if (!event.joinUrl) return true;         // in-person → existence = done
  if (!ended) return false;                // still running
  if (!njEmailLower) return true;          // no email → existence = done

  let attendees = attendeeCache.get(event.joinUrl);
  if (!attendees) {
    const meetingId = await fetchMeetingId(token, CALENDAR_OWNER, event.joinUrl);
    attendees = meetingId
      ? await fetchAttendees(token, CALENDAR_OWNER, meetingId)
      : [];
    attendeeCache.set(event.joinUrl, attendees);
  }

  if (attendees.length === 0) {
    // Attendance report unavailable for old meetings — fall back to event existence
    console.log(`      ⚠ No attendance report for ${event.joinUrl.slice(-20)} — marking completed=true by existence`);
    return true;
  }
  return attendees.includes(njEmailLower);
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function upsertHuddle(njId, date, completed, isExtended, teamsEventId) {
  const ex = await db.execute({
    sql: 'SELECT id FROM huddle_logs WHERE nj_id=? AND date=?',
    args: [njId, date],
  });
  if (ex.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE huddle_logs SET completed=?, is_extended=?, teams_event_id=? WHERE id=?',
      args: [completed ? 1 : 0, isExtended ? 1 : 0, teamsEventId ?? null, ex.rows[0].id],
    });
    return 'updated';
  } else {
    await db.execute({
      sql: `INSERT INTO huddle_logs (nj_id, date, type, conducted_by, completed, is_extended, teams_event_id)
            VALUES (?, ?, 'Daily', ?, ?, ?, ?)`,
      args: [njId, date, CALENDAR_OWNER, completed ? 1 : 0, isExtended ? 1 : 0, teamsEventId ?? null],
    });
    return 'inserted';
  }
}

// ── DSR helpers ──────────────────────────────────────────────────────────────

const SUBJECT_KEYWORD = 'your sales training plan';

async function fetchDSREmailsForDate(token, date) {
  const search = encodeURIComponent(`subject:training received:${date}`);
  const url =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages` +
    `?$search="${search}"&$select=id,subject,receivedDateTime,from&$top=200`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    console.warn(`    DSR fetch for ${date} → ${r.status}: ${await r.text()}`);
    return [];
  }
  const d = await r.json();
  return (d.value ?? []).filter(m =>
    m.subject?.toLowerCase().includes(SUBJECT_KEYWORD) &&
    m.receivedDateTime?.startsWith(date)
  );
}

async function upsertDSR(njId, date, emailId, submittedAt) {
  const ex = await db.execute({
    sql: 'SELECT id FROM dsr_submissions WHERE email_id=?',
    args: [emailId],
  });
  if (ex.rows.length > 0) return 'exists';
  await db.execute({
    sql: 'INSERT INTO dsr_submissions (nj_id, date, email_id, submitted_at) VALUES (?, ?, ?, ?)',
    args: [njId, date, emailId, submittedAt],
  });
  return 'inserted';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== STP Backfill: Huddles + DSR ===\n');
  console.log(`Mode: ${DSR_ONLY ? 'DSR only' : HUDDLES_ONLY ? 'Huddles only' : 'Both'}`);
  if (NJ_FILTER) console.log(`NJ filter: "${NJ_FILTER}"`);
  console.log();

  // 1. Load active NJs
  const njRes = await db.execute(
    `SELECT id, name, email, join_date, stp_extended_days, category
     FROM new_joiners WHERE is_active=1 ORDER BY join_date ASC`
  );
  let njs = njRes.rows.map(r => ({
    id:              Number(r.id),
    name:            String(r.name),
    email:           r.email ? String(r.email).toLowerCase() : '',
    joinDate:        String(r.join_date),
    stpExtendedDays: Number(r.stp_extended_days ?? 0),
    category:        String(r.category ?? 'Uncategorised'),
  }));

  if (NJ_FILTER) {
    njs = njs.filter(nj => nj.name.toLowerCase().includes(NJ_FILTER));
    if (njs.length === 0) { console.log('No NJs matched filter.'); process.exit(0); }
  }

  console.log(`Found ${njs.length} active NJ(s):\n`);
  for (const nj of njs) {
    const maxDays = 14 + (nj.stpExtendedDays || 0);
    const dates = computeWorkingDayRange(nj.joinDate, 1, maxDays);
    console.log(`  ${nj.name} (joined ${nj.joinDate}, window: ${dates[0]} → ${dates[dates.length - 1]}, max WDs=${maxDays})`);
  }
  console.log();

  // 2. Get Graph token
  console.log('Getting MS Graph token...');
  const token = await getGraphToken();
  console.log('Token OK.\n');

  const today = todayISO();

  // ── Huddle backfill ────────────────────────────────────────────────────────

  let totalHuddles = 0;

  if (!DSR_ONLY) {
    console.log('=== HUDDLE BACKFILL ===\n');

    // Compute the overall calendar range we need to fetch
    const allWindowDates = njs.flatMap(nj => {
      const maxDays = 14 + (nj.stpExtendedDays || 0);
      return computeWorkingDayRange(nj.joinDate, 1, maxDays).filter(d => d <= today);
    });

    if (allWindowDates.length === 0) {
      console.log('No past huddle dates to backfill.\n');
    } else {
      const calStart = allWindowDates.reduce((a, b) => (a < b ? a : b));
      const calEnd   = today;

      console.log(`Fetching calendar events: ${calStart} → ${calEnd}`);
      const events = await fetchCalendarEvents(token, CALENDAR_OWNER, calStart, calEnd);
      console.log(`Fetched ${events.length} calendar events.\n`);

      // Build date → events lookup
      const eventsByDate = {};
      for (const ev of events) {
        if (!ev.start?.dateTime) continue;
        const evDate = ev.start.dateTime.split('T')[0];
        if (!eventsByDate[evDate]) eventsByDate[evDate] = [];
        eventsByDate[evDate].push({
          subject:     (ev.subject ?? '').toLowerCase(),
          id:          ev.id,
          joinUrl:     ev.onlineMeeting?.joinUrl ?? null,
          endDateTime: ev.end?.dateTime ?? ev.start.dateTime,
        });
      }

      const attendeeCache = new Map();

      for (const nj of njs) {
        const firstName = nj.name.split(' ')[0].toLowerCase();
        const maxDays   = 14 + (nj.stpExtendedDays || 0);
        const dates     = computeWorkingDayRange(nj.joinDate, 1, maxDays)
          .filter(d => d <= today);

        console.log(`Processing ${nj.name} (${dates.length} dates):`);

        let njHuddles = 0;
        for (const date of dates) {
          const isExtended = computeWorkingDayRange(nj.joinDate, 15, maxDays).includes(date);
          const dayEvents  = eventsByDate[date] ?? [];
          const matched    = dayEvents.find(e =>
            e.subject.includes(`huddle with hr - ${firstName}`)
          );

          const completed = await checkCompleted(matched, nj.email, token, attendeeCache);
          const action    = await upsertHuddle(nj.id, date, completed, isExtended, matched?.id ?? null);
          const icon      = completed ? '✓' : '✗';
          console.log(`  ${date} [${icon}] ${matched ? matched.subject : '(no event)'} → ${action}`);
          njHuddles++;
        }
        console.log(`  → ${njHuddles} huddle records processed\n`);
        totalHuddles += njHuddles;
      }
    }
  }

  // ── DSR backfill ───────────────────────────────────────────────────────────

  let totalDSR = 0;

  if (!HUDDLES_ONLY) {
    console.log('=== DSR BACKFILL ===\n');

    // Build emailToNjId map
    const emailToNj = new Map();
    for (const nj of njs) {
      if (nj.email) emailToNj.set(nj.email, nj.id);
    }

    // Collect all unique working-day dates across all NJs (past only, weekdays only)
    const dateSet = new Set();
    for (const nj of njs) {
      const maxDays = 14 + (nj.stpExtendedDays || 0);
      for (const d of computeWorkingDayRange(nj.joinDate, 1, maxDays)) {
        if (d <= today) dateSet.add(d);
      }
    }
    const allDates = [...dateSet].sort();

    console.log(`Searching DSR emails for ${allDates.length} unique dates...\n`);

    for (const date of allDates) {
      const msgs = await fetchDSREmailsForDate(token, date);
      if (msgs.length === 0) {
        console.log(`${date}: no DSR emails`);
        continue;
      }

      let inserted = 0;
      for (const msg of msgs) {
        const sender = msg.from?.emailAddress?.address?.toLowerCase();
        if (!sender) continue;
        const njId = emailToNj.get(sender);
        if (!njId) continue;

        const action = await upsertDSR(njId, date, msg.id, msg.receivedDateTime);
        if (action === 'inserted') inserted++;
        totalDSR++;
      }
      console.log(`${date}: ${msgs.length} emails found, ${inserted} new DSR records inserted`);
    }
    console.log();
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log('=== DONE ===');
  if (!DSR_ONLY)     console.log(`Huddle records processed: ${totalHuddles}`);
  if (!HUDDLES_ONLY) console.log(`DSR records processed:    ${totalDSR}`);

  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

import fetch from 'node-fetch';
import { createClient } from '@libsql/client';

const DB_URL = 'libsql://stp-koenig-solutions.aws-ap-south-1.turso.io';
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;
const KOENIG_API = 'https://api.koenig-solutions.com';
const GRAPH_TENANT = '98deb14a-8f2f-48b2-807f-8a97c96a0ca3';
const GRAPH_CLIENT = 'dcb6ce18-d8cb-4cb1-a96c-86005af9d5b2';
const GRAPH_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const MAILBOX      = 'samridhi.chugh@koenig-solutions.com';

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

// ── Auth ────────────────────────────────────────────────────────────────────

async function getKoenigToken() {
  const r = await fetch(`${KOENIG_API}/api/Kites/Operator/GetToken`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'Samridhi', userPassword: 'Samridhi@26', userRole: 'HR' }),
  });
  const d = await r.json();
  if (d.statuscode !== 200) throw new Error('Koenig token: ' + d.message);
  return d.content;
}

async function getGraphToken() {
  const r = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: GRAPH_CLIENT, client_secret: GRAPH_SECRET, scope: 'https://graph.microsoft.com/.default' }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Graph token failed');
  return d.access_token;
}

// ── NR Sync ─────────────────────────────────────────────────────────────────

async function syncNR(token) {
  const MONTH = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const today = new Date(), start = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  const r = await fetch(`${KOENIG_API}/api/Kites/Operator/GetCCENRData`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, startDate: fmt(start), endDate: fmt(today) }),
  });
  const d = await r.json();
  if (d.statuscode !== 200) throw new Error('GetCCENRData: ' + d.message);
  const records = Array.isArray(d.content) ? d.content : [];

  const njs = await db.execute('SELECT id, emp_id FROM new_joiners WHERE emp_id IS NOT NULL');
  const empToId = new Map(njs.rows.map(n => [String(n.emp_id), Number(n.id)]));

  let count = 0;
  for (const raw of records) {
    const empId = String(raw.EmpId ?? raw.empId ?? '').trim();
    const njId = empToId.get(empId);
    if (!njId) continue;
    const monthly = raw.MonthlyRevenue;
    if (!monthly || typeof monthly !== 'object' || Array.isArray(monthly)) continue;
    for (const [key, val] of Object.entries(monthly)) {
      const parts = key.split('-');
      if (parts.length !== 2) continue;
      const month = MONTH[parts[0].toLowerCase().slice(0, 3)];
      const year = parseInt(parts[1]);
      if (!month || isNaN(year)) continue;
      const nrValue = parseFloat(String(val).replace(/,/g, ''));
      if (isNaN(nrValue)) continue;
      const ex = await db.execute({ sql: 'SELECT id FROM nr_records WHERE nj_id=? AND month=? AND year=?', args: [njId, month, year] });
      if (ex.rows.length > 0) {
        await db.execute({ sql: 'UPDATE nr_records SET nr_value=?,is_positive=? WHERE id=?', args: [nrValue, nrValue > 0 ? 1 : 0, ex.rows[0].id] });
      } else {
        await db.execute({ sql: 'INSERT INTO nr_records (nj_id,month,year,nr_value,is_positive,source) VALUES (?,?,?,?,?,?)', args: [njId, month, year, nrValue, nrValue > 0 ? 1 : 0, 'RMS'] });
      }
      count++;
    }
  }
  await db.execute({ sql: "INSERT INTO sync_logs (module,last_sync_at,status,error_message,records_processed) VALUES ('nr',?,'success',NULL,?) ON CONFLICT(module) DO UPDATE SET last_sync_at=excluded.last_sync_at,status=excluded.status,error_message=excluded.error_message,records_processed=excluded.records_processed", args: [new Date().toISOString(), count] });
  return { sync: 'NR', njsProcessed: records.length, nrRecordsUpserted: count };
}

// ── RCB Sync ────────────────────────────────────────────────────────────────

async function syncRCB(token) {
  const today = new Date(), start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const fmt = d => d.toISOString().split('T')[0];
  const parseNum = v => { const n = parseFloat(String(v ?? 0).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

  const r = await fetch(`${KOENIG_API}/api/Kites/Operator/GetRCBData`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, EmpId: '0', startDate: fmt(start), endDate: fmt(today) }),
  });
  const d = await r.json();
  if (d.statuscode !== 200) throw new Error('GetRCBData: ' + d.message);
  const records = Array.isArray(d.content) ? d.content : [];

  const njs = await db.execute('SELECT id, emp_id FROM new_joiners WHERE emp_id IS NOT NULL');
  const empToId = new Map(njs.rows.map(n => [String(n.emp_id), Number(n.id)]));

  const agg = new Map();
  for (const raw of records) {
    const empId = String(raw.EmpId ?? raw.empId ?? raw.EmpID ?? '').trim();
    if (!empId || empId === '0') continue;
    const nr = parseNum(raw.NR ?? raw.nr ?? raw.Revenue ?? 0);
    const clients = parseNum(raw.NoOfClients ?? raw.noOfClients ?? 0);
    const e = agg.get(empId);
    if (e) { e.claimed++; e.nr += nr; e.clients += clients; }
    else { agg.set(empId, { claimed: 1, nr, clients }); }
  }

  let count = 0;
  const now = new Date().toISOString();
  for (const [empId, a] of agg) {
    const njId = empToId.get(empId);
    if (!njId) continue;
    const ex = await db.execute({ sql: 'SELECT id FROM rcb_summary WHERE nj_id=?', args: [njId] });
    if (ex.rows.length > 0) {
      await db.execute({ sql: 'UPDATE rcb_summary SET claimed_corporates=?,nr_from_corporates=?,no_of_clients=?,last_sync_at=? WHERE nj_id=?', args: [a.claimed, a.nr, a.clients, now, njId] });
    } else {
      await db.execute({ sql: 'INSERT INTO rcb_summary (nj_id,claimed_corporates,nr_from_corporates,no_of_clients,last_sync_at) VALUES (?,?,?,?,?)', args: [njId, a.claimed, a.nr, a.clients, now] });
    }
    count++;
  }
  await db.execute({ sql: "INSERT INTO sync_logs (module,last_sync_at,status,error_message,records_processed) VALUES ('rcb',?,'success',NULL,?) ON CONFLICT(module) DO UPDATE SET last_sync_at=excluded.last_sync_at,status=excluded.status,error_message=excluded.error_message,records_processed=excluded.records_processed", args: [new Date().toISOString(), count] });
  return { sync: 'RCB', apiRecords: records.length, njsUpdated: count };
}

// ── DSR Sync ────────────────────────────────────────────────────────────────

async function syncDSR(graphToken) {
  const today = new Date().toISOString().split('T')[0];
  const search = encodeURIComponent(`subject:"sales training plan" received:${today}`);
  const url = `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages?$search="${search}"&$select=id,subject,receivedDateTime,from&$top=200`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${graphToken}` } });
  if (!r.ok) throw new Error(`DSR Graph ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const msgs = (d.value ?? []).filter(m =>
    m.subject?.toLowerCase().includes('your sales training plan') &&
    m.receivedDateTime?.startsWith(today)
  );

  const njs = await db.execute('SELECT id, email FROM new_joiners WHERE email IS NOT NULL AND is_active=1');
  const emailToId = new Map(njs.rows.filter(n => n.email).map(n => [String(n.email).toLowerCase(), Number(n.id)]));

  let count = 0;
  for (const msg of msgs) {
    const sender = msg.from?.emailAddress?.address?.toLowerCase();
    const njId = sender ? emailToId.get(sender) : null;
    if (!njId) continue;
    const ex = await db.execute({ sql: 'SELECT id FROM dsr_submissions WHERE email_id=?', args: [msg.id] });
    if (ex.rows.length === 0) {
      await db.execute({ sql: 'INSERT INTO dsr_submissions (nj_id,date,email_id,submitted_at) VALUES (?,?,?,?)', args: [njId, today, msg.id, msg.receivedDateTime] });
      count++;
    }
  }
  await db.execute({ sql: "INSERT INTO sync_logs (module,last_sync_at,status,error_message,records_processed) VALUES ('dsr_sync',?,'success',NULL,?) ON CONFLICT(module) DO UPDATE SET last_sync_at=excluded.last_sync_at,status=excluded.status,error_message=excluded.error_message,records_processed=excluded.records_processed", args: [new Date().toISOString(), count] });
  return { sync: 'DSR', date: today, emailsFound: msgs.length, newRecords: count };
}

// ── Milestones ───────────────────────────────────────────────────────────────

async function syncMilestones() {
  const njs = await db.execute('SELECT id, tenure_months FROM new_joiners WHERE is_active=1');
  const nrAll = await db.execute('SELECT nj_id, is_positive FROM nr_records');
  const nrByNj = new Map();
  for (const r of nrAll.rows) {
    if (!nrByNj.has(r.nj_id)) nrByNj.set(r.nj_id, []);
    nrByNj.get(r.nj_id).push(!!r.is_positive);
  }
  const existing = await db.execute('SELECT nj_id, alert_type FROM performance_alerts WHERE acknowledged_at IS NULL');
  const existingSet = new Set(existing.rows.map(a => `${a.nj_id}_${a.alert_type}`));
  const now = new Date().toISOString();
  let count = 0;
  for (const nj of njs.rows) {
    const months = Number(nj.tenure_months);
    if (months < 3) continue;
    const nrs = nrByNj.get(nj.id) ?? [];
    if (!nrs.some(p => !p)) continue; // no negative NR → skip
    for (const [m, type] of [[3,'PA'],[4,'PIP'],[5,'EXIT']]) {
      if (months >= m && !existingSet.has(`${nj.id}_${type}`)) {
        await db.execute({ sql: 'INSERT INTO performance_alerts (nj_id,alert_type,triggered_at) VALUES (?,?,?)', args: [nj.id, type, now] });
        count++;
      }
    }
  }
  await db.execute({ sql: "INSERT INTO sync_logs (module,last_sync_at,status,error_message,records_processed) VALUES ('milestones',?,'success',NULL,?) ON CONFLICT(module) DO UPDATE SET last_sync_at=excluded.last_sync_at,status=excluded.status,error_message=excluded.error_message,records_processed=excluded.records_processed", args: [new Date().toISOString(), count] });
  return { sync: 'Milestones', alertsCreated: count };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Authenticating...');
  const [token, graphToken] = await Promise.all([getKoenigToken(), getGraphToken()]);
  console.log('Tokens OK. Running syncs in parallel...\n');

  const results = await Promise.allSettled([
    syncNR(token),
    syncRCB(token),
    syncDSR(graphToken),
    syncMilestones(),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled') console.log('✓', JSON.stringify(r.value));
    else console.log('✗', r.reason?.message ?? r.reason);
  }
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

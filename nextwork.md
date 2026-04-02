# PRODUCT REQUIREMENTS DOCUMENT
## STP Interactive Dashboard
### *Sales Training & Evaluation Process — Unified Monitoring Platform*
**React + Tailwind + Turso + Vercel + RMS API**
Version 2.1 • April 2026 • Confidential

---

## Document Information

| Field | Value |
|---|---|
| **Document Title** | STP Interactive Dashboard — PRD |
| **Version** | 2.1 (Post Live Dashboard Review) |
| **Status** | Active Development — Phase 2 Features Pending |
| **Date** | April 2026 |
| **Prepared For** | Internal HR / Sales Operations Team |
| **Live URL** | https://stp-dashboard-lovat.vercel.app |
| **Tech Stack** | React + Tailwind CSS, Turso (edge SQLite / libSQL), Next.js API Routes, Vercel (Hosting + Cron), RMS API |
| **Auth** | NextAuth.js / Clerk (JWT, role-based) |
| **Email Service** | Resend (to be configured) |
| **RMS Data Modules** | Lead Allocation & TAT │ NR/NRD Panel │ ROI Panel │ Qubits Scores │ RCB/Corporate Panel |

> **⚠️ Architecture note:** Convex has been replaced with **Turso** (edge SQLite via libSQL). Scheduled sync jobs run via **Vercel Cron Jobs**. Real-time updates use polling + optional SSE.

---

## 1. Executive Summary

The STP Interactive Dashboard is live at https://stp-dashboard-lovat.vercel.app and already has significant functionality built. This PRD v2.1 documents the **actual current state** of the dashboard (reviewed April 2026), identifies gaps between what is built and what was specified, adds new features requested by stakeholders, and defines the Phase 2 build scope.

### 1.1 What Is Already Built and Working

The following is confirmed built from live dashboard review:

- **Target vs Achievement panel** — Q1 progress tracker, 6/14 CSMs developed (43%), KPI cards, CSM status breakdown table with NR/ROI/Q1 status per CSM.
- **NJ Overview panel** — 46 active CSMs tracked. KPI cards (Active/Developed/Not Developed/STP WIP). NJ list with filter tabs (All/Active/STP WIP/Developed/Not Developed/Inactive). Search by name, Emp ID, manager. Side drawer with NJ profile. DSR History modal (daily report compliance per NJ). Huddle Log (per NJ, date-stamped, marked by HR email).
- **STP WIP status** — displayed as a badge on NJ rows and in the side drawer.
- **NRD Panel** — 4 KPI cards, full monthly NR grid (NJ rows × month columns, colour-coded), horizontal scroll, manager filter, search, Export PDF.
- **ROI & Leads panel** — ROI KPI cards, total leads allocated, CSM ROI breakdown table with Leads/Registrations/Conversion Rate/ROI/Status, date range filter.
- **RCB Claims panel** — 3 KPI cards (38 CSMs, 727 corporates, ₹4.83 Cr NR), CSM corporate breakdown table, date range + manager filters.
- **Performance panel** — 4 KPI cards (Developed/Not Developed/Under Observation/PA-PIP Suggested), 5 charts (donut, tenure group bar, NR status bar, suggested actions bar, manager-wise performance bar), CSM performance breakdown table with suggested actions.
- **Masterclasses panel** *(beyond original PRD scope)* — upcoming sessions list with conductor, date, time, training type, audience, Join link. Last 2 weeks completed sessions.
- **FAQ & Documents panel** *(beyond original PRD scope)* — document library (4 docs), FAQ section (7 items), category tags, Add Document button.
- **Global shell** — sidebar navigation (collapsible), top bar with sync status, date, user/role badge, notification bell, refresh button. RMS sync footer bar showing last sync per module.

### 1.2 Critical Issue — RMS Sync Is Stale

**All 5 RMS modules show "978h ago" (approximately 40 days since last sync).** This is the single most urgent issue. All panels are displaying stale data. The sync pipeline (Vercel Cron Jobs or equivalent) must be debugged and restored before any new feature work is meaningful. See Section 10 for action items.

### 1.3 What Is Missing vs PRD (Phase 2 Build Scope)

The following are confirmed not yet built:

**Data gaps in existing panels:**
- TAT per-lead tracking table (Lead ID, assigned date, TAT hours, breach status) in ROI & Leads panel
- Pipeline funnel chart (Allocated → Actioned → Pipeline → Closed)
- ROI week-wise heatmap (Red/Black/Yellow colour coding per STP)
- Self-generated leads counter
- NR Trend chart (per-NJ line chart) in NRD panel
- India/Overseas CSM split in NRD panel
- NR Fluctuation alert (when NR alternates +/- for 2+ months)
- RCB Claim Status breakdown (Pending/Approved/Rejected per claim)
- Per-NJ Milestone Timeline (Month 1–6 visual) in Performance panel
- Alert Centre with Admin acknowledgement workflow (PA/PIP/Exit)
- Day-wise task tracker (Days 1–14 phase checklist) in NJ Overview
- Digital assessment checklist form (post-training)
- Phase 1 timeline progress bar per NJ
- "Mark as STP WIP" action button (status is shown but action to assign WIP is not confirmed)
- Qubits panel (not seen in screenshots — needs verification)

**New features requested (v2.1 additions):**
- STP Progress Tracker panel (dedicated section for all NJs undergoing STP)
- Email/report dispatch from dashboard (send mail with attached reports)
- Auto-trigger meetings (Google Calendar / MS Graph)
- Daily automated reminders (09:00 IST)
- Automated daily report generation and processing (18:00 IST)

### 1.4 What Was Built Beyond PRD Scope (retain as-is)

- Target vs Achievement panel (excellent — keep)
- Masterclasses panel (keep — highly relevant to STP training)
- FAQ & Documents panel (keep)
- DSR History modal on NJ Overview (keep — directly addresses daily report visibility)
- Manager-wise performance chart in Performance panel (keep)

### 1.5 Out of Scope (v2.1)

- MS Teams deep integration for scheduling (v2.2)
- AI-powered performance forecasting (v3.0)
- Two-way write-back to RMS (dependent on RMS providing write endpoints)

---

## 2. Stakeholders & User Roles

| Role | Who | Permissions & View |
|---|---|---|
| Admin | Samridhi / HR Lead | Full access to all NJ records, all panels, system config, API key management, audit logs, email dispatch, STP WIP marking, alert acknowledgement. |
| Manager | Team Lead / HR | View and annotate own team's NJ records. Fill assessment checklists. Send reports for their team. Cannot see other teams. |
| Viewer | Senior Management | Read-only access to aggregate dashboards and summary panels. |

---

## 3. System Architecture

### 3.1 Architecture Overview

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 18 + Tailwind CSS | All UI panels, charts, tables, filters, role-based views. |
| API Layer | Next.js API Routes | REST endpoints; handles RMS polling, Turso reads/writes, email dispatch, cron triggers. |
| Database | Turso (libSQL / SQLite) | All NJ state, scores, logs, alerts, email history, audit trail. |
| Data Source | RMS API (Bearer Token) | Authoritative source for leads, NR, ROI, Qubits, RCB. Polled via Vercel Cron. |
| Hosting & CI/CD | Vercel | Production + preview deployments, environment variables, Vercel Cron Jobs. |
| Authentication | NextAuth.js or Clerk | JWT sessions, role claims. |
| Email Service | Resend | Transactional emails, reports, meeting invites, reminders. |
| Calendar | Google Calendar API or MS Graph | Auto-trigger meeting invites for STP milestones. |

### 3.2 Data Flow

1. User logs in → Auth issues JWT with role claim.
2. Frontend calls Next.js API routes → queries Turso via libSQL client.
3. Vercel Cron Jobs run on schedule → call RMS API → normalise → upsert into Turso.
4. Frontend polls API endpoints on configurable intervals (or SSE for alert events).
5. Mutations (mark STP WIP, fill checklist, acknowledge alert) write to Turso via API route.
6. Email dispatch calls Resend API from server-side only — never from frontend.

### 3.3 RMS API Integration

All RMS calls are server-side only. Bearer Token stored in Vercel env secrets.

| Header | Value |
|---|---|
| Authorization | Bearer `<RMS_API_TOKEN>` |
| Content-Type | application/json |
| Accept | application/json |

> **Placeholder:** Provide RMS Base URL, endpoint paths for 5 modules, sample JSON responses, rate limits, pagination scheme, token expiry policy.

---

## 4. Dashboard Panels — Full Specification

---

## Panel 0 (NEW — Phase 2): STP Progress Tracker

| Field | Value |
|---|---|
| **Purpose** | Central command panel for all NJs actively undergoing STP. Shows live progress, automates meeting scheduling, sends reminders, and processes daily reports. |
| **Primary Users** | Admin, Manager |
| **Data Source** | Turso: `stp_progress`, `meeting_logs`, `reminder_logs`, `daily_reports` |
| **Refresh Rate** | Every 5 minutes. Manual refresh. |

### 4.0.1 Sub-sections

**A. STP Active NJ Board**
- Card or table view of all NJs with status `STP_WIP` or `STP_ACTIVE`.
- Per card/row: NJ Name, Join Date, STP Day (e.g. Day 7 of 90), Current Phase, Last Activity, Manager, STP Status Badge.
- Status badges: `STP WIP` (grey), `Phase 1 — Training` (blue), `Phase 2 — Core Ops` (amber), `Developed` (green), `On PA` (orange), `On PIP` (red), `Exited` (dark red).
- Click any card to open full STP timeline in a side drawer.

**B. Mark as STP WIP (Action)**
- "Mark as STP WIP" button — available on each NJ card and in the NJ Overview panel.
- Admin selects NJ, confirms, adds optional note.
- Updates `stp_status` to `STP_WIP` in Turso immediately.
- STP WIP NJs appear in the tracker board with a grey badge and do not trigger milestone evaluations yet.
- Audit log entry: userId, timestamp, note.
- "Unmark WIP" option to revert status.

**C. Automated Meeting Triggers**
- Auto-creates calendar invites on STP milestones via Google Calendar API or MS Graph.
- Meetings triggered for:
  - End-of-Phase-1 Manager Huddle (Day 14)
  - Month 1 Review
  - Month 3 PA Review (if PA triggered)
  - Month 4 PIP Review (if PIP triggered)
  - Month 5 Exit Review (if Exit triggered)
- Each creates a calendar event with **New Joiner + Admin** as attendees.
- Meeting status (Scheduled/Completed/Cancelled) shown on NJ STP timeline.
- Manual "Schedule Meeting" button on each NJ card for ad-hoc meetings.
- All records stored in Turso `meeting_logs` table.

**D. Daily Reminders**
- Automated daily emails at 09:00 IST via Vercel Cron → Resend dispatched to three recipient groups:
  - **Manager** — list of their NJs due for huddle today, overdue tasks, upcoming milestones.
  - **Admin** — full summary across all NJs requiring action.
  - **NJ** — their own task reminders for the day (what to complete, pending DSR, upcoming huddle).
- **Open recipient option** — on any reminder, Admin can add one or more custom email addresses (e.g. a senior stakeholder, a skip-level manager) before dispatch. This is available both on the scheduled daily reminder and when manually resending.
- Reminder content dynamically generated from Turso data.
- Reminder history stored in `reminder_logs` table. Admin can view and resend any reminder from the Reminder Manager.

**E. Daily Report Processing**
- End-of-day report auto-generated at 18:00 IST per active NJ.
- Report includes: Qubits score, leads actioned, huddle completed (Y/N), tasks completed vs pending, alerts triggered, DSR submitted (Y/N).
- Stored in `daily_reports` table.
- Admin and Manager can view daily reports in-dashboard for any NJ on any date.
- Exportable as PDF or sendable by email.

**F. Email & Report Dispatch**
- Available to Admin (all NJs) and Manager (their team only).
- Accessible from: STP Tracker, ROI panel, NRD panel, Performance panel, and "Send Report" button on each NJ card.
- Compose window:
  - **To:** Dynamically populated based on context:
    - For PA/PIP/Exit notices — strictly pre-filled from RMS API (recipients configured against that NJ's PA/PIP record). No manual additions permitted.
    - For reports and reminders — pre-filled with NJ's Manager and Admin, with an **open field** to add any additional custom email address(es).
  - **Template selector:** Daily Report | ROI Summary | PA Notice | PIP Notice | Exit Notice | Custom.
  - **Attach:** Auto-attach relevant panel data as PDF or inline HTML.
  - **Schedule:** Send now or at a specified time.
- Sent via Resend API from server-side Next.js API route only.
- Sent email records in `email_logs` table with sender, recipients, template, timestamp.
- Admin can view full email history per NJ in the audit trail.

---

## Panel 1: NJ Overview & Onboarding Tracker

**Current status: Mostly built — 4 sub-features missing**

| Field | Value |
|---|---|
| **Purpose** | Real-time onboarding status of every NJ. Phase tracking, huddle logs, DSR compliance, task progress. |
| **Primary Users** | Admin, Manager |
| **Data Source** | Turso internal tables + RMS API for NJ profile data |
| **Refresh Rate** | Every 5 minutes |

### 4.1.1 What Is Built
- KPI cards: Active CSMs (46), Developed (25, 61%), Not Developed (16), STP WIP (5).
- Upcoming Joinings section (synced from Outlook — content needs verification).
- NJ list with filter tabs: All / Active / STP WIP / Developed / Not Developed / Inactive.
- Search by name, Emp ID, manager. Manager dropdown filter.
- NJ side drawer: Emp ID, Manager, Location, Department, DOJ, status badges.
- DSR History modal: per-NJ daily report submission compliance (Submitted/Missed/Pending per working day).
- Huddle Log: date-wise, status (Done), conducted by (HR email).
- Export PDF button.

### 4.1.2 What Needs to Be Built (Phase 2)
- **Day-wise task tracker** — Checklist of STP-assigned tasks per day (Days 1–14). Green = completed, Amber = pending, Red = overdue. Displayed within the NJ side drawer or as a separate tab.
- **Phase 1 progress bar** — Visual timeline showing current day (1–14+) with today highlighted. States: Active (Days 1–14), Phase 2 Pending (amber badge "Awaiting Manager Huddle"), Phase 1 Complete (green badge with date).
- **Mark as STP WIP button** — Explicit action button (Admin only) on NJ cards and list rows to assign/remove WIP status, with confirmation modal and note field.
- **Digital assessment checklist** — Post-training assessment form filled jointly by Manager and Admin. Stored in Turso `assessment_checklists` table. Exportable as PDF and sendable by email.

### 4.1.3 UI States
- Active (Days 1–14): Progress bar with current day.
- Phase 2 Pending: Amber badge "Awaiting Manager Huddle".
- Phase 1 Complete: Green badge with date.
- STP WIP: Grey badge "STP WIP — Not Yet Started".

---

## Panel 2: Qubits Score Monitor

**Current status: Exists in sidebar — not reviewed (no screenshot provided)**

| Field | Value |
|---|---|
| **Purpose** | Real-time daily Qubits scores with threshold-based colour coding and trend lines. |
| **Primary Users** | Admin, Manager |
| **Data Source** | RMS API — Qubits endpoint → Turso `qubit_scores` |
| **Refresh Rate** | Every 15 minutes (configurable) |

### 4.2.1 Score Thresholds

| Score Range | Category | Display |
|---|---|---|
| Below 50 | Below Average | Red badge + red row. Alert raised. |
| 50–70 | Average (Minimum Acceptable) | Amber badge + yellow row. |
| Above 70 | Above Average | Green badge + green row. |

### 4.2.2 Required Components
- Daily score table: NJ name, date, score, category, delta from previous day.
- 7-day rolling trend line chart per NJ.
- Alert feed: NJs who scored below 50 in the last 3 days.
- Recording completion badge.
- Send Qubits Report button (Phase 2 addition).

> **Action needed:** Share screenshot of current Qubits panel to assess actual build status.

---

## Panel 3 + 5: ROI & Leads Panel (Combined)

**Current status: Partially built — TAT, funnel, heatmap, self-gen leads, email missing**

| Field | Value |
|---|---|
| **Purpose** | Track ROI performance week-wise and daily lead allocation/TAT per NJ. |
| **Primary Users** | Admin, Manager |
| **Data Source** | RMS API — Lead/TAT + ROI endpoints → Turso `leads`, `roi_records` |
| **Refresh Rate** | Leads: every 30 min. ROI: weekly (Monday 06:00 IST). |

### 4.3.1 What Is Built
- ROI KPI cards: Total Positive (20), Positive ≤4mo (2), Negative ≤4mo (15), Negative >4mo (5).
- Total Leads Allocated KPI (1,361).
- CSM ROI Breakdown table: DOJ, Tenure, Leads, Registrations, Conv. Rate, ROI, Status.
- Date range filter, manager filter, name search.

### 4.3.2 What Needs to Be Built (Phase 2)
- **ROI Week-wise heatmap** — Grid (NJ rows × Week columns) with Red/Black/Yellow cell fills per STP colour coding. Consecutive red weeks counter. 4-month milestone progress bar.

### 4.3.3 ROI Colour Coding (per STP document)

| Colour | Meaning | Behaviour |
|---|---|---|
| RED 🔴 | Negative NR | Red cell, alert icon, counted in Not Developed tally |
| BLACK ⚫ | Neutral | Light grey cell, watching status |
| YELLOW 🟡 | Positive ROI within 4 months | Yellow-green cell, Developed indicator |

---

## Panel 4: NRD Panel — Net Revenue Tracking

**Current status: Core grid built — trend chart, India/Overseas split, alerts, email missing**

| Field | Value |
|---|---|
| **Purpose** | Month-wise NR per NJ with Performing/Non-Performing classification and trend. |
| **Primary Users** | Admin, Manager, Viewer |
| **Data Source** | RMS API — NR/NRD endpoint → Turso `nr_records` |
| **Refresh Rate** | Daily sync at 01:00 IST. Manual refresh available. |

### 4.4.1 What Is Built
- 4 KPI cards: Currently Positive (14), Currently Negative (30), Positive within 4mo (4), Negative after 4mo (13).
- Monthly NR Grid: NJ rows × month columns, scrollable, colour-coded cells. 44 of 46 CSMs have NR data.
- Manager filter, name search, Export PDF.

### 4.4.2 What Needs to Be Built (Phase 2)
- **NR Trend chart** — Per-NJ line chart showing month-by-month NR movement. Accessible from NJ drill-down or as a toggle on the grid.
- **NR Fluctuation alert** — Flag when an NJ's NR alternates between positive and negative for 2+ consecutive months. Show in alert feed.

### 4.4.3 NR Classification Logic

| NR Status | Indicator | Description |
|---|---|---|
| NR Positive | Performing ✅ | Green row |
| NR Negative | Non-Performing ❌ | Red row. PA/PIP flags evaluated. |

---

## Panel 6: RCB — Regular Corporate Business

**Current status: KPI cards and summary table built — claim status and revenue attribution missing**

| Field | Value |
|---|---|
| **Purpose** | Track all corporate accounts claimed by each NJ. |
| **Primary Users** | Admin, Manager |
| **Data Source** | RMS API — RCB endpoint → Turso `rcb_claims` |
| **Refresh Rate** | Every 60 minutes |

### 4.6.1 What Is Built
- 3 KPI cards: CSMs with claims (38), Total claimed corporates (727), Total NR from corporates (₹4,83,14,396.69).
- CSM Corporate Breakdown table: Tenure, Claimed Corporates, NR from Corporates.
- Date range filter, manager filter, search.

### 4.6.2 What Needs to Be Built (Phase 2)
- No additional features required for this panel at this time.

---

## Panel 7: NJ Performance Status

**Current status: Charts and table built — milestone timeline, alert centre, email missing**

| Field | Value |
|---|---|
| **Purpose** | Automated evaluation of Developed/Not Developed status with PA/PIP/Exit alerts. |
| **Primary Users** | Admin, Manager |
| **Data Source** | Turso (computed from NRD, ROI, Leads sync) |
| **Refresh Rate** | Recalculated after every NRD/ROI sync |

### 4.7.1 What Is Built
- 4 KPI cards: Developed (20), Not Developed (23), Under Observation (18), PA/PIP Suggested (5).
- Development Distribution donut chart.
- Status by Tenure Group bar chart (0–2mo, 2–4mo, 4+mo).
- NR Status Breakdown bar chart.
- Suggested Actions bar chart (On Track / Under Obs / PA/PIP / Pending).
- Manager-wise Performance bar chart (Developed vs Not Developed per manager).
- CSM Performance Breakdown table: Name, Tenure, NR Status, ROI Status, Status, Suggested Action.

### 4.7.2 What Needs to Be Built (Phase 2)
- **Per-NJ Milestone Timeline** — Visual timeline showing Month 1–6 per NJ with current position and upcoming trigger dates highlighted. Accessible from NJ Performance row drill-down.
- **Alert Centre** — Dedicated section listing all pending PA/PIP/Exit alerts requiring Admin action. Each alert shows: NJ name, alert type, creation date, acknowledgement status.
- **Acknowledgement workflow** — Admin must click "Acknowledge" on each PA/PIP/Exit alert. Timestamped, stored in Turso `audit_logs`. Cannot be skipped once alert is raised.
- **Send Performance Notice button** — Dispatches PA/PIP/Exit notice email from dashboard via Resend.
- **Auto-schedule milestone meetings** — On PA/PIP/Exit trigger, auto-create calendar invite (Google/MS Calendar).

### 4.7.3 Categorisation Logic

| Category | Criteria | Action |
|---|---|---|
| Developed | NR Positive AND ROI Positive | Green badge. Moved to Developed list. |
| Not Developed | Both NR and ROI negative, or NR fluctuating | Red badge. PA/PIP timeline started. |

### 4.7.4 Tenure Milestone Triggers

| Month | Trigger | Action |
|---|---|---|
| Month 3 | NR and ROI negative | Auto-alert "PA Suggested". Notify Admin + Manager. Auto-schedule PA Review meeting. |
| Month 4 | Still negative | Auto-alert "PIP Suggested". Auto-schedule PIP Review. Dispatch escalation email. |
| Month 5 | Still negative | Auto-alert "Exit Suggested". Auto-schedule Exit Review. Mandatory Admin acknowledgement. |

---

## Panel 8: Masterclasses *(retained — beyond original PRD scope)*

**Current status: Fully built**

| Field | Value |
|---|---|
| **Purpose** | Show upcoming and recent masterclass sessions for CSMs. Live from Koenig API. |
| **Primary Users** | Admin, Manager, NJ |
| **Data Source** | Koenig API (live) |

### 4.8.1 What Is Built
- Upcoming Sessions: Title, Conductor, Date, Time, Duration, Training Type, Audience emails, Join link, countdown badge.
- Last 2 Weeks: Completed sessions list.

### 4.8.2 Potential Enhancements (Phase 3)
- Track per-NJ masterclass attendance.
- Link attendance to STP compliance scoring.
- Send masterclass reminder to NJs 24 hours before session.

---

## Panel 9: FAQ & Documents *(retained — beyond original PRD scope)*

**Current status: Fully built**

| Field | Value |
|---|---|
| **Purpose** | Training resources, policies, and FAQ for CSMs and managers. |
| **Primary Users** | All roles |

### 4.9.1 What Is Built
- Document library (4 docs): Kites G, General Policy, Training Plan, SOS. Category tags. View links.
- FAQ section (7 items).
- Add Document button (Admin only).

---

## 5. Turso Database Schema

### 5.1 Core Tables

| Table | Key Fields |
|---|---|
| `new_joiners` | id, name, join_date, manager_id, current_phase, stp_status (`STP_WIP`/`STP_ACTIVE`/`DEVELOPED`/`ON_PA`/`ON_PIP`/`EXITED`), tenure_months, is_active, stp_wip_marked_at, stp_wip_marked_by, stp_wip_note |
| `qubit_scores` | id, nj_id, date, score, category, recordings_completed |
| `leads` | id, nj_id, lead_id, allocated_date, last_action_date, status, tat_hours, tat_breached, is_self_gen |
| `nr_records` | id, nj_id, month, year, nr_value, is_positive, source |
| `roi_records` | id, nj_id, week_start, roi_value, color_code |
| `rcb_claims` | id, nj_id, corporate_name, claim_date, status, revenue_linked |
| `performance_alerts` | id, nj_id, alert_type (PA/PIP/EXIT), triggered_at, acknowledged_at, acknowledged_by |
| `huddle_logs` | id, nj_id, date, type, conducted_by, completed |
| `assessment_checklists` | id, nj_id, filled_by, filled_at, manager_notes, hr_notes, outcome |
| `stp_progress` | id, nj_id, stp_day, current_phase, last_activity_at, notes |
| `meeting_logs` | id, nj_id, meeting_type, scheduled_at, meeting_link, status, calendar_event_id, attendees |
| `reminder_logs` | id, nj_id, recipient_email, reminder_type, sent_at, status |
| `daily_reports` | id, nj_id, report_date, qubit_score, leads_actioned, huddle_completed, tasks_completed, tasks_pending, dsr_submitted, alerts_triggered, report_json |
| `email_logs` | id, nj_id, sent_by, recipients, template, subject, sent_at, status, error_message |
| `users` | id, name, email, role, team_id |
| `sync_logs` | id, module, last_sync_at, status, error_message |
| `audit_logs` | id, user_id, action, entity_type, entity_id, old_value, new_value, timestamp |

### 5.2 Vercel Cron Jobs

| Job | Schedule | Action |
|---|---|---|
| `sync-qubit-scores` | Every 15 min | Poll RMS Qubits → upsert `qubit_scores` |
| `sync-leads` | Every 30 min | Poll RMS Leads/TAT → upsert `leads` |
| `sync-nr-data` | Daily 01:00 IST | Poll RMS NRD → upsert `nr_records` |
| `sync-roi-data` | Monday 06:00 IST | Poll RMS ROI → upsert `roi_records` |
| `sync-rcb-data` | Every 60 min | Poll RMS RCB → upsert `rcb_claims` |
| `evaluate-milestones` | Daily 02:00 IST | Check tenure triggers → create `performance_alerts`, schedule meetings |
| `evaluate-categories` | After every NRD/ROI sync | Recompute NJ category |
| `send-daily-reminders` | Daily 09:00 IST | Generate reminder emails → Resend |
| `generate-daily-reports` | Daily 18:00 IST | Compile end-of-day report per active NJ → `daily_reports` |

---

## 6. RMS API Integration

*(Placeholder — to be completed once API docs confirmed)*

| Module | Endpoint (TBC) | Method | Key Fields (TBC) |
|---|---|---|---|
| Qubits | [TBC] /api/qubits | GET | nj_id, date, score, recordings_done |
| Leads | [TBC] /api/leads | GET | nj_id, date, leads_allocated, tat_hours, is_breached, is_self_gen |
| NR/NRD | [TBC] /api/nr | GET | nj_id, month, year, nr_value, source |
| ROI | [TBC] /api/roi | GET | nj_id, week_start, roi_value, color_code |
| RCB | [TBC] /api/rcb | GET | nj_id, corporate_name, claim_date, status |
| NJ Profiles | [TBC] /api/nj/list | GET | nj_id, name, join_date, manager_id, status |

---

## 7. Frontend Component Map

| Component | Status | Description |
|---|---|---|
| `AppShell` | ✅ Built | Sidebar, topbar, content, notification bell, user avatar |
| `Sidebar` | ✅ Built | Collapsible, 9 panels, role-based, active state |
| `TopBar` | ✅ Built | User, sync status, date, refresh button |
| `SyncStatusBar` | ✅ Built | Footer: last sync per module (currently stale — fix urgent) |
| `TargetAchievementPanel` | ✅ Built | Q1 progress, KPI cards, CSM breakdown table |
| `NJOverviewPanel` | ✅ Built | KPI cards, list, filter tabs, search, side drawer |
| `DSRHistoryModal` | ✅ Built | Per-NJ daily report compliance |
| `HuddleLog` | ✅ Built | Per-NJ date-stamped huddle entries |
| `NRDPanel` | ✅ Built | KPI cards, monthly grid, export |
| `ROILeadsPanel` | ✅ Built | ROI KPIs, leads allocated, breakdown table, date filter |
| `RCBPanel` | ✅ Built | KPI cards, corporate breakdown table |
| `PerformancePanel` | ✅ Built | KPI cards, 5 charts, CSM breakdown table |
| `MasterclassesPanel` | ✅ Built | Upcoming + recent sessions |
| `FAQDocumentsPanel` | ✅ Built | Document library + FAQ |
| `QubitsPanel` | 🔶 Partial | UI built, awaiting live RMS Qubits API |
| `STPTrackerPanel` | ❌ Missing | New: Active NJ board, STP WIP action, meeting triggers, reminders, daily reports |
| `STPWIPButton` | ❌ Missing | Reusable "Mark as STP WIP" action button with confirm modal |
| `MeetingScheduler` | ❌ Missing | Manual + auto meeting scheduling modal, Calendar API |
| `ReminderManager` | ❌ Missing | View/resend reminder history (Admin) |
| `DailyReportViewer` | ❌ Missing | View/export daily reports per NJ per date |
| `EmailComposer` | ❌ Missing | Compose modal: template, recipients, attach report, schedule |
| `TATStatusTable` | ~~Removed~~ | Not required |
| `PipelineFunnelChart` | ~~Removed~~ | Not required |
| `ROIHeatmap` | ❌ Missing | Week-wise Red/Black/Yellow heatmap grid |
| `NRTrendChart` | ❌ Missing | Per-NJ month-by-month line chart |
| `MilestoneTimeline` | ❌ Missing | Per-NJ Month 1–6 visual timeline |
| `AlertCentre` | ❌ Missing | PA/PIP/Exit alert list with acknowledgement workflow |
| `AssessmentForm` | ❌ Missing | Digital post-training checklist |
| `DayTaskTracker` | ❌ Missing | Days 1–14 checklist per NJ |

---

## 8. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Performance | Initial load < 2 seconds. Panel render < 500ms. |
| Availability | 99.9% uptime via Vercel + Turso. RMS failures degrade gracefully — show last-known data + stale warning. |
| Security | RMS token and Turso auth token in Vercel env secrets only. HTTPS enforced. JWT sessions expire after 8 hours. |
| Role Isolation | Managers see only their team. Enforced server-side in API route middleware. |
| Audit Trail | All admin actions stored with userId + timestamp in `audit_logs`. |
| Email Security | All emails from server-side only. Rate-limited. Recipient validation enforced. |
| Responsiveness | 1280px+ desktop and 768px+ tablet. Mobile = read-only simplified view. |
| Accessibility | WCAG 2.1 AA. All colour-coded indicators include text label fallbacks. |
| Error Handling | All sync failures logged in `sync_logs`. SyncStatusBar shows red indicator. Frontend always shows last-cached data or skeleton. |

---

## 9. Deployment & DevOps

### 9.1 Vercel Configuration
- Framework: Next.js 14 (App Router) + React 18.
- Environments: `production` (main), `staging` (develop), `preview` (per PR).
- Env Variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `RMS_API_BASE_URL`, `RMS_API_TOKEN`, `RESEND_API_KEY`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `NEXTAUTH_SECRET`.
- Vercel Cron Jobs defined in `vercel.json`.

### 9.2 Turso Configuration
- Edge SQLite via `@libsql/client` in server-only API routes.
- Local dev: `turso dev` + `.env.local`.
- Migrations in `/db/migrations/` — run on deploy.
- Recommended region: Singapore (closest to India).

### 9.3 Email (Resend)
- Sending domain verified (e.g. `notifications@stp.koenig-solutions.com`).
- All emails from Next.js API routes only.
- Templates as React Email components in `/emails/`.
- Types: Daily Reminder, Daily Report, ROI Summary, PA Notice, PIP Notice, Exit Notice, Custom.

- Calendar: **Google Calendar API** — OAuth2 credentials confirmed and provided. Auto-trigger meeting invites configured for PA/PIP/Exit milestone reviews and Phase 1 manager huddle.
- Email: **Resend** — sending domain confirmed and API key provided. All transactional emails (reminders, reports, PA/PIP/Exit notices) will route through Resend from server-side API routes only.

### 9.5 Repository Structure

| Path | Contents |
|---|---|
| `/app` | Next.js App Router pages and layouts |
| `/app/api` | API routes: RMS sync, Turso queries, email dispatch, calendar |
| `/components` | All React panel and UI components |
| `/db` | Turso schema SQL, migrations, libSQL client setup |
| `/emails` | React Email templates (Resend) |
| `/lib` | Utilities, constants, type definitions, auth config |
| `/styles` | Tailwind config and global CSS |
| `vercel.json` | Cron job definitions |
| `/.env.local` | Local dev vars (gitignored) |

---

## 10. Immediate Action Items (Before Phase 2 Build)

These must be resolved first — they affect everything else.

| Priority | Action | Owner |
|---|---|---|
| 🔴 P0 | **Fix RMS sync pipeline** — All 5 modules are 978h stale (~40 days). Debug Vercel Cron Jobs for all sync actions. Check token expiry, endpoint availability, error logs in `sync_logs`. RMS API docs and credentials have been provided to the dev team. | Dev |
| 🟡 P2 | Begin Phase 2 build once RMS sync is confirmed live | Dev |

---

## 11. Phase 2 Development Milestones

*(Starts after P0 sync fix is resolved)*

| Milestone | Deliverable | Est. Duration |
|---|---|---|
| M0 | Fix RMS sync + verify all 5 modules returning live data | 1–3 days |
| M1 | STP Tracker Panel (Panel 0) — Active NJ board, STP WIP action button, meeting triggers, daily reminders, daily report generation, email composer | 6–8 days |
| M2 | NJ Overview — Day-wise task tracker (Days 1–14), Phase 1 progress bar, digital assessment checklist | 4–5 days |
| M3 | ROI & Leads — TAT table, pipeline funnel, ROI heatmap, self-gen leads, Send Report button | 5–7 days |
| M4 | NRD — NR trend chart, India/Overseas split, fluctuation alert, Send Report button | 3–4 days |
| M5 | Performance — Milestone timeline, Alert Centre + acknowledgement, Send Notice button, auto meeting scheduling | 4–5 days |
| M6 | RCB — Claim status breakdown, revenue attribution | 2–3 days |
| M7 | Email + Calendar integration — Resend setup, all email templates, Google/MS Calendar OAuth | 3–4 days |
| M8 | Qubits panel verification + any fixes | 1–2 days |
| M9 | UAT with Samridhi and managers on staging | 3–5 days |
| M10 | Production deployment + go-live | 1 day |

**Total Phase 2 estimate: 32–46 working days from M0 (RMS sync fix).**

---

## 12. Information Required to Proceed

### 12.1 Immediate (Blockers)
- RMS API base URL and all 5 endpoint paths
- Current Bearer Token (or how to regenerate — is it expired?)
- Error logs from the last failed sync attempt (check Vercel logs or `sync_logs` table)

### 12.2 Phase 2 Setup — Confirmed
- **PA/PIP/Exit email recipients** — Configurable per NJ. Recipients pulled dynamically from RMS API (who is added on PA/PIP for that NJ). API to be provided by Samridhi. ✅
- **Daily reminder recipients** — Managers, Admins, and NJs all receive reminders. Additionally, an **Open/Custom recipient** option is available on each reminder so Admin can add any additional email address at the time of sending. ✅

### 12.3 Business Logic — Confirmed
- **PA/PIP recipient API** — endpoint to be provided by Samridhi once this PRD is handed to the dev team for implementation. Will be used to pre-fill recipients on PA/PIP/Exit notice emails. ✅
- **STP WIP status** — purely a dashboard-side flag. Not stored in or synced to RMS. ✅
- **Meeting attendees** — New Joiner + Admin on all auto-triggered meeting invites. ✅

---

## 13. How to Use This PRD for Further Development

When you want to build or enhance the dashboard, here is exactly how to work with a developer or with Claude (via Claude Code or this chat interface).

### 13.1 Handing the PRD to a Developer

Share this full PRD document along with:
- Access to the GitHub/GitLab repository
- Vercel project access (for environment variables and cron job config)
- Turso database credentials
- RMS API base URL + Bearer Token
- Resend API key
- Google Calendar OAuth2 credentials
- PA/PIP recipient API endpoint (when available)

The developer can then work milestone by milestone as defined in Section 11. Each milestone is self-contained and can be built and tested independently.

### 13.2 Using Claude to Build or Enhance Features

Claude works best when given focused, specific tasks rather than the entire PRD at once. The recommended workflow is:

**Step 1 — Share context.** Paste this PRD (or the relevant section) into the conversation, along with the specific files from the codebase that are relevant to what you want to build. For example, if adding the Email Composer, share the existing panel component files and the current API route structure.

**Step 2 — Give a focused instruction.** Reference the PRD section directly. For example: *"Build the EmailComposer component as described in Section 4.0.1-F of the PRD. The To field should be pre-filled from the RMS PA/PIP API for notices, and have an open field for reminders and reports."*

**Step 3 — Use Claude Code for multi-file changes.** For features that touch multiple files (e.g. a new panel + its API route + a new Turso table + a Vercel cron job), use Claude Code (the CLI tool) with the repo open. Claude Code can read existing files, understand the current structure, and make precise changes across all affected files in one go. This is faster and more accurate than pasting files manually.

**Step 4 — Update the PRD after each build.** Once a feature is built and confirmed working, update the relevant panel's "What Is Built" section and change the component map status from ❌ Missing to ✅ Built. This keeps the PRD as a living document that always reflects the true current state of the dashboard.

### 13.3 What to Include When Asking Claude to Build Something

For best results, always provide:
- The relevant PRD section (copy-paste the specific panel or feature spec)
- The existing component or file you want to modify or build alongside
- The Turso table schema for any new data the feature needs
- Any API response samples (e.g. what the RMS endpoint returns)
- A clear statement of what "done" looks like (e.g. "the button should appear on each NJ card, open a modal, and write to the `stp_status` field in Turso")

### 13.4 Keeping the PRD Current

Treat this PRD as a living document. Update it whenever:
- A feature is built and confirmed working → move it from Missing to Built
- A stakeholder changes a requirement → update the relevant spec section
- A new feature idea comes up → add it to the relevant panel's Phase 2 or Phase 3 section
- An API endpoint is confirmed → fill in the TBC placeholders in Section 6

The more accurately this PRD reflects the real state of the dashboard, the more useful it is — both for developers building the next feature and for Claude when generating or modifying code.
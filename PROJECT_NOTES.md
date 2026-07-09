# Monrad Earthworx H&S App — Project Notes

Last updated: July 2026

Field-worker health & safety app for Monrad Earthworx. Staff complete site safety forms, timesheets, and action tracking on mobile devices. Data is saved locally first, then synced to Supabase when signed in.

---

## 1. Project overview

**Purpose:** Replace paper H&S checklists with a mobile-friendly PWA — job starts, machine pre-starts, toolbox meetings, incidents, timesheets, action register, and admin reporting.

**Tech stack:**

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 8 |
| Styling | Single global stylesheet (`src/App.css`) with CSS custom properties |
| Auth & cloud DB | Supabase (`@supabase/supabase-js`) — email/password only |
| Offline / install | PWA via `vite-plugin-pwa` + Workbox (production builds only) |
| Persistence | Browser `localStorage` (primary on device) + Supabase (cloud sync) |

**Run locally:**

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
npm run preview
```

**Environment:** Copy Supabase credentials into `.env.local` (gitignored). See [Supabase](#6-supabase) below.

**App version:** `0.1` (`APP_VERSION` in `src/constants/index.js`, shown in footer).

---

## 2. App structure

```
practice/
├── index.html                 # PWA meta tags, manifest link
├── vite.config.js             # React plugin + VitePWA (dev SW disabled)
├── public/
│   ├── manifest.webmanifest   # PWA manifest (name, icons, theme)
│   ├── favicon.svg
│   └── …                      # icons, logos (monrad-icon-*.png, etc.)
└── src/
    ├── main.jsx               # React mount + registerSW()
    ├── App.jsx                # Auth gate, view routing, cloud state, footer
    ├── App.css                # All global / component styles + design tokens
    ├── pages/                 # One file per screen (see Features)
    ├── components/            # Shared UI (forms, print, badges, logo, …)
    ├── constants/
    │   ├── index.js           # Checklists, dashboard cards, labels, APP_VERSION
    │   └── storageKeys.js     # localStorage key names
    ├── hooks/
    │   ├── useHighlightRecord.js
    │   └── useHighlightAction.js
    └── utils/
        ├── supabaseClient.js  # Supabase client + isSupabaseConfigured
        ├── backup.js          # Export / restore local data
        ├── safetyAlerts.js    # Alert counts and filtering
        ├── adminReports.js    # Admin report dataset / filters
        ├── recordsDashboard.js
        ├── recordsDashboardCloud.js
        ├── export.js          # JSON / text download helpers
        ├── image.js           # Photo compression (base64 JPEG)
        └── storage/
            ├── recordsStorage.js      # localStorage: all form records
            ├── actionsStorage.js      # localStorage: action register
            ├── settingsStorage.js     # localStorage: operators / machines / sites
            ├── userProfileStorage.js  # Supabase user_profiles
            ├── cloudSyncStatus.js     # Sync status labels + helpers
            ├── *CloudStorage.js       # Per-form Supabase save/fetch/merge
            └── actionCloudStorage.js
```

### Routing

No React Router. `App.jsx` holds `currentView` state and conditionally renders pages. Navigation uses `handleNavigate(viewId, options)` with optional `highlightRecordId`, `highlightActionId`, `actionFilter`, and `recordFocus` for deep links from Safety Alerts and Records Dashboard.

### Key files

| File | Role |
|------|------|
| `src/App.jsx` | Session, profile loading, access gating, cloud record state, view switch |
| `src/constants/index.js` | `DASHBOARD_GROUPS`, `DASHBOARD_CARDS`, `FORM_TYPES`, checklists |
| `src/constants/storageKeys.js` | Exact `localStorage` key strings |
| `src/utils/supabaseClient.js` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `src/pages/Dashboard.jsx` | Home screen; filters `adminOnly` cards by role |

---

## 3. Features completed

### Dashboard (`Dashboard.jsx`)

Grouped cards (see `DASHBOARD_GROUPS`):

1. **Site Safety** — Job Start, Machine Pre-Start, Toolbox Meeting, Incident / Near Miss
2. **Records & Actions** — Action Register, Safety Alerts, Records
3. **Timesheets** — Timesheet, Weekly Summary
4. **Setup & Backup** — Settings, Staff Management *(admin)*, Admin Reports *(admin)*, Backup / Restore, Help / App Setup

Footer on all main views: signed-in email, role badge, status badge, Sign Out, app version.

### Site safety forms

All forms share the same UX pattern: fields + checklist progress, validation, signature confirmation, photo upload (max 3, compressed JPEG ~800px), saved records list, print + JSON/text export, cloud sync badge when logged in.

| Page | File | Checklist items |
|------|------|-----------------|
| Job Start | `JobStartView.jsx` | 7 |
| Machine Pre-Start | `PreStartView.jsx` | 12 (+ defect reporting) |
| Toolbox Meeting | `ToolboxView.jsx` | 8 |
| Incident / Near Miss | `IncidentView.jsx` | 8 (+ report types) |

**Pre-Start defects:** Optional defect fields; critical / not-safe warnings; auto-creates Action Register entry on submit.

**Incident / Toolbox:** Auto-create actions from corrective action / controls agreed on submit only (not when loading cloud records).

### Timesheets

| Page | File |
|------|------|
| Daily timesheet | `TimesheetView.jsx` |
| Weekly summary | `WeeklyTimesheetSummaryView.jsx` |

Weekly summary merges local + cloud timesheets; printable summary via `WeeklyPrintSummary.jsx`.

### Records & actions

| Page | File | Notes |
|------|------|-------|
| Action Register | `ActionRegisterView.jsx` | Manual + auto-created actions; filters; print/export; cloud sync on create/update |
| Safety Alerts | `SafetyAlertsView.jsx` | Open/overdue/critical actions, unresolved defects, unresolved incident actions; clickable rows navigate with highlight/filter |
| Records Dashboard | `RecordsDashboardView.jsx` | Search + filter across all record types; merges local + cloud; stats; cloud/local badges |

### Setup & admin

| Page | File | Access |
|------|------|--------|
| Settings | `SettingsView.jsx` | Operators, machines, sites lists (local only) |
| Backup / Restore | `BackupRestoreView.jsx` | JSON export/import of all localStorage data |
| Help / App Setup | `HelpAppSetupView.jsx` | PWA install guides, usage, admin checklist |
| Staff Management | `StaffManagementView.jsx` | **Admin only** — approve/disable staff, edit role/name/phone/notes |
| Admin Reports | `AdminReportsView.jsx` | **Admin only** — filter cloud records, summary stats, print report |

### Authentication & access control

| Screen | File |
|--------|------|
| Sign in / Sign up | `AuthView.jsx` |
| Pending / Disabled | `AccessBlockedView.jsx` |

**Flow:** Supabase session → load or create `user_profiles` row → gate app access:

- **Admin** (`role = 'admin'`): always allowed (even if status is not `active`)
- **Staff** + `status = 'active'`: full app access
- **Staff** + `status = 'pending'`: blocked — “Account pending approval…”
- **Staff** + `status = 'disabled'`: blocked — “Account disabled…”

New profiles auto-created on first login: `role = 'staff'`, `status = 'pending'`.

### Cloud sync (dual save)

When a logged-in user submits or updates cloud-backed data:

1. **Always** write to `localStorage` first
2. **Then** attempt Supabase insert/update if online and configured
3. Show sync badge: `Saved to cloud` / `Saved locally only — cloud save failed` / `Offline/local save only`
4. On page open, fetch cloud rows, merge with local (dedupe by `id`, `cloudId`, and form-specific keys)

Cloud-backed entities: all five form types, action register, user profiles.

**Settings** and **backup data** remain local only. Backup does not include cloud rows.

### Print / export

- Records: `PrintableRecord.jsx`, `window.print()` + `@media print` in `App.css`
- Actions: `PrintableAction.jsx`
- Admin reports: `AdminReportPrint.jsx`
- Export: `src/utils/export.js` — per-record JSON/txt download; backup JSON via `backup.js`

### PWA

- Manifest: `public/manifest.webmanifest` (`short_name`: “Monrad H&S”, `theme_color`: `#c41e3a`)
- Service worker registered in `main.jsx` via `virtual:pwa-register`
- Production build generates `sw.js` + Workbox precache
- Help page documents iPhone (Safari → Add to Home Screen) and Android install steps

### Legacy / unused

- `src/pages/ComingSoonView.jsx` — no longer referenced; all dashboard cards are live

---

## 4. Important design decisions

### Dual save (localStorage + Supabase)

- **Why:** Field workers must complete forms offline or with poor signal; cloud gives admin visibility and cross-device backup for signed-in users.
- **Trade-off:** Same record may exist locally and in cloud; merge logic prefers cloud metadata when deduping. Old local-only records are **not** auto-migrated to Supabase.
- **No `service_role` key** in the client — only the publishable (anon) key; all access enforced by RLS.

### Access control model

- Auth: Supabase email/password
- Authorization: `user_profiles.role` + `user_profiles.status`
- Admin capabilities gated in UI (`adminOnly: true` on dashboard cards) **and** should be enforced in Supabase RLS
- Client-side admin fetch skips `user_id` filter when `isAdminProfile(profile)` — **RLS must allow admins to read all rows**

### localStorage keys (exact names)

Defined in `src/constants/storageKeys.js`:

| Key | Contents |
|-----|----------|
| `monrad-earthworx-job-records` | **All** form records (job-start, pre-start, toolbox, incident, timesheet) in one JSON array |
| `monrad-earthworx-actions` | Action Register items |
| `monrad-earthworx-settings` | `{ operators, machines, sites }` |

Backup file format: `monrad-earthworx-backup-YYYY-MM-DD.json` (`BACKUP_VERSION: 1`).

**Do not rename these keys** — backup/restore and existing user data depend on them.

### Admin-only dashboard cards

In `DASHBOARD_CARDS` (`adminOnly: true`):

- `staff-management` — Staff Management
- `admin-reports` — Admin Reports

`Dashboard.jsx` hides these unless `isAdminProfile(profile)`. Direct navigation to those views shows “Access denied — admin only.” for staff.

### PWA setup

`vite.config.js`:

- `registerType: 'autoUpdate'`
- `manifest: false` — uses standalone `public/manifest.webmanifest`
- `devOptions: { enabled: false }` — **no service worker in dev** (avoids Workbox dev error)
- `workbox.globPatterns` includes js, css, html, svg, png, jpg, jpeg, webp, ico

### UI design tokens (`App.css` `:root`)

Recent polish pass standardised spacing and surfaces:

- **Brand:** `--monrad-red` (#c41e3a), dark/light variants
- **Neutrals:** `--color-black`, grey scale, white
- **Semantic:** `--color-success-*`, `--color-warning-*`
- **Layout:** `--spacing-xs` … `--spacing-2xl`, `--card-radius`, `--card-shadow`, `--tap-min` (44px)
- Monrad red reserved for primary actions, warnings, and key highlights

### Photos

- Max `MAX_PHOTOS = 3` per record (`storageKeys.js`)
- Compressed to base64 JPEG in `utils/image.js` and stored inside the record in localStorage / `record_data` JSON in Supabase
- Large photo volume can pressure `localStorage` quota

### Action auto-create rules (`actionsStorage.js`)

| Source | Trigger |
|--------|---------|
| Pre-Start | Defects found on submit |
| Incident | Corrective action required on submit |
| Toolbox | Controls agreed (or hazards discussed) on submit |

`syncActionsFromRecord` in `App.jsx` also pushes new auto-actions to cloud.

---

## 5. Supabase

### Environment variables

In `.env.local` (never commit):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-or-publishable-key>
```

Read in `src/utils/supabaseClient.js`. If either is missing, `isSupabaseConfigured` is false and the auth screen shows a configuration error — **the main app is not reachable without Supabase config**.

### Tables

All record tables follow a similar pattern: `id`, `user_id`, `record_data` (full JSON blob), typed columns for querying, `created_at`, `updated_at`.

| Table | Module | Notes |
|-------|--------|-------|
| `user_profiles` | `userProfileStorage.js` | `id` = auth user UUID; `role`, `status`, `phone`, `notes` |
| `timesheet_records` | `timesheetCloudStorage.js` | `employee_name`, `job_name`, hours columns, … |
| `job_start_records` | `jobStartCloudStorage.js` | Checklist boolean columns + `record_data` |
| `machine_prestart_records` | `preStartCloudStorage.js` | Defect / machine_safe columns |
| `toolbox_meeting_records` | `toolboxCloudStorage.js` | Meeting fields + checklist_completed |
| `incident_near_miss_records` | `incidentCloudStorage.js` | Incident fields + checklist_completed |
| `action_register_records` | `actionCloudStorage.js` | Supports insert + update; `source_type`, `status`, `priority`, … |

Form cloud modules generally **insert** on new save; actions also **update** on edit/complete.

### RLS notes

**RLS policies are not in this repo** — they must be created in the Supabase SQL editor. The app assumes:

1. **Authenticated users** can `INSERT` rows with `user_id = auth.uid()`
2. **Staff** can `SELECT` (and typically `UPDATE`) their own rows (`user_id = auth.uid()`)
3. **Admins** can `SELECT` all rows (and `UPDATE` where needed) when `user_profiles.role = 'admin'` for `auth.uid()`
4. **`user_profiles`:** users can read/insert own row; admins can read/update all profiles (required for Staff Management)
5. New signups: `INSERT` own profile with `status = 'pending'`

**Caveat from development:** Sample SQL for action-register admin policies once referenced `public.profiles` — the app uses **`public.user_profiles`**. Any hand-written policies must use the correct table name.

**Testing without RLS:** Cloud save/fetch will fail or return empty; sync badges will show local-only / failed states.

### Admin cloud reads

`fetch*Records(userId, { isAdmin })` omits the `user_id` filter when `isAdmin` is true. Correct admin behaviour depends entirely on Supabase RLS allowing broader `SELECT`.

---

## 6. Known issues

| Issue | Detail |
|-------|--------|
| **PWA disabled in dev** | `devOptions.enabled: false` in `vite.config.js`. Installability and service worker only apply to `npm run build` + static hosting. Intentional fix for dev error: “Couldn't find configuration for either precaching or runtime caching.” |
| **Vite chunk size warning** | Production build bundles `@supabase/supabase-js` into a large JS chunk; Vite may warn that some chunks exceed 500 kB. Cosmetic build warning only — app works. Code-splitting or `manualChunks` could reduce it later. |
| **Supabase required for app access** | Without env vars, users see auth config error and cannot reach forms. There is no offline-anonymous mode. |
| **RLS / tables manual setup** | All cloud tables and policies must exist in Supabase before cloud sync works. Misconfigured RLS shows as empty cloud data or failed sync badges. |
| **Pending signup default** | New users get `status = 'pending'` and cannot use the app until an admin sets `active` in Staff Management. |
| **Backup is local only** | Restore does not pull from Supabase; cloud data must be re-fetched after sign-in. |
| **No local → cloud migration** | Historical local-only records stay local until the user re-submits or a future migration is built. |
| **localStorage size** | Photos as base64 in `monrad-earthworx-job-records` can hit browser storage limits on photo-heavy incidents. |
| **Staff Management** | No user delete; admin cannot demote themselves via UI safeguards. |
| **Shell / CI verification** | Some automated `npm run build` / `npm run dev` runs in agent sessions returned unknown exit status; verify builds locally after changes. |

---

## 7. Next steps

### Deployment

- [ ] Deploy `dist/` to static host (Vercel, Netlify, Cloudflare Pages, etc.)
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in host environment
- [ ] Confirm HTTPS (required for PWA install and service worker)
- [ ] Smoke-test PWA install on iPhone Safari and Android Chrome

### Supabase hardening

- [ ] Document and apply final RLS policies for all 7 tables (staff own-row + admin read-all)
- [ ] Verify admin policies reference `user_profiles`, not `profiles`
- [ ] Seed at least one admin user (`role = 'admin'`, `status = 'active'`)
- [ ] Enable / configure email confirmation policy to match signup UX in `AuthView`
- [ ] Optional: database triggers for `updated_at`

### Testing

- [ ] End-to-end: sign up → pending → admin approve → submit each form → verify cloud row + sync badge
- [ ] Offline submit → local save + offline badge → back online → retry cloud save
- [ ] Admin: Staff Management, Admin Reports, Records Dashboard (all users’ records)
- [ ] Staff: only own cloud records visible
- [ ] Backup export → clear storage → restore → data intact
- [ ] Print/export on each form type and action register
- [ ] Safety Alerts navigation + highlight to correct record/action
- [ ] Mobile layout ~390px width, no horizontal scroll

### Future enhancements (not started)

- [ ] Code-split Supabase / large routes to silence chunk warning
- [ ] Optional one-way or selective local → cloud migration tool
- [ ] Cloud photo storage (Supabase Storage) instead of base64 in JSON
- [ ] User delete / invite flow in Staff Management
- [ ] `.env.example` committed to repo (without secrets)
- [ ] Automated tests (storage merge, safety alert counts, backup validate)

---

## Quick reference: npm scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server port 5173 (no PWA SW) |
| `npm run build` | Production build + PWA assets → `dist/` |
| `npm run preview` | Serve production build locally |

## Quick reference: dashboard view IDs

`job-start` · `pre-start` · `toolbox` · `incident` · `action-register` · `safety-alerts` · `records-dashboard` · `timesheet` · `weekly-timesheet-summary` · `settings` · `staff-management` · `admin-reports` · `backup-restore` · `help-app-setup`

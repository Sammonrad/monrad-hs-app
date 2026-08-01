# Monrad H&S — Production Readiness Audit

**Project:** `D:\Cursor\practice`  
**Date:** 1 August 2026  
**Scope:** Non-destructive code audit after recent auth, archive, deletion, time-picker, and print-layout work.  
**Constraints honored:** No application code changes, no schema changes, no migrations applied, no records deleted, no UI redesign.

**Cross-references:** `ARCHIVE_DELETE_PLAN.md`, `ARCHIVE_RECORDS_FRONTEND_AUDIT.md`, `MOBILE_UI_AUDIT.md`, migrations under `supabase/migrations/`.

---

## Evidence legend

| Tag | Meaning |
|-----|---------|
| **Build** | Verified by `npm run build` in this session |
| **Code** | Inferred from current source |
| **Migration (repo)** | Present in `supabase/migrations/` — **not confirmed applied** to live Supabase |
| **Live needed** | Requires signed-in admin/staff session and/or Supabase Dashboard verification |
| **Not live-tested** | Browser/auth not exercised in this audit (no credentials / no authenticated session) |

---

## Build result

```
Command: Set-Location D:\Cursor\practice; npm run build
Exit code: 0
Tooling: vite v8.1.3, PWA v1.3.0
Duration: ~528ms transform; ~14s wall clock
```

| Check | Result |
|-------|--------|
| Production build | **PASS** (**Build**) |
| PWA service worker generation | **PASS** — `dist/sw.js`, `dist/workbox-*.js`, 20 precache entries (**Build**) |
| Chunk size warning | **WARN** — main JS ~920 kB / ~226 kB gzip (>500 kB advisory) (**Build**) |

---

## 1. Passed checks

### Authentication and access — **Code**

| Check | Evidence |
|-------|----------|
| Session bootstrap + auth listener | `App.jsx` — `getSession` / `onAuthStateChange` |
| Auth UI | `AuthView.jsx` — sign-in / sign-up; warns never to use service-role key |
| Profile gate | `userProfileStorage.js` — pending/disabled blocked; admins always allowed |
| Access blocked UX | `AccessBlockedView.jsx` + `App.jsx` pending/disabled/profile-error branches |
| Post-login dashboard reset | `App.jsx` — `prevShowMainAppRef` + `resetAppNavigationState()` when `showMainApp` flips true; also resets on sign-out |
| Admin-only nav | `navigation.js` — `archived-records`, `admin-reports`, `staff-management` have `adminOnly: true`; filtered via `getVisibleNavItems` |
| Archived Records view gate | `App.jsx` redirects non-admins; `ArchivedRecordsView.jsx` also shows access denied |
| Staff Management / Admin Reports self-gate | Both views return “Access denied — admin only” |

### Cloud save payloads (no wrong `user_id`) — **Code**

| Module | Insert ownership | Verdict |
|--------|------------------|---------|
| `generalMeetingCloudStorage.js` | `created_by` via DB; **no `user_id` in payload or fetch filter** | Pass |
| `visitorSignInCloudStorage.js` | `signed_in_by`; **no `user_id`** | Pass |
| `equipmentCloudStorage.js` | `created_by` on insert; **no `user_id`** | Pass |
| Form / action / SSSP / timesheet modules | `user_id` only where tables have that column | Pass |

### Honest cloud sync messaging — **Code**

- `formatCloudSaveError` / `SYNC_STATUS` / `NOT_SIGNED_IN_CLOUD_MESSAGE` in `cloudSyncStatus.js`
- Used on GM, visitor, equipment, SSSP, archive actions
- Archive path: cloud update must succeed before local patch for cloud-backed rows (`archiveActions.js`)

### Archive frontend architecture — **Code**

| Piece | Status |
|-------|--------|
| Shared filter | `archiveFilter.js` — `isArchived`, `filterArchived`, `withPreservedArchived` |
| Shared actions | `archiveActions.js` — archive / restore / permanent delete |
| Admin UI control | `AdminArchiveAction.jsx` + `ArchiveRecordModal.jsx` |
| Archived list | `ArchivedRecordsView.jsx` — all major types + `includeArchived: true` fetches |
| Permanent delete UX | `PermanentDeleteModal.jsx` — typed `DELETE` confirmation |
| Protected types | `canPermanentlyDelete` blocks incident, visitor, SSSP, equipment; GM only if `status === 'draft'` |
| SSSP hazard sync | `syncHazards` is **non-destructive** (soft-archive orphans; no `.delete()` on hazards) — improves on older plan note |

### Local/cloud merge — **Code** (partial)

- Default fetches/merges exclude archived (`includeArchived: false`)
- Actions + visitors: `withPreservedArchived` in `App.jsx` / `ActionRegisterView.jsx`
- Form views keep archived flags on local `savedRecords` and filter them from lists
- Equipment merged with `includeArchived: true` so Equipment “Archived” filter still works

### Time fields — **Code**

- `TimePicker12Hour.jsx` + `time12Hour.js` (`to24Hour` / `from24Hour` / legacy-safe display)
- Wired via `TimeField` into Timesheet, Incident, General Meeting, Equipment forms
- Timesheet labour calc still uses 24h `HH:mm` via `time.js` (`calculateLabourHours`) — compatible with picker storage format
- Display/print uses `formatTime12Hour`

### Printing — **Code**

- `WeeklyPrintSummary.jsx` + `@media print` weekly rules in `App.css`
- `.no-print` hides chrome/forms; `.print-area` isolation via `body:has(.print-area)`
- General Meeting: `PrintableGeneralMeeting.jsx` + local print mount in `GeneralMeetingView.jsx`
- Timesheet + Weekly Summary mount their own `.print-area` with `WeeklyPrintSummary`

### Mobile / PWA — **Code** + **Build**

- `--tap-min: 44px` widely applied; Archived Records action buttons use tap-min
- Global `overflow-x: hidden` on `html`/`body`/.`app` **removed** vs older `MOBILE_UI_AUDIT.md` (now `max-width: 100%`) — improvement
- Vite PWA: `vite.config.js` + `registerSW` in `main.jsx`; build emits SW (**Build**)
- `public/manifest.webmanifest` present

### Code quality greps — **Code**

| Check | Result |
|-------|--------|
| `user_id` on GM / visitor / equipment inserts | **Not present** |
| Service-role key in frontend client | **Not used** — `supabaseClient.js` uses `VITE_SUPABASE_PUBLISHABLE_KEY` only |
| Hard-delete API surface | Concentrated in `archiveActions.permanentlyDeleteArchivedRecord` + gated types |
| Duplicate archive “systems” | Single path via `archiveActions` / `AdminArchiveAction` (SSSP dashboard uses same `archiveRecord`) |
| Old GM hard-delete client API | No `deleteGeneralMeetingRecord` usage found; UI uses archive |

---

## 2. Failed checks / gaps

### F1 — Admin UPDATE policies for form/action archive missing from migrations — **Critical** · **Migration (repo)** / **Live needed**

`ARCHIVE_DELETE_PLAN.md` required admin `UPDATE` (via `is_admin()`) so admins can set `archived` on **other users’** rows.

**Repo state:**

- Columns: `20260726042430_add_archive_fields_to_records.sql`
- Policy harden (drop staff DELETE, tighten SSSP/equipment): `20260726000936_…`
- Admin DELETE for archived rows: `20260801155300_archived_records_admin_delete.sql`
- **No migration** adds `Admins can update …` for `job_start_records`, `machine_prestart_records`, `toolbox_meeting_records`, `incident_near_miss_records`, `timesheet_records`, or `action_register_records`

**Impact (if live matches dump + these migrations):** Admins can archive/restore **own** form/action rows; archiving **staff** rows will fail RLS. Permanent delete of others’ archived rows also cannot be reached if archive never succeeds.

**Must verify live:** Supabase → Policies for those tables.

### F2 — Archive/delete migrations not verified applied — **Critical** · **Live needed**

Frontend assumes `archived` boolean (and controlled DELETE policies). If `20260726042430` / `20260801155300` / hardening SQL are not applied:

- Archive updates fail (missing column or RLS)
- Permanent delete may fail or (worse) behave under older broad DELETE policies if hardening not applied

### F3 — `permanentlyDeleteArchivedRecord` / `restoreArchivedRecord` lack admin profile checks — **High** · **Code**

- `archiveRecord` correctly requires `isAdminProfile(profile)`
- `restoreArchivedRecord` and `permanentlyDeleteArchivedRecord` do **not** check admin profile (UI + RLS are the only gates)
- If DELETE policies are not live, or an older broad DELETE remains, client defense is weaker than archive path

### F4 — Visitor `archived` not covered by field-protection trigger — **High** · **Migration (repo)** / **Live needed**

`protect_visitor_sign_in_fields` (migration `20260725222050_…`) blocks staff edits to named columns but **does not mention `archived`**. UI hides archive for non-admins, but a crafted authenticated UPDATE could flip `archived` if UPDATE policies allow it.

### F5 — Equipment cloud save `console.log` noise (incl. user email) — **Medium** · **Code**

`equipmentCloudStorage.js` logs auth user id/email and insert/update results on every equipment cloud write. Ships in production bundles unless tree-shaken (these are unconditional `console.log`s). Privacy / console clutter risk.

### F6 — Restore path can mark local restored when cloud fails — **Medium** · **Code**

Several branches in `restoreArchivedRecord` patch local storage then return `{ localOnly: true, error }` on cloud failure — can desync device vs Supabase until next reload.

### F7 — Form `savedRecords` lack `withPreservedArchived` persist merge — **Low–Medium** · **Code**

Actions/visitors preserve archived locals on cloud merge. Form modules rely on local patches + display filtering. Less robust if a future path persists an active-only merge over `savedRecords` (clear-all / selective clears already wipe device data intentionally).

### F8 — Staff Management / Admin Reports not redirected at App shell — **Low** · **Code**

Only `archived-records` is force-redirected in `App.jsx`. Other admin views self-deny. Acceptable but inconsistent.

### F9 — Large JS bundle — **Low** · **Build**

Single ~920 kB chunk; advisory only for field/mobile load time.

---

## 3. Risks

| Priority | Risk | Evidence |
|----------|------|----------|
| **Critical** | Archive/delete feature incomplete in DB vs frontend | F1, F2; plan Phase 3 RLS still missing admin UPDATE |
| **Critical** | Live schema/policy drift vs git migrations | Documented in `ARCHIVE_DELETE_PLAN.md`; SSSP dump vs client still a known drift area |
| **High** | Permanent delete / restore callable without client-side admin check | F3 |
| **High** | Visitor archive column bypass via API if trigger not updated | F4 |
| **High** | If hardening migration **not** applied, old “Admins can delete general meetings” (and SSSP/equipment ALL) may still allow broad hard delete | Initial schema + `20260726000936` drop; **Live needed** |
| **Medium** | Equipment debug logs leak identity in browser console | F5 |
| **Medium** | Local/cloud desync on failed restore | F6 |
| **Medium** | Mobile equipment tables still wide / hard to use | Prior `MOBILE_UI_AUDIT.md` C1 — not re-probed live this session |
| **Low** | Bundle size / PWA cache of large shell | Build warning |
| **Low** | DEV-only Supabase URL `console.log` in `supabaseClient.js` | Acceptable (DEV gated) |

---

## 4. Exact files involved

### Auth / access
- `src/App.jsx`
- `src/pages/AuthView.jsx`
- `src/pages/AccessBlockedView.jsx`
- `src/utils/storage/userProfileStorage.js`
- `src/constants/navigation.js`
- `src/utils/supabaseClient.js`

### Cloud storage
- `src/utils/storage/*CloudStorage.js` (all modules under `src/utils/storage/`)
- `src/utils/storage/cloudSyncStatus.js`
- `src/utils/recordsDashboardCloud.js`

### Archive lifecycle
- `src/utils/storage/archiveActions.js`
- `src/utils/storage/archiveFilter.js`
- `src/components/AdminArchiveAction.jsx`
- `src/components/ArchiveRecordModal.jsx`
- `src/components/PermanentDeleteModal.jsx`
- `src/pages/ArchivedRecordsView.jsx`

### Time / print
- `src/components/TimePicker12Hour.jsx`
- `src/utils/time12Hour.js`
- `src/utils/time.js`
- `src/components/FormFields.jsx`
- `src/pages/TimesheetView.jsx`
- `src/components/WeeklyPrintSummary.jsx`
- `src/pages/WeeklyTimesheetSummaryView.jsx`
- `src/components/generalMeeting/PrintableGeneralMeeting.jsx`
- `src/App.css` (print + weekly-print + tap-min + archived-records)

### Mobile / PWA
- `src/App.css`
- `vite.config.js`
- `src/main.jsx`
- `public/manifest.webmanifest`

### Migrations (repo only)
- `supabase/migrations/20260711034414_initial_remote_schema.sql`
- `supabase/migrations/20260725212809_tighten_security_definer_functions.sql`
- `supabase/migrations/20260725220321_protect_user_profile_roles.sql`
- `supabase/migrations/20260725222050_tighten_visitor_sign_in_policies.sql`
- `supabase/migrations/20260726000936_archive_delete_policy_hardening.sql`
- `supabase/migrations/20260726042430_add_archive_fields_to_records.sql`
- `supabase/migrations/20260801155300_archived_records_admin_delete.sql`

### Planning docs
- `ARCHIVE_DELETE_PLAN.md`
- `ARCHIVE_RECORDS_FRONTEND_AUDIT.md`
- `MOBILE_UI_AUDIT.md`

---

## 5. Priority summary

| Priority | Items |
|----------|--------|
| **Critical** | F1 missing admin UPDATE for form/action archive; F2 migrations not verified on live |
| **High** | F3 client admin checks on restore/delete; F4 visitor trigger vs `archived`; verify hardening dropped broad DELETE |
| **Medium** | F5 equipment `console.log`; F6 restore desync; residual mobile table usability |
| **Low** | F7/F8 consistency; F9 bundle size |

---

## 6. Recommended fix order

1. **Verify live Supabase** (no code): confirm `archived` columns; list RLS on form/action/visitor/GM/SSSP/equipment; confirm `is_admin()`; confirm hardening + admin DELETE migrations applied. (**Live needed**)
2. **Add admin UPDATE policies** for form + action tables (and confirm visitor admin archive path + trigger includes `archived`). Migration design only when ready — not done in this audit.
3. **Smoke-test archive/restore/permanent delete** as admin on own + staff rows; confirm protected types never offer delete. (**Live needed**)
4. **Harden client guards:** `isAdminProfile` on restore + permanent delete; keep typed `DELETE` modal.
5. **Remove equipment production `console.log`s** (and any other leftover debug).
6. **Align restore error handling** with archive (do not patch local as restored if cloud fails).
7. **Optional:** App-shell redirects for all `adminOnly` views; code-split large bundle; revisit equipment mobile tables from `MOBILE_UI_AUDIT.md`.

---

## 7. What was / was not verified

### Verified this session
- Full production **build** success + PWA emit (**Build**)
- Thorough **code** inspection of auth, cloud payloads, archive lifecycle, merge helpers, time picker, print CSS, PWA wiring, greps for `user_id` / service-role / hard-delete / console noise
- Cross-check against archive planning docs and migration files in repo

### Not verified (needs live environment)
- Sign-in, pending/disabled UX, admin role flip
- Actual Supabase insert/update/archive/delete under RLS
- Whether migrations above are applied on production
- Print output on real printers / mobile Safari
- PWA install / offline behaviour on device
- Authenticated mobile layout (prior mobile audit covered login only)

---

## 8. Overall readiness verdict

**Frontend archive/auth/time/print work is largely coherent and build-clean**, with correct “no `user_id`” handling for GM/visitor/equipment and a single archive/delete UX path.

**Not production-ready for full archive/delete of multi-user records** until live DB confirms:

1. archive columns exist,  
2. admin UPDATE policies exist for form/action tables,  
3. hardening + controlled DELETE policies are applied, and  
4. admin smoke tests pass.

Treat this as **code-ready, DB/RLS-gated**.

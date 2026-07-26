# Archived Records — Frontend Loading Audit

**Project:** Monrad H&S (`D:\Cursor\practice`)  
**Date:** 26 July 2026  
**Scope:** Read-only architecture audit of frontend record loading for future Archived Records work.  
**Constraints honored:** No application code changes, no schema/migrations, no archive UI buttons added.  
**Cross-reference:** `ARCHIVE_DELETE_PLAN.md` (known archive fields, RLS gaps, phased plan).

---

## 1. Executive answers (requirements)

### 1.1 Every Supabase query that loads records (`.from(...).select`)

| Table | Function / call site | Select shape | Scope filter today |
|-------|----------------------|--------------|--------------------|
| `job_start_records` | `fetchJobStartRecords` | `select('*')` | Staff: `.eq('user_id')`. Admin: **all users** |
| `machine_prestart_records` | `fetchPreStartRecords` | `select('*')` | Same admin/staff pattern |
| `toolbox_meeting_records` | `fetchToolboxRecords` | `select('*')` | Same |
| `incident_near_miss_records` | `fetchIncidentRecords` | `select('*')` | Same |
| `timesheet_records` | `fetchTimesheetRecords` | `select('*')` | Same |
| `action_register_records` | `fetchActionRecords` | `select('*')` | Same |
| `visitor_sign_in_records` | `fetchVisitorSignInRecords` | `select('*')` | **No `user_id` filter** (all visible via RLS) |
| `sssp_records` | `fetchSsspRecords` | `select('*')` | Staff: `.in('status', SSSP_STAFF_VISIBLE_STATUSES)`. Admin: **all statuses** |
| `sssp_hazards` | `fetchHazardsForSsspIds` | `select('*')` | By parent `sssp_id` list |
| `sssp_acknowledgements` | `fetchAcknowledgementsForSsspIds` | `select('*')` | By parent `sssp_id` list |
| `sssp_acknowledgements` | ack lookup by user (editor flow) | `select('*')` | `.eq('user_id')` |
| `sssp_records` | `checkSsspNumberUnique` | `select('id')` | By `sssp_number` |
| `hs_general_meeting_records` | `fetchGeneralMeetingRecords` | `select('*')` | Staff: `.eq('user_id')`. Admin: **all users** |
| `machine_equipment` | `fetchEquipmentRecords` | `select('*')` | **No `user_id` / no archived filter** |
| `machine_equipment` | `checkAssetNumberExists` | `select('id')` | By `asset_number` |
| `machine_service_records` | `fetchServiceRecords` | `select('*')` | All (RLS) |
| `machine_document_records` | `fetchDocumentRecords` | `select('*')` | All (RLS) |
| `machine_defect_records` | `fetchDefectRecords` | `select('*')` | All (RLS) |
| `user_profiles` | `loadOrCreateProfile` / `fetchAllProfiles` | `select('*')` | Profile only — **out of archive scope** |

Insert/update paths also use `.select()` / `.select().single()` after write; those are not list loaders but return the written row (including any archive fields once present).

### 1.2 Which queries currently return archived records (or would, once columns exist)

| Module | Returns archived today? | Notes |
|--------|-------------------------|--------|
| Form tables (job/pre/toolbox/incident/timesheet) | **N/A today** (no column). **Would return all** once `archived` exists | No `.eq('archived', false)` anywhere |
| Action Register | **N/A today**. **Would return all** | Workflow `status` open/completed ≠ archive |
| Visitor | **N/A today**. **Would return all** | No user_id client filter either |
| SSSP parents | **Yes for admins**; **No for staff** | Staff query excludes `archived` via status list. Admin fetch includes `status = 'archived'` |
| SSSP hazards | Soft-archived hazards still loaded | Flag in `hazard_data.archived` (not DB column); UI filters active hazards |
| SSSP acks | No archive concept | Hidden only if parent not fetched / not shown |
| General Meeting | Column exists in schema plan; **client ignores it** | Fetch returns all rows; UI hard-deletes |
| Equipment | **Yes** — cloud returns `archived = true` rows | UI filters default `active` |
| Equipment children (defect/service/document) | **Yes** — all rows for all machines | No parent-archive join filter |

### 1.3 Files that need filtering so normal views exclude archived

**Cloud fetch layer (primary):**

- `src/utils/storage/jobStartCloudStorage.js`
- `src/utils/storage/preStartCloudStorage.js`
- `src/utils/storage/toolboxCloudStorage.js`
- `src/utils/storage/incidentCloudStorage.js`
- `src/utils/storage/timesheetCloudStorage.js`
- `src/utils/storage/actionCloudStorage.js`
- `src/utils/storage/visitorSignInCloudStorage.js`
- `src/utils/storage/generalMeetingCloudStorage.js` (use existing `archived` boolean)
- `src/utils/storage/equipmentCloudStorage.js` (optional query-level; UI already filters)
- `src/utils/storage/ssspCloudStorage.js` (admin default lists; keep include path for Archived tab / Archived Records page)
- Aggregator: `src/utils/recordsDashboardCloud.js` (`fetchAllCloudRecords`)

**App-level cloud state (feeds many views):**

- `src/App.jsx` — central `loadCloud*` effects; admin fetches omit `user_id` and will pull everyone’s archived rows once columns exist

**Views / consumers that must not show archived in “normal” mode:**

- `src/pages/RecordsDashboardView.jsx`
- `src/pages/AdminReportsView.jsx` (decide: exclude archived by default vs include with toggle)
- `src/pages/ActionRegisterView.jsx`
- `src/pages/JobStartView.jsx`, `PreStartView.jsx`, `ToolboxView.jsx`, `TimesheetView.jsx`, `IncidentView.jsx`
- `src/pages/WeeklyTimesheetSummaryView.jsx`
- `src/pages/VisitorSignInView.jsx`
- `src/pages/GeneralMeetingView.jsx`
- `src/pages/EquipmentView.jsx` / `EquipmentProfileView.jsx` (already UI-filtered; confirm defects/services for archived parents)
- `src/pages/SsspDashboardView.jsx` — tab/`filterSsspRecords` mostly OK; **“All plans” / total counts include archived for admins**
- `src/pages/Dashboard.jsx` / `src/pages/SafetyAlertsView.jsx` — actions/defects derived from merged lists (secondary)
- Selectors already filtering equipment: `EquipmentSelector.jsx`, `SsspPlantEquipmentList.jsx`, `equipmentConfig.js`

**Local merge / persistence (critical companion to query filters):**

- `src/utils/storage/recordsStorage.js` + shared `STORAGE_KEY`
- Per-module `merge*` / `getMerged*` functions
- `src/utils/storage/actionsStorage.js`, `visitorSignInStorage.js`, `generalMeetingStorage.js`, equipment local keys

### 1.4 Best place for a shared archive utility/helper

**Recommended:** `src/utils/storage/archiveFilter.js` (alongside cloud storage modules).

Suggested responsibilities:

1. **Canonical “is archived?”** per record type:
   - Form / action / visitor / GM / equipment → `Boolean(record.archived)` (once mapped from DB)
   - SSSP parent → `record.status === 'archived'` (and/or `archivedAt`)
   - SSSP hazard → `Boolean(hazard.archived)` / `hazard_data.archived`
2. **`excludeArchived(records, type)`** / **`filterArchived(records, { includeArchived })`** for post-merge lists
3. **Shared fetch option** convention: `{ includeArchived = false }` passed into every `fetch*Records`, applied as:
   - `.eq('archived', false)` for boolean columns
   - `.neq('status', 'archived')` (or exclude from status `in`) for SSSP
4. Optional thin re-export from `recordsDashboardCloud.js` for dashboard/admin reports batch fetches

Do **not** put this only in page components — App.jsx, Records Dashboard, Admin Reports, and each form view all re-fetch or merge independently.

### 1.5 Best location for admin-only Archived Records page

Aligned with `ARCHIVE_DELETE_PLAN.md`:

1. **`src/constants/navigation.js`**
   - Add `NAV_ITEMS['archived-records']` with `adminOnly: true`
   - Add `'archived-records'` to `DESKTOP_SIDEBAR_GROUPS` → group `records-actions` (beside `records-dashboard` / `action-register` / `admin-reports`)
   - Role filtering already via `getVisibleNavItems` / `getNavGroups`
2. **`src/App.jsx`**
   - Follow `admin-reports` pattern: `currentView === 'archived-records' && <ArchivedRecordsView … />`
   - Gate with `isAdminProfile(profile)` (nav already hides; still guard the view)
3. **New page:** `src/pages/ArchivedRecordsView.jsx` (name flexible)
   - Fetch with `{ includeArchived: true }` + client filter `isArchived`
   - Cover dashboard types **plus** visitor, SSSP, GM, equipment (not only Records Dashboard six)

---

## 2. Files inspected

### Planning / constants

- `ARCHIVE_DELETE_PLAN.md`
- `src/constants/navigation.js`
- `src/constants/storageKeys.js`
- `src/constants/ssspStatuses.js`
- `src/constants/index.js` (APP_STORAGE_KEYS)

### App shell / aggregators

- `src/App.jsx`
- `src/utils/recordsDashboardCloud.js`
- `src/pages/RecordsDashboardView.jsx`
- `src/pages/AdminReportsView.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/SafetyAlertsView.jsx`
- `src/utils/safetyAlerts.js`

### Form / register views

- `src/pages/JobStartView.jsx`
- `src/pages/PreStartView.jsx`
- `src/pages/ToolboxView.jsx`
- `src/pages/TimesheetView.jsx`
- `src/pages/IncidentView.jsx`
- `src/pages/ActionRegisterView.jsx`
- `src/pages/WeeklyTimesheetSummaryView.jsx`
- `src/pages/VisitorSignInView.jsx`
- `src/pages/GeneralMeetingView.jsx`
- `src/pages/EquipmentView.jsx`
- `src/pages/EquipmentProfileView.jsx`
- `src/pages/SsspDashboardView.jsx`
- `src/pages/SsspEditorView.jsx`

### Cloud + local storage (`src/utils/storage/`)

- `recordsStorage.js`, `actionsStorage.js`, `visitorSignInStorage.js`, `generalMeetingStorage.js`
- `jobStartCloudStorage.js`, `preStartCloudStorage.js`, `toolboxCloudStorage.js`, `incidentCloudStorage.js`, `timesheetCloudStorage.js`
- `actionCloudStorage.js`, `visitorSignInCloudStorage.js`
- `ssspCloudStorage.js`, `ssspStorage.js`, `ssspNumbering.js`
- `generalMeetingCloudStorage.js`
- `equipmentCloudStorage.js`, `equipmentServiceCloudStorage.js`, `equipmentDocumentCloudStorage.js`, `equipmentDefectStorage.js`
- `cloudSyncStatus.js`, `userProfileStorage.js` (profiles only)
- Related UI filters: `components/equipment/EquipmentSelector.jsx`, `components/sssp/SsspPlantEquipmentList.jsx`, `components/sssp/RiskRegister.jsx`, `constants/equipmentConfig.js`

---

## 3. Storage architecture snapshot

### Shared form bag vs separate stores

| Store | Key | Contents |
|-------|-----|----------|
| Shared job records | `STORAGE_KEY` = `monrad-earthworx-job-records` via `recordsStorage.js` | Job Start, Pre-Start, Toolbox, Incident, Timesheet — discriminated by `formType` |
| Actions | `ACTIONS_STORAGE_KEY` | Action Register only |
| Visitors | `VISITOR_SIGN_IN_STORAGE_KEY` | Visitor sign-in only |
| General meetings | `GENERAL_MEETING_STORAGE_KEY` | GM only |
| Equipment family | `MACHINE_EQUIPMENT_KEY`, `MACHINE_*_RECORDS_KEY` | Equipment + defects/services/documents |
| SSSP | Cloud-primary; editor draft key `SSSP_EDITOR_DRAFT_KEY` | Not in shared `STORAGE_KEY` |

Cloud modules each expose `fetch*Records` + `merge*` / `getMerged*`. Form pages merge `savedRecords` (shared bag) with module cloud arrays. **Clear-all on Job Start clears entire local `STORAGE_KEY` bag**, not cloud.

### Admin vs staff fetch pattern

For job/pre/toolbox/incident/timesheet/action/GM:

```text
if (!isAdmin) query = query.eq('user_id', userId)
// admin: no user_id filter → all users' rows
```

Visitor and equipment family: no client `user_id` filter (rely on RLS).  
SSSP staff: status allow-list (excludes archived/draft/ready). Admin: all statuses including archived.

**Implication:** Once archive columns exist, **admin App.jsx + Records Dashboard + Admin Reports will load every user’s archived rows** unless fetches default to `archived = false` / status ≠ archived.

### Local merge implication (high risk)

Merge functions **seed from local first**, then overlay cloud. If cloud fetch **omits** archived rows but localStorage still holds a copy (with `cloudId`), that row **reappears as local/both** in normal lists.

Mitigations (for later implementation):

1. Filter **after** merge with `excludeArchived`
2. On archive: patch local copy `archived: true` (or remove from local bag)
3. Prefer cloud archive flag when merging (`...cloudRecord` already wins field overlay when matched)

---

## 4. Current behaviour by module

### 4.1 Records Dashboard

| | |
|--|--|
| **Tables** | Via `fetchAllCloudRecords`: timesheets, job starts, pre-starts, toolbox, incidents, actions |
| **Fetch** | `RecordsDashboardView` → `fetchAllCloudRecords(userId, { isAdmin })` |
| **Local** | Merges with `savedRecords` + `actions` (`mergeAllDashboardRecords` / `mergeDashboardActions`) |
| **Archived filtered today?** | **No** (columns absent for these tables) |
| **What “archived” means** | Future: boolean `archived` per `ARCHIVE_DELETE_PLAN.md` |
| **Admin note** | `isAdmin` true → all users’ rows |

Does **not** include Visitor, SSSP, GM, Equipment.

### 4.2 Action Register (`ActionRegisterView`)

| | |
|--|--|
| **Table** | `action_register_records` |
| **Fetch** | `fetchActionRecords` (page + App.jsx) |
| **Local** | `ACTIONS_STORAGE_KEY` / `getMergedActions` |
| **Archived filtered today?** | **No** |
| **What “archived” means** | Future boolean `archived`. Existing `status` = open / in-progress / completed is **workflow**, not archive |
| **Admin note** | Admin omits `user_id` |

### 4.3 Job Start / Pre-Start / Toolbox / Timesheet / Incident

| | |
|--|--|
| **Tables** | `job_start_records`, `machine_prestart_records`, `toolbox_meeting_records`, `timesheet_records`, `incident_near_miss_records` |
| **Fetch** | Matching `fetch*Records` from App.jsx **and** each view on mount |
| **Local** | Shared `STORAGE_KEY` via `formType` |
| **Archived filtered today?** | **No** |
| **What “archived” means** | Future `archived` boolean (`ARCHIVE_DELETE_PLAN.md`). Incident: archive-only (no routine hard delete) |
| **Admin note** | Admin fetches load **all users** |

Also consumed by Weekly Timesheet Summary (timesheets merge) and Safety Alerts (pre-start defects + actions from local/merged actions — not a separate Supabase list query).

### 4.4 Visitor Sign-In

| | |
|--|--|
| **Table** | `visitor_sign_in_records` |
| **Fetch** | `fetchVisitorSignInRecords` — **no `isAdmin` / no `user_id` client filter** |
| **Local** | `VISITOR_SIGN_IN_STORAGE_KEY` |
| **Archived filtered today?** | **No** (no column) |
| **What “archived” means** | Future `archived` boolean; archive-only (no DELETE policy today) |

### 4.5 Equipment (`EquipmentView`, `EquipmentProfileView`)

| | |
|--|--|
| **Tables** | `machine_equipment` (+ `machine_defect_records`, `machine_service_records`, `machine_document_records`) |
| **Fetch** | `fetchEquipmentRecords` / `fetchDefectRecords` / `fetchServiceRecords` / `fetchDocumentRecords` — **return archived equipment and all children** |
| **Local** | Separate machine_* localStorage keys; App merges into `mergedEquipment` |
| **Archived filtered today?** | **UI only**, not cloud query |
| **What “archived” means** | `machine_equipment.archived` boolean (schema + client). Children have no archive column; history stays with parent |

**UI places that already filter `!archived`:**

- `EquipmentView`: default `filterArchived === 'active'`; dropdowns/forms use `equipment.filter((e) => !e.archived)`; `activeEquipment` memo
- `EquipmentProfileView`: archive/unarchive via patch; forms exclude archived peers
- `EquipmentSelector`, `SsspPlantEquipmentList`, `isEquipmentSelectable` in `equipmentConfig.js`

**Gap:** Cloud still returns archived rows into App state; defects/services/documents for archived assets remain in memory and can surface in plant stats / lists unless views filter by parent.

### 4.6 SSSP (dashboard, editor, cloud storage)

| | |
|--|--|
| **Tables** | `sssp_records`, `sssp_hazards`, `sssp_acknowledgements` |
| **Fetch** | `fetchSsspRecords` (+ nested hazard/ack selects) |
| **Staff filter** | `SSSP_STAFF_VISIBLE_STATUSES` = approved / submitted / closed → **excludes archived** |
| **Admin filter at query** | **None** — archived parents included |
| **UI filter** | `filterSsspRecords` — archived tab = `status === 'archived'`; staff further restricted to approved/submitted/closed |
| **What “archived” means** | Parent: `status = 'archived'` + `archived_at`. Hazards: `hazard_data.archived` (no live DB column per client comments). Acks: no archive; hide with parent |

**Nuances:**

- Default admin tab is `drafts` (archived not shown until Archived tab / All)
- Summary card **“All plans”** uses tab `'all'` → **includes archived** for admins
- `statusSummary.total` = full array length **including archived**
- `countSsspByStatus` (home dashboard card) **skips** archived for “active” counts
- Archive/reactivate already in SSSP dashboard/editor (existing product behaviour)

### 4.7 General Meeting

| | |
|--|--|
| **Table** | `hs_general_meeting_records` |
| **Fetch** | `fetchGeneralMeetingRecords(userId, { isAdmin })` |
| **Local** | `GENERAL_MEETING_STORAGE_KEY` |
| **Archived filtered today?** | **No** — `mapMeetingToRow` **omits** `archived`; `rowToMeeting` does not map it |
| **What “archived” means** | Schema `archived boolean` exists (per plan) but **unused**. UI calls `deleteGeneralMeetingRecord` (hard delete) |

### 4.8 Other loaders (secondary)

| Consumer | Behaviour |
|----------|-----------|
| `AdminReportsView` | `fetchAllCloudRecords(..., { isAdmin: true })` — will include all users’ archived form/action rows once columns exist |
| `Dashboard.jsx` | Uses App cloud state; SSSP counts skip archived; plant overview uses equipment/defects (archived equipment may still affect metrics if not filtered) |
| `SafetyAlertsView` | Uses `savedRecords` + `actions` only; no archive awareness |
| `ssspNumbering.checkSsspNumberUnique` | Selects by number including archived SSSPs (usually desirable to prevent number reuse) |

---

## 5. Inventory: will-return-archived after schema

Once Phase 3 columns exist (plan), **without client filters**:

| Fetch | Admin | Staff |
|-------|-------|-------|
| Form six + actions | All users’ active **and** archived | Own active **and** archived |
| Visitor | All archived+active | Same (no client user filter) |
| GM | All if `archived` unused/unfiltered | Own, unfiltered |
| Equipment | Already returns archived | Same |
| SSSP | Already returns archived | Already excludes archived by status |

---

## 6. Recommended implementation order (frontend-only sequence)

Depends on `ARCHIVE_DELETE_PLAN.md` Phases 0–3 (verify live → policies → wire existing fields → schema). Frontend filter work should land with Phase 4:

1. **Add `archiveFilter.js`** — `isArchived`, `excludeArchived`, shared `{ includeArchived }` contract.
2. **Wire existing archive models first (no new columns):**
   - GM: map `archived`, stop default hard-delete, default fetch `archived = false`
   - Equipment: optional `.eq('archived', false)` on normal fetch; keep `includeArchived` for plant “Archived only” + central page
   - SSSP: treat as mostly done; fix admin “All plans” / totals to exclude archived unless intentional; keep Archived tab + future central page
3. **Form + action + visitor fetches** (after columns): default `.eq('archived', false)`; `includeArchived: true` for Archived Records / restore flows.
4. **Post-merge exclusion** in `getMerged*` or call sites so local stale copies cannot resurrect archived cloud rows.
5. **Propagate through App.jsx cloud state** so every consumer inherits the default.
6. **Records Dashboard + Admin Reports** — exclude archived by default; optional admin toggle later.
7. **New `archived-records` nav item + `ArchivedRecordsView` + App.jsx branch** (`adminOnly`, `records-actions` group).
8. **Follow-ups:** action↔source cascade rule; hide children of archived equipment in alerts/stats; SSSP `syncHazards` audit issue (plan Phase 5).

---

## 7. Risks

| Risk | Detail |
|------|--------|
| **Local merge resurrection** | Filtering only at Supabase leave localStorage copies visible after archive |
| **Dual fetch paths** | App.jsx **and** each page re-fetch — both must use the same `includeArchived` default |
| **Admin unscoped selects** | Admins already load all users’ rows; archive without filter pollutes Dashboard, Reports, form history for all staff data |
| **SSSP “All plans”** | Admin tab `all` currently includes archived; totals inflate |
| **Equipment dual behaviour** | UI filters `!archived` but cloud/App state still holds archived + all children — stats/alerts may disagree with table default |
| **Hazard soft-archive vs DB** | Archived hazards live in JSON; sync can drop them from DB (known plan risk) — not solved by parent list filter alone |
| **Action `status` confusion** | Do not reuse open/completed as archive; separate boolean required |
| **GM unused column** | Easy to assume filtering works; today delete removes row entirely |
| **Visitor no DELETE** | Archive flag is the only cleanup path once added — must filter or history grows forever in UI |
| **Number uniqueness** | Keep uniqueness checks seeing archived SSSPs/equipment so codes are not reused accidentally |
| **Safety Alerts / Dashboard** | Derived from unfiltered merges; archived sources can keep “open” noise unless filtered |

---

## 8. Quick reference — filter needed?

| Module | Cloud query filter today | UI filter today | Need change for normal views? |
|--------|--------------------------|-----------------|-------------------------------|
| Job/Pre/Toolbox/Incident/Timesheet | None | None | **Yes** (after column) |
| Action Register | None | status filters only | **Yes** (after column) |
| Visitor | None | None | **Yes** (after column) |
| General Meeting | None | None | **Yes** (wire existing column) |
| Equipment | None | Yes (`active` default) | Query-level recommended; UI OK |
| SSSP | Staff yes / Admin no | Tabbed; Archived tab | Tighten admin “all”/totals; keep archived fetch for admin tabs/page |
| Records Dashboard / Admin Reports | None | None | **Yes** |
| App.jsx cloud bootstrap | Per module above | N/A | **Yes** (central) |

---

## 9. Nav / App pattern (for later implementation)

```text
navigation.js
  NAV_ITEMS['archived-records'] = { adminOnly: true, pageTitle: 'Archived Records', ... }
  DESKTOP_SIDEBAR_GROUPS[records-actions].itemIds += 'archived-records'

App.jsx
  {currentView === 'archived-records' && (
    <ArchivedRecordsView ... />  // mirror admin-reports gating
  )}
```

`getNavGroups(isAdmin)` already drops `adminOnly` items for non-admins.

---

*End of audit. No application code was modified; this file is the durable planning artifact.*

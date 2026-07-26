# Archive / Delete Implementation Plan (First Pass)

**Project:** Monrad H&S (`D:\Cursor\practice`)  
**Date:** 26 July 2026  
**Scope:** Planning only — no application code, migrations, or database changes were made in this pass.

---

## 1. Executive summary

Most operational form tables (`job_start_records`, `machine_prestart_records`, `toolbox_meeting_records`, `incident_near_miss_records`, `timesheet_records`, `action_register_records`) have **no archive column** and **no admin UPDATE/DELETE policies** for other users’ rows — only owner UPDATE/DELETE plus admin SELECT. Archive/delete therefore cannot be rolled out for those types without schema + RLS work.

Equipment and SSSP already soft-archive in the app (`machine_equipment.archived`; SSSP `status = 'archived'` + `archived_at`). H&S General Meetings have an unused `archived` column but the UI hard-deletes via an admin DELETE policy. Prefer **archive by default**, permanent delete only from an admin **Archived Records** page with typed `DELETE` confirmation, and **archive-only** (no routine hard delete) for incidents, completed/submitted SSSPs, acknowledgements, completed meetings, visitor history, and resolved critical defects.

**Evidence caveat:** Prefer the Supabase migration dump + client mapping over older prose in `PROJECT_NOTES.md`. `PROJECT_NOTES.md` still says RLS is “not in this repo,” but policies **are** present in `supabase/migrations/`. Live dashboard may still differ — every policy claim below is tagged by source.

---

## 2. Evidence sources (how to read the table)

| Tag | Meaning |
|-----|---------|
| **Schema (migration)** | Column/FK from `supabase/migrations/20260711034414_initial_remote_schema.sql` |
| **Policies (migration)** | RLS from that dump + later migrations under `supabase/migrations/` |
| **Client** | Inferred from `src/utils/storage/*CloudStorage.js` and related pages |
| **PROJECT_NOTES** | Documented sample SQL / intent in `PROJECT_NOTES.md` (may diverge from dump/client) |
| **Must verify** | Confirm in Supabase Dashboard (Table Editor + Authentication → Policies); do not assume dump = live |

**Known schema drift (must verify live before migrating):**

- **SSSP:** Client + `PROJECT_NOTES` expect snake_case status values (`draft`, `archived`, …), columns like `project`, `archived_at`, `revision`, and `sssp_hazards.archived`. The initial dump has a different shape (`project_name`, boolean `archived`, status check **without** `'archived'`, hazards without `archived`). The running app maps `archived_at` / `status = 'archived'` — **live DB almost certainly matches client, not the older dump shape**.
- **General meetings:** Client writes `user_id` + slim typed columns; dump has `created_by` / richer columns including unused `archived`.
- **`PROJECT_NOTES` RLS section** is partially outdated relative to the migration dump.

Helper to standardize on: **`public.is_admin()`** (present in dump; tightened in `20260725212809_tighten_security_definer_functions.sql`). Prefer this over `PROJECT_NOTES`’s sample `is_admin_user()`.

---

## 3. Comparison table (all record types)

| Table name | Record type | Existing archive field | Existing admin UPDATE policy | Existing admin DELETE policy | Recommended behaviour | Migration required |
|------------|-------------|------------------------|------------------------------|------------------------------|-----------------------|--------------------|
| `job_start_records` | Job Start | **None** (schema migration; client insert-only) | **No** admin update-all — only own-row UPDATE (**policies migration**) | **No** admin delete-all — only own-row DELETE (**policies migration**) | **Archive + delete** (mistakes / test data); archive default; hard delete only from Archived Records | **Yes** — `archived` (or `is_archived`) + optional `archived_at`/`archived_by`; admin UPDATE + admin DELETE via `is_admin()`; tighten staff DELETE |
| `machine_prestart_records` | Machine Pre-Start | **None** | Same as Job Start | Same as Job Start | **Archive + delete** | **Yes** — same pattern |
| `toolbox_meeting_records` | Toolbox | **None** | Same as Job Start | Same as Job Start | **Archive + delete** | **Yes** — same pattern |
| `incident_near_miss_records` | Incident / Near Miss | **None** | Same as Job Start | Same as Job Start | **Archive only** (compliance history) | **Yes** — archive column + admin UPDATE; **no** routine admin DELETE (or omit DELETE policy) |
| `timesheet_records` | Timesheets | **None** | Same as Job Start | Same as Job Start | **Archive + delete** (payroll mistakes rare; still gated) | **Yes** — same as Job Start |
| `action_register_records` | Action Register | **None** (has workflow `status` open/completed — not archive) | Admin SELECT all; UPDATE **own only** (**policies migration**). Client `updateActionRecord` updates by id — **cross-user admin edits may already fail** unless live has extra policies (**must verify**) | Own-row DELETE only; no admin delete-all | **Archive + delete** for cancelled/noise; keep `status` for open/completed | **Yes** — archive column + admin UPDATE (+ DELETE if hard-delete allowed); verify live admin update of others’ actions |
| `hs_general_meeting_records` | H&S General Meeting | **`archived boolean`** exists (**schema migration**) but **unused in client** (`mapMeetingToRow` omits it; UI hard-deletes) | **Yes** — `Admins can update general meetings` (**policies migration**) | **Yes** — `Admins can delete general meetings` (**policies migration**). Client: `deleteGeneralMeetingRecord` | **Archive + delete** for drafts; **archive only** for **completed** meetings | **Partial** — schema column exists (**No** new archive column if live matches dump); **Yes** policies/UI: wire `archived`, restrict DELETE for completed, stop routine hard delete |
| `visitor_sign_in_records` | Visitor Sign-In | **None** | Active users UPDATE (sign-out); admins can full-correct via trigger + `is_admin()` (`20260725222050_…`) — **not** a dedicated “admin update all” named policy | **None** (no DELETE policy in dump or visitor tighten migration) | **Archive only** (visitor history) | **Yes** — archive column + admin UPDATE for archive flag; keep **no** (or never grant) DELETE |
| `sssp_records` | SSSP (parent) | **Client / PROJECT_NOTES:** `status = 'archived'` + `archived_at`. **Dump:** boolean `archived`, status check lacks `'archived'`. **Must verify** live | **Yes** — dump: `Admins can manage SSSPs` (ALL). PROJECT_NOTES sample: admin UPDATE, **no DELETE** | **Dump: Yes** (ALL includes DELETE). **PROJECT_NOTES intent: No delete**. Client: archive/reactivate only, no delete API | **Archive only** for submitted/completed/closed; draft may allow archive + rare delete | **Verify first.** Prefer **No** new column if live already has `status`/`archived_at`. **Yes** policy tighten: remove or narrow DELETE for non-draft; use `is_admin()` consistently |
| `sssp_hazards` | SSSP hazards | **Client / PROJECT_NOTES:** `archived boolean` (+ in `hazard_data`). **Dump:** no `archived` column. Soft-archive in Risk Register UI | Admin manage ALL (**policies migration**) | Admin DELETE yes (ALL). Client `syncHazards` **deletes all rows then reinserts non-archived** — archived hazards are dropped from DB on save (**client risk**) | Soft-archive with parent; **do not** permanently erase history casually; fix sync later to retain archived rows | **Verify** column exists live. Prefer **No** if live matches PROJECT_NOTES; **Yes** if dump-shaped. Later: change sync to update-in-place |
| `sssp_acknowledgements` | SSSP acknowledgements | **None** (immutable acknowledgement rows) | Admin manage ALL (**policies migration**); staff INSERT own | Admin DELETE via ALL (**policies migration**) | **Archive only / never delete** (audit) — hide via parent SSSP archive | **No** archive column needed if parent archive hides them. **Yes** policy: revoke DELETE (or never call delete from client) |
| `machine_equipment` | Machine equipment (parent) | **`archived boolean`** (**schema + client**); UI archive/unarchive on profile | Admin manage ALL | Admin DELETE via ALL — **client does not delete**, only sets `archived` | **Archive parent**; do **not** erase historical children | **No** archive column. **Yes** optional policy: remove equipment DELETE or restrict heavily |
| `machine_defect_records` | Equipment defects | **None** (workflow `status`: Open → Resolved; severity includes Critical) | Admin manage ALL | Admin DELETE via ALL; FK `machine_id` **ON DELETE CASCADE** | Keep with parent; **archive-only** for **resolved Critical**; no routine wipe | **No** new column by default (parent archive + status). Optional later: `archived` if hiding without parent archive. **Tighten** DELETE policy |
| `machine_service_records` | Equipment service history | **None** | Admin manage ALL | Admin DELETE via ALL; **ON DELETE CASCADE** from equipment | Keep with parent; no routine delete | **No** archive column; **tighten** DELETE |
| `machine_document_records` | Equipment documents | **None** | Admin manage ALL | Admin DELETE via ALL; **ON DELETE CASCADE** | Keep with parent; no routine delete | **No** archive column; **tighten** DELETE |
| *(derived)* Safety Alerts | Not a table | N/A | N/A | N/A | Out of scope for archive table; filters open actions / defects | **No** |
| *(local only)* `monrad-earthworx-job-records` etc. | Device cache | N/A | N/A | Clear-all on some form pages (e.g. Job Start) is **localStorage only** | Keep local clear separate from cloud archive; never treat as cloud delete | **No** DB |

### Records Dashboard coverage note

`RecordsDashboardView` / `getRecordsDashboardStats` currently surfaces: **Job Start, Pre-Start, Toolbox, Incident, Timesheet, Action Register**.  
Visitor, SSSP, General Meetings, and Equipment are **separate nav destinations**, not dashboard sections — but should still follow the same admin archive rules and appear on a future **Archived Records** admin page.

**Nav placement (do not implement yet):** add admin-only `archived-records` under `DESKTOP_SIDEBAR_GROUPS` → `records-actions` (beside `records-dashboard` / `action-register`) in `src/constants/navigation.js`.

---

## 4. Tables that need migration — Yes / No detail

### Yes — need schema and/or policy work

| Table | What |
|-------|------|
| `job_start_records` | Add `archived boolean NOT NULL DEFAULT false` (optional `archived_at timestamptz`, `archived_by uuid`). Policies: `UPDATE`/`DELETE` for `public.is_admin()`; consider dropping or narrowing **Users can delete their own…** so archive/delete is admin-only. |
| `machine_prestart_records` | Same |
| `toolbox_meeting_records` | Same |
| `incident_near_miss_records` | Archive column + admin `UPDATE` only (**no** admin DELETE if archive-only). |
| `timesheet_records` | Same as Job Start (archive + gated delete). |
| `action_register_records` | Archive column + admin `UPDATE` (and DELETE if allowed). **Must verify** whether admins can already update others’ rows live. |
| `visitor_sign_in_records` | Archive column + ensure admin can set it (UPDATE already possible for admins via trigger exemption). **Do not** add DELETE policy. |
| `hs_general_meeting_records` | Prefer **use existing `archived`** if present live. Policy/UI: archive instead of delete for completed; optional DELETE only for draft/archived with typed confirm. |
| `sssp_records` / hazards / acks | **Verify live schema** vs dump vs client. Likely policy-only: remove broad DELETE on parent/acks; keep archive via `status`/`archived_at`. Hazards: ensure `archived` column exists; later fix delete-all sync. |
| Equipment children | Usually **policy-only**: remove or restrict DELETE; never CASCADE-delete parent for “cleanup.” |

### No — do not add blind new columns

| Table | Why |
|-------|-----|
| `machine_equipment` | `archived` already exists and is wired in UI/storage. |
| `sssp_records` (if live matches client) | Archive is `status` + `archived_at`; do not also add a redundant boolean unless live still has only dump-era `archived` boolean — then align to one model. |
| `sssp_hazards` (if live has `archived`) | Use existing; do not add `deleted_at`. |
| `sssp_acknowledgements` | Prefer parent-level archive; no per-ack archive column unless product requires it. |
| `machine_*` children | Prefer retain history under archived parent; status already covers defects. |

---

## 5. FK / related-records risk notes

```
sssp_records (id)
  ├── sssp_hazards.sssp_id          ON DELETE CASCADE
  └── sssp_acknowledgements.sssp_id ON DELETE CASCADE

machine_equipment (id)
  ├── machine_defect_records.machine_id    ON DELETE CASCADE
  ├── machine_service_records.machine_id   ON DELETE CASCADE
  └── machine_document_records.machine_id  ON DELETE CASCADE
```

| Risk | Detail |
|------|--------|
| **SSSP hard delete** | Deletes **all hazards and acknowledgements** via CASCADE. Never hard-delete submitted/completed SSSPs. Dump policies currently allow admin DELETE via ALL — **must verify live** and tighten. |
| **Hazard sync** | `syncHazards` deletes all hazard rows then inserts non-archived only — soft-archived hazards disappear from DB. Treat as a **follow-up bugfix** before relying on hazard archive for audit. |
| **Equipment hard delete** | Cascades defects, services, documents. Prefer parent `archived = true` only. |
| **Resolved Critical defects** | No separate archive field; do not DELETE. Filtering can use `severity = 'Critical' AND status = 'Resolved'`. |
| **Actions ↔ sources** | `source_type` / `source_record_id` link to forms; archiving a Job Start/Incident does not auto-archive actions — decide product rule (leave actions visible vs cascade archive flag). |
| **Visitor** | No child FKs; archive flag is enough. No DELETE policy today — keep it that way. |
| **Owner DELETE on form tables** | Staff RLS can DELETE own cloud rows even though UI mostly does not expose cloud delete — tighten when adding admin-only archive. |
| **Local clear-all** | Job Start (and similar) can wipe **device** records; unrelated to Supabase archive — keep messaging clear. |

---

## 6. Admin deletion today vs needs new policies

### Already permit admin deletion (repo migration evidence)

| Table | Mechanism |
|-------|-----------|
| `hs_general_meeting_records` | Explicit `Admins can delete general meetings` + client delete |
| `sssp_records` | `Admins can manage SSSPs` (ALL) — **conflicts with PROJECT_NOTES “No delete”** |
| `sssp_hazards` | ALL / manage |
| `sssp_acknowledgements` | ALL / manage |
| `machine_equipment` | ALL / manage (UI does not call delete) |
| `machine_defect_records` | ALL / manage |
| `machine_service_records` | ALL / manage |
| `machine_document_records` | ALL / manage |

### Do **not** currently permit admin deletion of others’ rows

| Table | Current delete capability |
|-------|---------------------------|
| `job_start_records` | Owner only |
| `machine_prestart_records` | Owner only |
| `toolbox_meeting_records` | Owner only |
| `incident_near_miss_records` | Owner only |
| `timesheet_records` | Owner only |
| `action_register_records` | Owner only |
| `visitor_sign_in_records` | **No DELETE policy** |

### Also missing for archive to work (admin update of any row)

For the six form/action tables above, admins **cannot UPDATE** another user’s row under dump policies. Archiving requires **new admin UPDATE** policies using `public.is_admin()` (same gap likely blocks admin editing actions created by staff).

**Must verify in Supabase Dashboard** before coding — production may have hand-applied policies not reflected in git.

---

## 7. Safest implementation order (phased)

### Phase 0 — Verify live (no code)

1. In Supabase: columns for SSSP (`archived_at` vs `archived`, status check), `sssp_hazards.archived`, `hs_general_meeting_records.archived`, visitor columns.
2. Export/list RLS policies for every table above; compare to migration dump.
3. Confirm `public.is_admin()` definition and grants (post-tighten migration).

### Phase 1 — Policy hardening only (lowest data risk)

1. Restrict/remove DELETE on `sssp_records` and `sssp_acknowledgements` (and avoid equipment parent DELETE).
2. Keep equipment on existing `archived` flag; no CASCADE deletes from UI.
3. Stop treating General Meeting delete as default (UI later); ensure completed meetings are not hard-deleted.

### Phase 2 — Wire existing archive fields (no new columns)

1. General Meetings: set `archived = true` instead of `.delete()`; filter archived from main list.
2. SSSP: already archives via status; ensure Archived tab + reactivate remain admin-only; do not add delete.
3. Equipment: already done; optional link into central Archived Records view.

### Phase 3 — Schema for form tables (additive columns only)

1. Add `archived boolean NOT NULL DEFAULT false` (+ optional audit columns) to: job start, pre-start, toolbox, timesheet, action; incident same but **no DELETE policy**.
2. Visitor: add `archived` only.
3. Backfill: all existing rows `archived = false`.
4. RLS: admin UPDATE for archive; admin DELETE only where behaviour is archive+delete; revoke staff cloud DELETE if product requires admin-only.

### Phase 4 — Client UX (after policies/schema)

1. Admin “Archive” on record detail / Records Dashboard rows.
2. New **Archived Records** page (`adminOnly`) under Records & Actions nav.
3. Permanent delete only there, with typed `DELETE`, and only for types marked archive+delete.
4. Cloud storage: `update*Record` archive flag; `delete*Record` admin-only where allowed.
5. Filter archived out of default dashboard/lists; include in Archived page.

### Phase 5 — Follow-ups

1. Fix SSSP `syncHazards` to retain archived hazard rows.
2. Decide action ↔ source archive cascade.
3. Update `PROJECT_NOTES.md` RLS section to match migrations + live (docs only).
4. Align any remaining dump-vs-live schema documentation.

---

## 8. Recommended behaviour cheat-sheet

| Behaviour | Types |
|-----------|--------|
| **Archive + delete** (delete only from Archived Records + type `DELETE`) | Job Start, Pre-Start, Toolbox, Timesheet, Action Register, General Meeting **drafts** |
| **Archive only** (no routine permanent delete) | Incident, Visitor history, Completed General Meetings, Submitted/Completed/Closed SSSP, SSSP acknowledgements, Resolved Critical defects |
| **Archive parent, keep children** | `machine_equipment` → defects / service / documents |

---

## 9. Explicit confirmation

**No application code, no Supabase migrations, and no destructive database commands were executed in this planning pass.**  
This file (`ARCHIVE_DELETE_PLAN.md`) is the only new artifact written for this work.

-- Archive/Delete Phase 1: policy hardening only.
-- Removes staff owner DELETE on form tables and replaces admin FOR ALL
-- manage policies with INSERT/UPDATE (no DELETE) where needed.
-- Does not change schema, grants, triggers, or functions.

-- ---------------------------------------------------------------------------
-- 1. Staff-owned form tables — drop owner DELETE only (do not replace)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can delete their own job start records"
on public.job_start_records;

drop policy if exists "Users can delete their own machine prestarts"
on public.machine_prestart_records;

drop policy if exists "Users can delete their own toolbox meetings"
on public.toolbox_meeting_records;

drop policy if exists "Users can delete their own incident records"
on public.incident_near_miss_records;

drop policy if exists "Users can delete their own timesheet records"
on public.timesheet_records;

drop policy if exists "Users can delete their own action records"
on public.action_register_records;

-- ---------------------------------------------------------------------------
-- 2. SSSP records — replace FOR ALL manage with INSERT/UPDATE (no DELETE)
-- Keep: "Authenticated users can view SSSPs"
-- Admin SELECT not needed (authenticated SELECT already covers admins).
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can manage SSSPs"
on public.sssp_records;

create policy "Admins can insert SSSPs"
on public.sssp_records
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update SSSPs"
on public.sssp_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. SSSP hazards — replace FOR ALL manage with INSERT/UPDATE (no DELETE)
-- Keep: "Authenticated users can view SSSP hazards"
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can manage SSSP hazards"
on public.sssp_hazards;

create policy "Admins can insert SSSP hazards"
on public.sssp_hazards
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update SSSP hazards"
on public.sssp_hazards
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. SSSP acknowledgements — drop FOR ALL manage; no DELETE
-- Keep authenticated acknowledge + view policies.
-- Admin INSERT optional (staff already insert via acknowledge policy).
-- Skip admin UPDATE (acks are audit rows; corrections are atypical).
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can manage SSSP acknowledgements"
on public.sssp_acknowledgements;

create policy "Admins can insert SSSP acknowledgements"
on public.sssp_acknowledgements
for insert
to authenticated
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. machine_equipment — replace FOR ALL manage with INSERT/UPDATE (no DELETE)
-- Keep: "Authenticated users can view equipment"
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can manage equipment"
on public.machine_equipment;

create policy "Admins can insert equipment"
on public.machine_equipment
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update equipment"
on public.machine_equipment
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Equipment children — replace admin ALL/manage with INSERT/UPDATE (no DELETE)
-- Preserve staff report/view policies.
-- ---------------------------------------------------------------------------

-- machine_defect_records
drop policy if exists "Admins can manage defects"
on public.machine_defect_records;

drop policy if exists "Admins can manage machine defects"
on public.machine_defect_records;

drop policy if exists "Admins can manage defect records"
on public.machine_defect_records;

create policy "Admins can insert defects"
on public.machine_defect_records
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update defects"
on public.machine_defect_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- machine_service_records
drop policy if exists "Admins can manage service records"
on public.machine_service_records;

drop policy if exists "Admins can manage machine service records"
on public.machine_service_records;

create policy "Admins can insert service records"
on public.machine_service_records
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update service records"
on public.machine_service_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- machine_document_records
drop policy if exists "Admins can manage equipment documents"
on public.machine_document_records;

drop policy if exists "Admins can manage machine documents"
on public.machine_document_records;

drop policy if exists "Admins can manage document records"
on public.machine_document_records;

create policy "Admins can insert equipment documents"
on public.machine_document_records
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update equipment documents"
on public.machine_document_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. General meetings — drop admin DELETE only (do not replace)
-- Keep admin INSERT/UPDATE and authenticated SELECT.
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can delete general meetings"
on public.hs_general_meeting_records;

-- ---------------------------------------------------------------------------
-- 8. Visitors — no changes
-- ---------------------------------------------------------------------------

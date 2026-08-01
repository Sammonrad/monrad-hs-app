-- Controlled permanent deletion for archived records only.
-- Admins may DELETE selected form/GM rows when archived = true.
-- General meetings also require status = 'draft' (lowercase; matches app storage).
-- Does not change schema, grants, triggers, functions, FKs, or constraints.
-- Does not add DELETE policies for incidents, visitors, SSSPs, or equipment.

-- ---------------------------------------------------------------------------
-- job_start_records
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived job start records"
on public.job_start_records;

create policy "Admins can permanently delete archived job start records"
on public.job_start_records
for delete
to authenticated
using (public.is_admin() and archived = true);

-- ---------------------------------------------------------------------------
-- machine_prestart_records
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived machine prestart records"
on public.machine_prestart_records;

create policy "Admins can permanently delete archived machine prestart records"
on public.machine_prestart_records
for delete
to authenticated
using (public.is_admin() and archived = true);

-- ---------------------------------------------------------------------------
-- toolbox_meeting_records
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived toolbox meeting records"
on public.toolbox_meeting_records;

create policy "Admins can permanently delete archived toolbox meeting records"
on public.toolbox_meeting_records
for delete
to authenticated
using (public.is_admin() and archived = true);

-- ---------------------------------------------------------------------------
-- timesheet_records
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived timesheet records"
on public.timesheet_records;

create policy "Admins can permanently delete archived timesheet records"
on public.timesheet_records
for delete
to authenticated
using (public.is_admin() and archived = true);

-- ---------------------------------------------------------------------------
-- action_register_records
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived action register records"
on public.action_register_records;

create policy "Admins can permanently delete archived action register records"
on public.action_register_records
for delete
to authenticated
using (public.is_admin() and archived = true);

-- ---------------------------------------------------------------------------
-- hs_general_meeting_records — archived drafts only (not completed)
-- Status casing verified from MEETING_STATUSES / app storage: 'draft'
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived draft general meetings"
on public.hs_general_meeting_records;

create policy "Admins can permanently delete archived draft general meetings"
on public.hs_general_meeting_records
for delete
to authenticated
using (public.is_admin() and archived = true and status = 'draft');

-- Complete archive/restore security:
-- 1) Admin UPDATE policies on staff form tables (owners keep existing UPDATE).
-- 2) Block non-admins from changing visitor_sign_in_records.archived
--    while preserving existing sign-out field protections.
-- Idempotent. No grants, no column changes, no DELETE policies.

-- ---------------------------------------------------------------------------
-- 1. Admin UPDATE — form / action tables (owners retain their UPDATE policies)
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can update job start records"
on public.job_start_records;

create policy "Admins can update job start records"
on public.job_start_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can update machine prestart records"
on public.machine_prestart_records;

create policy "Admins can update machine prestart records"
on public.machine_prestart_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can update toolbox meeting records"
on public.toolbox_meeting_records;

create policy "Admins can update toolbox meeting records"
on public.toolbox_meeting_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can update incident near miss records"
on public.incident_near_miss_records;

create policy "Admins can update incident near miss records"
on public.incident_near_miss_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can update timesheet records"
on public.timesheet_records;

create policy "Admins can update timesheet records"
on public.timesheet_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can update action register records"
on public.action_register_records;

create policy "Admins can update action register records"
on public.action_register_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Visitor field protection — admins may change archived; staff may not.
--    Preserves all existing identity / arrival / induction / sign-out checks.
--    Trigger left in place; function body replaced only.
-- ---------------------------------------------------------------------------

create or replace function public.protect_visitor_sign_in_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  -- Trusted database roles and app admins may correct full records.
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not public.is_admin()
  then
    -- Ordinary staff may only sign out a visitor who is still on site.
    if old.departure_time is not null then
      raise exception
        'This visitor has already been signed out'
        using errcode = '42501';
    end if;

    if new.archived is distinct from old.archived then
      raise exception
        'Only administrators may archive or restore visitor records'
        using errcode = '42501';
    end if;

    if new.visitor_name is distinct from old.visitor_name
       or new.company is distinct from old.company
       or new.phone is distinct from old.phone
       or new.person_visiting is distinct from old.person_visiting
       or new.site_name is distinct from old.site_name
       or new.purpose is distinct from old.purpose
       or new.vehicle_registration is distinct from old.vehicle_registration
       or new.arrival_time is distinct from old.arrival_time
       or new.induction_acknowledged is distinct from old.induction_acknowledged
       or new.critical_risks_acknowledged is distinct from old.critical_risks_acknowledged
       or new.emergency_procedure_acknowledged is distinct from old.emergency_procedure_acknowledged
       or new.ppe_acknowledged is distinct from old.ppe_acknowledged
       or new.hazards_reported is distinct from old.hazards_reported
       or new.notes is distinct from old.notes
       or new.signed_in_by is distinct from old.signed_in_by
       or new.created_at is distinct from old.created_at
    then
      raise exception
        'Only administrators may edit visitor record details'
        using errcode = '42501';
    end if;

    if new.departure_time is null then
      raise exception
        'A sign-out time is required'
        using errcode = '42501';
    end if;

    if new.signed_out_by is distinct from (select auth.uid()) then
      raise exception
        'signed_out_by must match the current user'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

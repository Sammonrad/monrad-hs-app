-- Tighten Visitor Sign-In access.
-- Active approved users may view and create visitor records.
-- Ordinary staff may only sign a visitor out.
-- Admins may correct full records.

alter table public.visitor_sign_in_records
enable row level security;

-- Remove the overly broad existing policies.
drop policy if exists "Authenticated users can view visitor records"
on public.visitor_sign_in_records;

drop policy if exists "Authenticated users can create visitor records"
on public.visitor_sign_in_records;

drop policy if exists "Authenticated users can update visitor records"
on public.visitor_sign_in_records;

-- Active approved users may view visitor records.
create policy "Active users can view visitor records"
on public.visitor_sign_in_records
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and status = 'active'
  )
);

-- Active approved users may create visitor records.
create policy "Active users can create visitor records"
on public.visitor_sign_in_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and status = 'active'
  )
  and signed_in_by = (select auth.uid())
);

-- Active users may target visitor rows for sign-out.
-- The trigger below limits which fields ordinary staff may alter.
create policy "Active users can update visitor sign out"
on public.visitor_sign_in_records
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and status = 'active'
  )
);

-- Protect the original visitor record from being rewritten by ordinary staff.
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

drop trigger if exists protect_visitor_sign_in_fields
on public.visitor_sign_in_records;

create trigger protect_visitor_sign_in_fields
before update on public.visitor_sign_in_records
for each row
execute function public.protect_visitor_sign_in_fields();
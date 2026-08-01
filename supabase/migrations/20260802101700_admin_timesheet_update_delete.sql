-- Admin timesheet management:
-- Ensure authenticated admins can UPDATE any timesheet and permanently DELETE
-- any timesheet (active or archived). Staff owner UPDATE/DELETE policies are
-- unchanged (auth.uid() = user_id). Uses public.is_admin(). Idempotent.

-- ---------------------------------------------------------------------------
-- Admin UPDATE any timesheet (active or archived)
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can update timesheet records"
on public.timesheet_records;

create policy "Admins can update timesheet records"
on public.timesheet_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin DELETE any timesheet (active or archived)
-- Replaces archived-only admin delete so admins can hard-delete all rows.
-- Coexists with "Users can delete their own timesheet records".
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can permanently delete archived timesheet records"
on public.timesheet_records;

drop policy if exists "Admins can permanently delete timesheet records"
on public.timesheet_records;

create policy "Admins can permanently delete timesheet records"
on public.timesheet_records
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Prevent changing timesheet ownership (user_id) on UPDATE.
-- Admins may still update/delete any timesheet; ownership is immutable.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_timesheet_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Timesheet ownership cannot be changed';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_timesheet_owner_change
on public.timesheet_records;

create trigger trg_prevent_timesheet_owner_change
before update on public.timesheet_records
for each row
execute function public.prevent_timesheet_owner_change();

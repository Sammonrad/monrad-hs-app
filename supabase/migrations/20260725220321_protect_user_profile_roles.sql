-- Protect role, status and other security-sensitive profile fields.
-- Browser users keep normal profile access, while only admins may
-- change role, approval status, identity fields or creation metadata.

alter table public.user_profiles
enable row level security;

-- Remove unnecessary browser-role privileges first.
revoke all privileges
on table public.user_profiles
from anon;

revoke all privileges
on table public.user_profiles
from authenticated;

-- Signed-in users require only these normal table operations.
-- RLS policies still decide which rows they may access.
grant select, insert, update
on table public.user_profiles
to authenticated;

-- Remove the overlapping self-update policies.
drop policy if exists "Users can update their own profile"
on public.user_profiles;

drop policy if exists "Users can update their own staff profile"
on public.user_profiles;

-- Replace the self-insert policy with stricter conditions.
-- This remains as a safe fallback if a user's profile was not created
-- by the auth.users trigger.
drop policy if exists "Users can insert their own staff profile"
on public.user_profiles;

create policy "Users can insert their own pending staff profile"
on public.user_profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and role = 'staff'
  and status = 'pending'
  and email = (select auth.jwt() ->> 'email')
);

-- Users may update only their own row.
-- The trigger below protects the security-sensitive columns.
create policy "Users can update their own profile"
on public.user_profiles
for update
to authenticated
using (
  (select auth.uid()) = id
)
with check (
  (select auth.uid()) = id
);

-- Prevent non-admin users from altering protected profile fields.
create or replace function public.protect_user_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  -- Allow trusted database roles and users recognised as app admins.
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not public.is_admin()
  then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.created_at is distinct from old.created_at
    then
      raise exception
        'Only administrators may change protected profile fields'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists protect_user_profile_security_fields
on public.user_profiles;

create trigger protect_user_profile_security_fields
before update on public.user_profiles
for each row
execute function public.protect_user_profile_security_fields();

-- Keep the existing admin policy intact:
-- "Admins can update all user profiles"
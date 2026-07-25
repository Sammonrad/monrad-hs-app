-- Tighten execution privileges for SECURITY DEFINER functions.

-- Recreate is_admin with an empty search_path.
-- All referenced objects are schema-qualified.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  );
$function$;

-- Recreate the Auth profile trigger function with an empty search_path.
-- It is invoked by the auth.users trigger, not directly by app users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    role,
    status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'staff',
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- Remove broad/default execution access.
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- Existing RLS policies call is_admin as signed-in users.
grant execute on function public.is_admin() to authenticated;
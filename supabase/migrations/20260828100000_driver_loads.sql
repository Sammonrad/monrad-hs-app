-- Driver loads / quarry runs for truck drivers (weighbridge tickets).
-- Linked to timesheet_records when available; also keyed by user_id + load_date.

-- ---------------------------------------------------------------------------
-- driver_loads
-- ---------------------------------------------------------------------------

create table if not exists public.driver_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timesheet_id uuid references public.timesheet_records(id) on delete set null,
  timesheet_local_id text,
  load_date date not null,
  driver_name text,
  job_name text,
  truck_vehicle text,
  quarry_supplier text,
  material_product text,
  delivery_destination text,
  ticket_number text,
  gross_weight_tonnes numeric,
  tare_weight_tonnes numeric,
  net_weight_tonnes numeric,
  trip_start_time time,
  delivery_finish_time time,
  notes text,
  ticket_image_path text,
  load_data jsonb not null default '{}'::jsonb,
  duplicate_ticket_flag boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_loads_user_id_idx on public.driver_loads (user_id);
create index if not exists driver_loads_load_date_idx on public.driver_loads (load_date desc);
create index if not exists driver_loads_timesheet_id_idx on public.driver_loads (timesheet_id);
create index if not exists driver_loads_ticket_number_idx on public.driver_loads (ticket_number);
create index if not exists driver_loads_job_name_idx on public.driver_loads (job_name);
create index if not exists driver_loads_truck_vehicle_idx on public.driver_loads (truck_vehicle);
create index if not exists driver_loads_quarry_supplier_idx on public.driver_loads (quarry_supplier);
create index if not exists driver_loads_material_product_idx on public.driver_loads (material_product);

alter table public.driver_loads enable row level security;

-- Staff: own rows
drop policy if exists "Users can view their own driver loads" on public.driver_loads;
create policy "Users can view their own driver loads"
on public.driver_loads
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own driver loads" on public.driver_loads;
create policy "Users can insert their own driver loads"
on public.driver_loads
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own driver loads" on public.driver_loads;
create policy "Users can update their own driver loads"
on public.driver_loads
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own driver loads" on public.driver_loads;
create policy "Users can delete their own driver loads"
on public.driver_loads
for delete to authenticated
using (auth.uid() = user_id);

-- Admin: company-wide
drop policy if exists "Admins can view all driver loads" on public.driver_loads;
create policy "Admins can view all driver loads"
on public.driver_loads
for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update driver loads" on public.driver_loads;
create policy "Admins can update driver loads"
on public.driver_loads
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete driver loads" on public.driver_loads;
create policy "Admins can delete driver loads"
on public.driver_loads
for delete to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert driver loads" on public.driver_loads;
create policy "Admins can insert driver loads"
on public.driver_loads
for insert to authenticated
with check (public.is_admin());

-- M1/M4: Derive user_id from linked timesheet; validate timesheet exists and ownership.
create or replace function public.enforce_driver_load_timesheet_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ts_user_id uuid;
begin
  if new.timesheet_id is not null then
    select tr.user_id into ts_user_id
    from public.timesheet_records tr
    where tr.id = new.timesheet_id;

    if ts_user_id is null then
      raise exception 'Invalid timesheet_id: timesheet record does not exist';
    end if;

    -- Always attribute load to the timesheet owner (admin edits on behalf keep driver ownership).
    new.user_id := ts_user_id;

    if not public.is_admin() and ts_user_id is distinct from auth.uid() then
      raise exception 'Cannot assign driver load to another user''s timesheet';
    end if;
  elsif not public.is_admin() and new.user_id is distinct from auth.uid() then
    raise exception 'Cannot create driver load for another user';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_driver_load_timesheet_ownership on public.driver_loads;
create trigger trg_enforce_driver_load_timesheet_ownership
before insert or update on public.driver_loads
for each row
execute function public.enforce_driver_load_timesheet_ownership();

-- Prevent manual ownership changes except when timesheet link changes (M1 trigger sets user_id).
create or replace function public.prevent_driver_load_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    if new.timesheet_id is not null and new.timesheet_id is distinct from old.timesheet_id then
      return new;
    end if;
    raise exception 'driver_loads.user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_driver_load_owner_change on public.driver_loads;
create trigger trg_prevent_driver_load_owner_change
before update on public.driver_loads
for each row
execute function public.prevent_driver_load_owner_change();

-- ---------------------------------------------------------------------------
-- driver_load_audits (admin corrections)
-- ---------------------------------------------------------------------------

create table if not exists public.driver_load_audits (
  id uuid primary key default gen_random_uuid(),
  driver_load_id uuid not null references public.driver_loads(id) on delete cascade,
  edited_by uuid not null references auth.users(id),
  edited_at timestamptz not null default now(),
  field_changes jsonb not null default '{}'::jsonb,
  reason text
);

create index if not exists driver_load_audits_load_id_idx on public.driver_load_audits (driver_load_id);

alter table public.driver_load_audits enable row level security;

drop policy if exists "Admins can view driver load audits" on public.driver_load_audits;
create policy "Admins can view driver load audits"
on public.driver_load_audits
for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert driver load audits" on public.driver_load_audits;
create policy "Admins can insert driver load audits"
on public.driver_load_audits
for insert to authenticated
with check (public.is_admin());

-- Drivers can view audits on their own loads
drop policy if exists "Users can view audits on own driver loads" on public.driver_load_audits;
create policy "Users can view audits on own driver loads"
on public.driver_load_audits
for select to authenticated
using (
  exists (
    select 1 from public.driver_loads dl
    where dl.id = driver_load_id and dl.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Storage bucket: driver-load-tickets (private weighbridge photos)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-load-tickets',
  'driver-load-tickets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own driver ticket images" on storage.objects;
create policy "Users upload own driver ticket images"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'driver-load-tickets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own driver ticket images" on storage.objects;
create policy "Users update own driver ticket images"
on storage.objects
for update to authenticated
using (
  bucket_id = 'driver-load-tickets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'driver-load-tickets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users read own driver ticket images" on storage.objects;
create policy "Users read own driver ticket images"
on storage.objects
for select to authenticated
using (
  bucket_id = 'driver-load-tickets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins read all driver ticket images" on storage.objects;
create policy "Admins read all driver ticket images"
on storage.objects
for select to authenticated
using (
  bucket_id = 'driver-load-tickets'
  and public.is_admin()
);

drop policy if exists "Users delete own driver ticket images" on storage.objects;
create policy "Users delete own driver ticket images"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'driver-load-tickets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins delete driver ticket images" on storage.objects;
create policy "Admins delete driver ticket images"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'driver-load-tickets'
  and public.is_admin()
);

drop policy if exists "Admins upload driver ticket images" on storage.objects;
create policy "Admins upload driver ticket images"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'driver-load-tickets'
  and public.is_admin()
);

drop policy if exists "Admins update driver ticket images" on storage.objects;
create policy "Admins update driver ticket images"
on storage.objects
for update to authenticated
using (
  bucket_id = 'driver-load-tickets'
  and public.is_admin()
)
with check (
  bucket_id = 'driver-load-tickets'
  and public.is_admin()
);

grant all on table public.driver_loads to authenticated;
grant all on table public.driver_load_audits to authenticated;

-- ---------------------------------------------------------------------------
-- user_profiles.timesheet_type (standard | driver)
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists timesheet_type text not null default 'standard';

alter table public.user_profiles
  drop constraint if exists user_profiles_timesheet_type_check;

alter table public.user_profiles
  add constraint user_profiles_timesheet_type_check
  check (timesheet_type in ('standard', 'driver'));

-- ---------------------------------------------------------------------------
-- driver_daily_sheets (one driver day)
-- ---------------------------------------------------------------------------

create table if not exists public.driver_daily_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sheet_date date not null,
  truck_vehicle text,
  status text not null default 'draft',
  started_at timestamptz,
  finished_at timestamptz,
  timesheet_id uuid references public.timesheet_records(id) on delete set null,
  sheet_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_daily_sheets_status_check
    check (status in ('draft', 'submitted', 'corrected')),
  constraint driver_daily_sheets_user_date_unique unique (user_id, sheet_date)
);

create index if not exists driver_daily_sheets_user_id_idx on public.driver_daily_sheets (user_id);
create index if not exists driver_daily_sheets_sheet_date_idx on public.driver_daily_sheets (sheet_date desc);
create index if not exists driver_daily_sheets_status_idx on public.driver_daily_sheets (status);
create index if not exists driver_daily_sheets_timesheet_id_idx on public.driver_daily_sheets (timesheet_id);

alter table public.driver_daily_sheets enable row level security;

drop policy if exists "Users can view their own driver daily sheets" on public.driver_daily_sheets;
create policy "Users can view their own driver daily sheets"
on public.driver_daily_sheets
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own driver daily sheets" on public.driver_daily_sheets;
create policy "Users can insert their own driver daily sheets"
on public.driver_daily_sheets
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own driver daily sheets" on public.driver_daily_sheets;
create policy "Users can update their own driver daily sheets"
on public.driver_daily_sheets
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own driver daily sheets" on public.driver_daily_sheets;
create policy "Users can delete their own driver daily sheets"
on public.driver_daily_sheets
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can view all driver daily sheets" on public.driver_daily_sheets;
create policy "Admins can view all driver daily sheets"
on public.driver_daily_sheets
for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update driver daily sheets" on public.driver_daily_sheets;
create policy "Admins can update driver daily sheets"
on public.driver_daily_sheets
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete driver daily sheets" on public.driver_daily_sheets;
create policy "Admins can delete driver daily sheets"
on public.driver_daily_sheets
for delete to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert driver daily sheets" on public.driver_daily_sheets;
create policy "Admins can insert driver daily sheets"
on public.driver_daily_sheets
for insert to authenticated
with check (public.is_admin());

create or replace function public.prevent_driver_daily_sheet_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'driver_daily_sheets.user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_driver_daily_sheet_owner_change on public.driver_daily_sheets;
create trigger trg_prevent_driver_daily_sheet_owner_change
before update on public.driver_daily_sheets
for each row
execute function public.prevent_driver_daily_sheet_owner_change();

-- ---------------------------------------------------------------------------
-- driver_day_segments (timed job/activity segments within a day)
-- ---------------------------------------------------------------------------

create table if not exists public.driver_day_segments (
  id uuid primary key default gen_random_uuid(),
  daily_sheet_id uuid not null references public.driver_daily_sheets(id) on delete cascade,
  job_name text,
  activity_type text not null default 'job',
  started_at timestamptz not null,
  ended_at timestamptz,
  sort_order integer not null default 0,
  segment_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_day_segments_activity_type_check
    check (activity_type in ('job', 'yard', 'travel', 'break', 'workshop', 'other'))
);

create index if not exists driver_day_segments_daily_sheet_id_idx on public.driver_day_segments (daily_sheet_id);
create index if not exists driver_day_segments_started_at_idx on public.driver_day_segments (started_at);

alter table public.driver_day_segments enable row level security;

drop policy if exists "Users can view segments on own daily sheets" on public.driver_day_segments;
create policy "Users can view segments on own daily sheets"
on public.driver_day_segments
for select to authenticated
using (
  exists (
    select 1 from public.driver_daily_sheets ds
    where ds.id = daily_sheet_id and ds.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert segments on own daily sheets" on public.driver_day_segments;
create policy "Users can insert segments on own daily sheets"
on public.driver_day_segments
for insert to authenticated
with check (
  exists (
    select 1 from public.driver_daily_sheets ds
    where ds.id = daily_sheet_id and ds.user_id = auth.uid()
  )
);

drop policy if exists "Users can update segments on own daily sheets" on public.driver_day_segments;
create policy "Users can update segments on own daily sheets"
on public.driver_day_segments
for update to authenticated
using (
  exists (
    select 1 from public.driver_daily_sheets ds
    where ds.id = daily_sheet_id and ds.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.driver_daily_sheets ds
    where ds.id = daily_sheet_id and ds.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete segments on own daily sheets" on public.driver_day_segments;
create policy "Users can delete segments on own daily sheets"
on public.driver_day_segments
for delete to authenticated
using (
  exists (
    select 1 from public.driver_daily_sheets ds
    where ds.id = daily_sheet_id and ds.user_id = auth.uid()
  )
);

drop policy if exists "Admins can view all driver day segments" on public.driver_day_segments;
create policy "Admins can view all driver day segments"
on public.driver_day_segments
for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update driver day segments" on public.driver_day_segments;
create policy "Admins can update driver day segments"
on public.driver_day_segments
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete driver day segments" on public.driver_day_segments;
create policy "Admins can delete driver day segments"
on public.driver_day_segments
for delete to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert driver day segments" on public.driver_day_segments;
create policy "Admins can insert driver day segments"
on public.driver_day_segments
for insert to authenticated
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- driver_daily_sheet_audits (admin corrections)
-- ---------------------------------------------------------------------------

create table if not exists public.driver_daily_sheet_audits (
  id uuid primary key default gen_random_uuid(),
  daily_sheet_id uuid not null references public.driver_daily_sheets(id) on delete cascade,
  edited_by uuid not null references auth.users(id),
  edited_at timestamptz not null default now(),
  field_changes jsonb not null default '{}'::jsonb,
  reason text
);

create index if not exists driver_daily_sheet_audits_sheet_id_idx
  on public.driver_daily_sheet_audits (daily_sheet_id);

alter table public.driver_daily_sheet_audits enable row level security;

drop policy if exists "Admins can view driver daily sheet audits" on public.driver_daily_sheet_audits;
create policy "Admins can view driver daily sheet audits"
on public.driver_daily_sheet_audits
for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert driver daily sheet audits" on public.driver_daily_sheet_audits;
create policy "Admins can insert driver daily sheet audits"
on public.driver_daily_sheet_audits
for insert to authenticated
with check (public.is_admin());

drop policy if exists "Users can view audits on own daily sheets" on public.driver_daily_sheet_audits;
create policy "Users can view audits on own daily sheets"
on public.driver_daily_sheet_audits
for select to authenticated
using (
  exists (
    select 1 from public.driver_daily_sheets ds
    where ds.id = daily_sheet_id and ds.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- driver_loads: link to daily sheet and segment
-- ---------------------------------------------------------------------------

alter table public.driver_loads
  add column if not exists daily_sheet_id uuid references public.driver_daily_sheets(id) on delete set null;

alter table public.driver_loads
  add column if not exists segment_id uuid references public.driver_day_segments(id) on delete set null;

create index if not exists driver_loads_daily_sheet_id_idx on public.driver_loads (daily_sheet_id);
create index if not exists driver_loads_segment_id_idx on public.driver_loads (segment_id);

-- Extend ownership trigger to validate daily_sheet ownership (M1 pattern).
create or replace function public.enforce_driver_load_timesheet_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ts_user_id uuid;
  ds_user_id uuid;
begin
  if new.timesheet_id is not null then
    select tr.user_id into ts_user_id
    from public.timesheet_records tr
    where tr.id = new.timesheet_id;

    if ts_user_id is null then
      raise exception 'Invalid timesheet_id: timesheet record does not exist';
    end if;

    new.user_id := ts_user_id;

    if not public.is_admin() and ts_user_id is distinct from auth.uid() then
      raise exception 'Cannot assign driver load to another user''s timesheet';
    end if;
  elsif new.daily_sheet_id is not null then
    select ds.user_id into ds_user_id
    from public.driver_daily_sheets ds
    where ds.id = new.daily_sheet_id;

    if ds_user_id is null then
      raise exception 'Invalid daily_sheet_id: daily sheet does not exist';
    end if;

    new.user_id := ds_user_id;

    if not public.is_admin() and ds_user_id is distinct from auth.uid() then
      raise exception 'Cannot assign driver load to another user''s daily sheet';
    end if;
  elsif not public.is_admin() and new.user_id is distinct from auth.uid() then
    raise exception 'Cannot create driver load for another user';
  end if;

  return new;
end;
$$;

grant all on table public.driver_daily_sheets to authenticated;
grant all on table public.driver_day_segments to authenticated;
grant all on table public.driver_daily_sheet_audits to authenticated;

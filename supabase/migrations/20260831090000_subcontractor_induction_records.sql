create table if not exists public.subcontractor_induction_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_data jsonb not null default '{}'::jsonb,
  induction_date date not null default current_date,
  site_name text,
  subcontractor_name text,
  company_name text,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subcontractor_induction_date_idx on public.subcontractor_induction_records (induction_date desc);
create index if not exists subcontractor_induction_user_idx on public.subcontractor_induction_records (user_id);
alter table public.subcontractor_induction_records enable row level security;
create policy "Users can insert their own subcontractor inductions" on public.subcontractor_induction_records for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can view their own subcontractor inductions" on public.subcontractor_induction_records for select to authenticated using (auth.uid() = user_id);
create policy "Users can update their own subcontractor inductions" on public.subcontractor_induction_records for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own subcontractor inductions" on public.subcontractor_induction_records for delete to authenticated using (auth.uid() = user_id);
create policy "Admins can view all subcontractor inductions" on public.subcontractor_induction_records for select to authenticated using (public.is_admin());
create policy "Admins can update all subcontractor inductions" on public.subcontractor_induction_records for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete subcontractor inductions" on public.subcontractor_induction_records for delete to authenticated using (public.is_admin());
grant all on table public.subcontractor_induction_records to authenticated;
grant all on table public.subcontractor_induction_records to service_role;


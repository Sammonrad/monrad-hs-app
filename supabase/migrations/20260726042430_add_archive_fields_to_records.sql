-- Add archive support to standard records

alter table public.job_start_records
add column if not exists archived boolean not null default false;

alter table public.machine_prestart_records
add column if not exists archived boolean not null default false;

alter table public.toolbox_meeting_records
add column if not exists archived boolean not null default false;

alter table public.timesheet_records
add column if not exists archived boolean not null default false;

alter table public.action_register_records
add column if not exists archived boolean not null default false;

alter table public.incident_near_miss_records
add column if not exists archived boolean not null default false;

alter table public.visitor_sign_in_records
add column if not exists archived boolean not null default false;
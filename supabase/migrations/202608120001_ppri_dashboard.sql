-- PPRI / PIRI Placement Readiness Dashboard
-- Run this complete file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('admin', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_settings (
  id integer primary key default 1 check (id = 1),
  settings jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_path text not null,
  uploaded_by text,
  total_records integer not null default 0 check (total_records >= 0),
  valid_records integer not null default 0 check (valid_records >= 0),
  validation_summary jsonb not null default '{}'::jsonb,
  column_mapping jsonb not null default '[]'::jsonb,
  import_status text not null default 'importing' check (import_status in ('importing', 'ready', 'failed')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index if not exists one_active_dataset on public.dataset_versions (is_active) where is_active = true;
create index if not exists dataset_versions_created_at_idx on public.dataset_versions (created_at desc);

create table if not exists public.student_records (
  id bigint generated always as identity primary key,
  dataset_id uuid not null references public.dataset_versions(id) on delete cascade,
  uid text not null,
  student_name text not null,
  batch text,
  semester text,
  branch text,
  section text,
  piri numeric(5,2),
  grade text,
  estimated_package text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (dataset_id, uid)
);

create index if not exists student_records_dataset_idx on public.student_records (dataset_id);
create index if not exists student_records_search_idx on public.student_records (dataset_id, lower(student_name), uid);
create index if not exists student_records_group_idx on public.student_records (dataset_id, branch, section);

create table if not exists public.upload_history (
  id bigint generated always as identity primary key,
  dataset_id uuid references public.dataset_versions(id) on delete set null,
  uploaded_by text,
  filename text not null,
  status text not null check (status in ('succeeded', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.data_quality_results (
  id bigint generated always as identity primary key,
  dataset_id uuid not null references public.dataset_versions(id) on delete cascade,
  check_name text not null,
  severity text not null check (severity in ('info', 'warning', 'error')),
  affected_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dataset_id, check_name)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.activate_dataset(p_dataset_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if jwt_role <> 'service_role' and not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.dataset_versions where id = p_dataset_id and import_status in ('importing', 'ready')) then
    raise exception 'Dataset is unavailable or failed validation';
  end if;
  if not exists (select 1 from public.student_records where dataset_id = p_dataset_id) then
    raise exception 'Dataset contains no imported student records';
  end if;
  update public.dataset_versions set is_active = false where is_active = true and id <> p_dataset_id;
  update public.dataset_versions set is_active = true, import_status = 'ready', activated_at = now() where id = p_dataset_id;
end;
$$;

revoke all on function public.activate_dataset(uuid) from public;
grant execute on function public.activate_dataset(uuid) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.dashboard_settings enable row level security;
alter table public.dataset_versions enable row level security;
alter table public.student_records enable row level security;
alter table public.upload_history enable row level security;
alter table public.data_quality_results enable row level security;

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings_authenticated_read" on public.dashboard_settings;
create policy "settings_authenticated_read" on public.dashboard_settings for select to authenticated using (true);
drop policy if exists "settings_admin_write" on public.dashboard_settings;
create policy "settings_admin_write" on public.dashboard_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "datasets_authenticated_read" on public.dataset_versions;
create policy "datasets_authenticated_read" on public.dataset_versions for select to authenticated using (true);
drop policy if exists "datasets_admin_write" on public.dataset_versions;
create policy "datasets_admin_write" on public.dataset_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "students_authenticated_read" on public.student_records;
create policy "students_authenticated_read" on public.student_records for select to authenticated using (true);
drop policy if exists "students_admin_write" on public.student_records;
create policy "students_admin_write" on public.student_records for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "upload_history_admin_only" on public.upload_history;
create policy "upload_history_admin_only" on public.upload_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quality_authenticated_read" on public.data_quality_results;
create policy "quality_authenticated_read" on public.data_quality_results for select to authenticated using (true);
drop policy if exists "quality_admin_write" on public.data_quality_results;
create policy "quality_admin_write" on public.data_quality_results for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.dashboard_settings (id, settings)
values (1, '{"dashboardTitle":"PPRI / PIRI Placement Readiness Dashboard","instituteName":"YCCE Career Readiness Team","instituteLogo":"","primaryColor":"#0B1F3A","accentColor":"#0EA5A8","weights":{"aptitude":0.2,"coding":0.25,"hr":0.15,"psychological":0.15,"technical":0.15,"industry":0.1},"gradeThresholds":{"A+":9.5,"A":9,"B+":8.5,"B":8,"C+":7.5,"C":7,"D":6},"supportPriorityThreshold":7,"recordsPerPage":10,"footerText":"Confidential — for authorised placement-readiness use only."}'::jsonb)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ppri-workbooks', 'ppri-workbooks', false, 4194304, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins_manage_ppri_workbooks" on storage.objects;
create policy "admins_manage_ppri_workbooks" on storage.objects for all to authenticated using (bucket_id = 'ppri-workbooks' and public.is_admin()) with check (bucket_id = 'ppri-workbooks' and public.is_admin());

-- Run AFTER 202608120001_ppri_dashboard.sql. Transactional and safe to rerun.
-- Existing data is preserved under LEGACY. Rename that college before assigning viewers.
begin;

create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,19}$'),
  name text not null check (length(trim(name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A fixed ID makes the migration repeatable even after LEGACY is renamed.
insert into public.colleges (id, code, name)
select '00000000-0000-4000-8000-000000000001', 'LEGACY',
  coalesce((select settings->>'instituteName' from public.dashboard_settings limit 1), 'Existing college')
on conflict (id) do nothing;

alter table public.profiles add column if not exists college_id uuid references public.colleges(id);
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;
do $$ begin
  if (select count(*) from public.profiles where role = 'admin') > 1 then
    raise exception 'Keep exactly one platform administrator in profiles before applying this migration. Change other admin roles to viewer.';
  end if;
end $$;
create unique index if not exists profiles_one_platform_admin on public.profiles (role) where role = 'admin';

create or replace function public.validate_college_username()
returns trigger language plpgsql set search_path = '' as $$
declare college_code text;
begin
  new.username := nullif(lower(trim(new.username)), '');
  if new.role = 'admin' and new.college_id is not null then
    raise exception 'The platform administrator must have an empty college_id';
  end if;
  if new.username is not null then
    if new.role = 'admin' then
      if new.username !~ '^[a-z0-9][a-z0-9._-]{1,83}$' then raise exception 'Invalid administrator username'; end if;
    else
      select lower(code) into college_code from public.colleges where id = new.college_id;
      if college_code is null or new.username !~ '^[a-z0-9][a-z0-9._-]{0,63}\.[a-z][a-z0-9_]{1,19}$'
        or split_part(new.username, '.', -1) <> college_code then
        raise exception 'Viewer username must end in .COLLEGECODE matching its assigned college';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists validate_college_username on public.profiles;
create trigger validate_college_username before insert or update on public.profiles
for each row execute function public.validate_college_username();

-- Keep usernames consistent if an administrator renames a college code.
create or replace function public.rename_college_usernames()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.code <> old.code then
    update public.profiles
    set username = regexp_replace(username, '\.[^.]+$', '.' || lower(new.code))
    where college_id = new.id and username is not null;
  end if;
  return new;
end $$;
drop trigger if exists rename_college_usernames on public.colleges;
create trigger rename_college_usernames after update of code on public.colleges
for each row execute function public.rename_college_usernames();

alter table public.dataset_versions add column if not exists college_id uuid references public.colleges(id);
update public.dataset_versions set college_id = '00000000-0000-4000-8000-000000000001' where college_id is null;
alter table public.dataset_versions alter column college_id set not null;
drop index if exists public.one_active_dataset;
create unique index if not exists one_active_dataset_per_college on public.dataset_versions (college_id) where is_active;
create unique index if not exists dataset_college_identity on public.dataset_versions (id, college_id);
create index if not exists datasets_college_created on public.dataset_versions (college_id, created_at desc);

alter table public.dashboard_settings add column if not exists college_id uuid references public.colleges(id);
update public.dashboard_settings set college_id = '00000000-0000-4000-8000-000000000001' where college_id is null;
alter table public.dashboard_settings alter column college_id set not null;
alter table public.dashboard_settings drop constraint if exists dashboard_settings_id_check;
alter table public.dashboard_settings drop constraint if exists dashboard_settings_pkey;
alter table public.dashboard_settings drop column if exists id;
alter table public.dashboard_settings add primary key (college_id);

-- Redundant college IDs on child rows are checked by composite foreign keys.
do $$ declare t text; begin
  foreach t in array array['student_records', 'data_quality_results', 'upload_history'] loop
    execute format('alter table public.%I add column if not exists college_id uuid references public.colleges(id)', t);
    execute format('update public.%I c set college_id = d.college_id from public.dataset_versions d where c.dataset_id = d.id and c.college_id is null', t);
    execute format('update public.%I set college_id = %L where college_id is null', t, '00000000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column college_id set not null', t);
    if not exists (select 1 from pg_constraint where conname = t || '_dataset_college_fk') then
      execute format('alter table public.%I add constraint %I foreign key (dataset_id, college_id) references public.dataset_versions(id, college_id) on delete cascade', t, t || '_dataset_college_fk');
    end if;
    execute format('create index if not exists %I on public.%I (college_id, dataset_id)', t || '_college_dataset_idx', t);
  end loop;
end $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.can_read_college(p_college_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.colleges c where c.id = p_college_id and c.is_active
    and (public.is_admin() or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'viewer' and p.college_id = c.id
    )));
$$;
revoke all on function public.is_admin() from public;
revoke all on function public.can_read_college(uuid) from public;
grant execute on function public.is_admin(), public.can_read_college(uuid) to authenticated, service_role;

alter table public.colleges enable row level security;
-- Remove the original global read/write policies; permissive policies are ORed.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('colleges', 'profiles', 'dashboard_settings', 'dataset_versions', 'student_records', 'upload_history', 'data_quality_results') loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy colleges_read on public.colleges for select to authenticated using (public.can_read_college(id));
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy settings_read on public.dashboard_settings for select to authenticated using (public.can_read_college(college_id));
create policy datasets_read on public.dataset_versions for select to authenticated using (
  public.can_read_college(college_id) and (public.is_admin() or (is_active and import_status = 'ready'))
);
create policy students_read on public.student_records for select to authenticated using (
  public.can_read_college(college_id) and exists (select 1 from public.dataset_versions d where d.id = dataset_id and d.college_id = student_records.college_id)
);
create policy quality_read on public.data_quality_results for select to authenticated using (
  public.can_read_college(college_id) and exists (select 1 from public.dataset_versions d where d.id = dataset_id and d.college_id = data_quality_results.college_id)
);
create policy history_read on public.upload_history for select to authenticated using (public.is_admin());

-- All application writes use server-only credentials AFTER checking the short admin session.
revoke all on public.colleges, public.profiles, public.dashboard_settings, public.dataset_versions, public.student_records, public.upload_history, public.data_quality_results from anon, authenticated;
grant select on public.colleges, public.profiles, public.dashboard_settings, public.dataset_versions, public.student_records, public.upload_history, public.data_quality_results to authenticated;
grant all on public.colleges, public.profiles, public.dashboard_settings, public.dataset_versions, public.student_records, public.upload_history, public.data_quality_results to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Activation is serialized per college; another college's active workbook is untouched.
drop function if exists public.activate_dataset(uuid);
create or replace function public.activate_dataset(p_college_id uuid, p_dataset_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.dataset_versions;
begin
  perform 1 from public.colleges where id = p_college_id and is_active for update;
  if not found then raise exception 'College is unavailable'; end if;
  select * into target from public.dataset_versions where id = p_dataset_id and college_id = p_college_id for update;
  if not found or target.import_status <> 'ready' or target.valid_records <= 0 then
    raise exception 'Only a complete, ready dataset can be activated';
  end if;
  if (select count(*) from public.student_records where dataset_id = p_dataset_id and college_id = p_college_id) <> target.valid_records then
    raise exception 'Imported record count does not match the validated workbook';
  end if;
  update public.dataset_versions set is_active = false where college_id = p_college_id and is_active and id <> p_dataset_id;
  update public.dataset_versions set is_active = true, activated_at = now() where id = p_dataset_id and college_id = p_college_id;
  insert into public.upload_history (dataset_id, college_id, uploaded_by, filename, status, summary)
  values (target.id, target.college_id, target.uploaded_by, target.original_filename, 'succeeded', target.validation_summary);
end $$;
revoke all on function public.activate_dataset(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_dataset(uuid, uuid) to service_role;

drop policy if exists "admins_manage_ppri_workbooks" on storage.objects;
drop policy if exists "platform_admin_reads_workbooks" on storage.objects;
create policy "platform_admin_reads_workbooks" on storage.objects for select to authenticated
using (bucket_id = 'ppri-workbooks' and public.is_admin());

commit;

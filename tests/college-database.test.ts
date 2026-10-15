import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const ADMIN = "20000000-0000-4000-8000-000000000001";
const VIEWER_A = "20000000-0000-4000-8000-000000000002";
const VIEWER_B = "20000000-0000-4000-8000-000000000003";
const UNASSIGNED = "20000000-0000-4000-8000-000000000004";
const DA = "30000000-0000-4000-8000-000000000001";
const DB = "30000000-0000-4000-8000-000000000002";
const DA2 = "30000000-0000-4000-8000-000000000003";
const LEGACY = "00000000-0000-4000-8000-000000000001";
const LEGACY_DATA = "30000000-0000-4000-8000-000000000004";
let db: PGlite;
const migration = readFileSync("supabase/migrations/202610150001_college_workspaces.sql", "utf8");

async function login(id: string, role = "authenticated") {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function rejected(sql: string, params: unknown[] = []) {
  await db.exec("savepoint denied_action");
  await expect(db.query(sql, params)).rejects.toThrow();
  await db.exec("rollback to savepoint denied_action");
}
async function rows(sql: string) { return (await db.query(sql)).rows; }

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon, service_role;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, anon, service_role;
    grant select on storage.objects to authenticated, anon;
  `);
  // gen_random_uuid is built into PostgreSQL; the WASM runtime doesn't bundle pgcrypto.
  await db.exec(readFileSync("supabase/migrations/202608120001_ppri_dashboard.sql", "utf8").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(`
    insert into public.dataset_versions(id,original_filename,storage_path,is_active,import_status,valid_records) values ('${LEGACY_DATA}','original.xlsx','old/original.xlsx',true,'ready',1);
    insert into public.student_records(dataset_id,uid,student_name,data) values ('${LEGACY_DATA}','legacy','Existing student','{}');
  `);
  await db.exec(migration);
  await db.exec(migration); // Rerunning must preserve the migrated workbook and settings.
  await db.exec(`
    insert into public.colleges(id,code,name) values ('${A}','RCOEM','RCOEM'),('${B}','YCCE','YCCE');
    insert into auth.users(id,email) values ('${ADMIN}','admin@example.test'),('${VIEWER_A}','a@example.test'),('${VIEWER_B}','b@example.test'),('${UNASSIGNED}','new@example.test');
    update public.profiles set role='admin', username='platform.admin' where id='${ADMIN}';
    update public.profiles set college_id='${A}', username='Viewer1.RCOEM' where id='${VIEWER_A}';
    update public.profiles set college_id='${B}', username='Viewer1.YCCE' where id='${VIEWER_B}';
    insert into public.dataset_versions(id,college_id,original_filename,storage_path,import_status,valid_records) values
      ('${DA}','${A}','a.xlsx','${A}/a.xlsx','ready',1),('${DB}','${B}','b.xlsx','${B}/b.xlsx','ready',1),('${DA2}','${A}','a2.xlsx','${A}/a2.xlsx','ready',1);
    insert into public.student_records(dataset_id,college_id,uid,student_name,data) values
      ('${DA}','${A}','SAME-UID','Student A','{}'),('${DB}','${B}','SAME-UID','Student B','{}'),('${DA2}','${A}','NEW','Student A2','{}');
    insert into public.dashboard_settings(college_id,settings) values ('${A}','{"instituteName":"RCOEM"}'),('${B}','{"instituteName":"YCCE"}');
    insert into public.data_quality_results(dataset_id,college_id,check_name,severity) values ('${DA}','${A}','scores','info'),('${DB}','${B}','scores','info');
    insert into storage.objects(bucket_id,name) values ('ppri-workbooks','${A}/a.xlsx'),('ppri-workbooks','${B}/b.xlsx');
    select public.activate_dataset('${A}','${DA}'); select public.activate_dataset('${B}','${DB}');
  `);
}, 60000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback; reset role"); });
afterAll(async () => { await db?.close(); });

describe("College isolation in PostgreSQL", () => {
  it("preserves existing data and settings under the legacy college", async () => {
    expect(await rows(`select college_id from public.dataset_versions where id='${LEGACY_DATA}'`)).toEqual([{ college_id: LEGACY }]);
    expect(await rows(`select college_id from public.dashboard_settings where college_id='${LEGACY}'`)).toHaveLength(1);
  });
  it("limits each viewer's direct database reads to their own active dataset", async () => {
    for (const [viewer, college, name] of [[VIEWER_A, A, "Student A"], [VIEWER_B, B, "Student B"]]) {
      await login(viewer);
      expect(await rows("select id from public.colleges")).toEqual([{ id: college }]);
      expect(await rows("select student_name from public.student_records")).toEqual([{ student_name: name }]);
      expect(await rows("select college_id from public.dashboard_settings")).toEqual([{ college_id: college }]);
      expect(await rows("select college_id from public.data_quality_results")).toEqual([{ college_id: college }]);
      expect(await rows("select id from public.dataset_versions")).toHaveLength(1);
      expect(await rows("select * from public.upload_history")).toEqual([]);
      expect(await rows("select * from storage.objects")).toEqual([]);
    }
  });
  it("fails closed for unassigned and deactivated colleges", async () => {
    await login(UNASSIGNED);
    expect(await rows("select * from public.student_records")).toEqual([]);
    await db.exec(`reset role; update public.colleges set is_active=false where id='${A}'`);
    await login(VIEWER_A);
    expect(await rows("select * from public.student_records")).toEqual([]);
    expect(await rows("select * from public.colleges")).toEqual([]);
  });
  it("prevents viewers changing their assignment, role, settings or data", async () => {
    await login(VIEWER_A);
    await rejected("update public.profiles set role='admin',college_id=null where id=$1", [VIEWER_A]);
    await rejected("update public.profiles set college_id=$1 where id=$2", [B, VIEWER_A]);
    await rejected("update public.dashboard_settings set settings='{}' where college_id=$1", [A]);
    await rejected("delete from public.student_records where college_id=$1", [A]);
    await rejected("select public.activate_dataset($1,$2)", [A, DA2]);
  });
  it("does not allow a signed-in administrator to bypass the protected application write routes", async () => {
    await login(ADMIN);
    expect(await rows("select id from public.colleges")).toHaveLength(3);
    expect(await rows("select * from storage.objects")).toHaveLength(2);
    await rejected("select public.activate_dataset($1,$2)", [A, DA2]);
    await rejected("update public.dataset_versions set is_active=false where college_id=$1", [A]);
  });
  it("activates and restores A without changing B", async () => {
    await login(ADMIN, "service_role");
    await db.query("select public.activate_dataset($1,$2)", [A, DA2]);
    expect(await rows(`select id from public.dataset_versions where college_id='${B}' and is_active`)).toEqual([{ id: DB }]);
    expect(await rows(`select id from public.dataset_versions where college_id='${A}' and is_active`)).toEqual([{ id: DA2 }]);
    await db.query("select public.activate_dataset($1,$2)", [A, DA]);
    expect(await rows(`select id from public.dataset_versions where college_id='${A}' and is_active`)).toEqual([{ id: DA }]);
  });
  it("rejects mismatched college/dataset pairs and incomplete imports without losing active data", async () => {
    await login(ADMIN, "service_role");
    await rejected("select public.activate_dataset($1,$2)", [B, DA2]);
    await db.query("update public.dataset_versions set valid_records=2 where id=$1", [DA2]);
    await rejected("select public.activate_dataset($1,$2)", [A, DA2]);
    expect(await rows(`select id from public.dataset_versions where college_id='${A}' and is_active`)).toEqual([{ id: DA }]);
    await rejected("insert into public.student_records(dataset_id,college_id,uid,student_name,data) values ($1,$2,'forged','forged','{}')", [DA, B]);
  });
  it("enforces one platform administrator and exact college suffixes", async () => {
    await rejected("update public.profiles set role='admin',college_id=null,username='other.admin' where id=$1", [VIEWER_A]);
    await rejected("update public.profiles set username='viewer1.YCCE' where id=$1", [VIEWER_A]);
    await rejected("update public.profiles set username='viewer1.RCOEM.fake' where id=$1", [VIEWER_A]);
    expect(await rows(`select username from public.profiles where id='${VIEWER_A}'`)).toEqual([{ username: "viewer1.rcoem" }]);
  });
  it("allows future colleges and viewers without changing application code", async () => {
    const { rows: [college] } = await db.query<{ id: string }>("insert into public.colleges(code,name) values ('ABC','ABC College') returning id");
    await db.query("update public.profiles set college_id=$1,username='new.ABC' where id=$2", [college.id, UNASSIGNED]);
    await login(UNASSIGNED);
    expect(await rows("select code from public.colleges")).toEqual([{ code: "ABC" }]);
    expect(await rows("select * from public.student_records")).toEqual([]);
  });
  it("updates username suffixes when a college code is renamed", async () => {
    await db.query("update public.colleges set code='RCOEM_NEW' where id=$1", [A]);
    expect(await rows(`select username from public.profiles where id='${VIEWER_A}'`)).toEqual([{ username: "viewer1.rcoem_new" }]);
  });
});

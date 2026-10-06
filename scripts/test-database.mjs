import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";

// Actual Postgres/RLS execution with minimal Supabase Auth/publication stubs.
// Supabase API, Auth configuration and realtime delivery are tested separately.
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
    $$;
    grant usage on schema auth, public to anon,authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon,authenticated;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
    create publication supabase_realtime;
  `);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(f => f.endsWith(".sql")).sort();
  for (const file of files) {
    try { await db.exec(await readFile(new URL(file, directory), "utf8")); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message} (position ${error.position ?? "unknown"})`); }
  }
  console.log(`PASS: replayed ${files.length} migrations into empty Postgres`);
  const tests = new URL("../supabase/tests/", import.meta.url);
  for (const file of (await readdir(tests)).filter(f => f.endsWith(".sql")).sort()) {
    let results;
    try { results = await db.exec(await readFile(new URL(file, tests), "utf8")); }
    catch (error) { throw new Error(`Test ${file}: ${error.message} (${error.code}, ${error.where ?? ""})`); }
    console.log(`PASS: ${file}`, results.flatMap(r => r.rows).filter(r => r.result));
  }
} finally {
  await db.close();
}

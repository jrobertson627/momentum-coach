import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = join(import.meta.dirname, '..', 'migrations')

/**
 * The parts of Supabase the migrations rely on: the auth schema, auth.uid(),
 * and the anon/authenticated/service_role roles with the hosted project's
 * default privileges.
 */
const supabaseStub = `
  create role anon nologin;
  create role authenticated nologin;

  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Newer Supabase projects don't grant read/write on new tables to the API
  -- roles by default (only TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), so
  -- migrations must grant table access explicitly.
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to service_role;
  alter default privileges in schema public
    grant truncate, references, trigger, maintain on tables
    to anon, authenticated, service_role;
  -- Likewise, new functions aren't executable by PUBLIC.
  alter default privileges in schema public
    revoke execute on functions from public;
`

/** A fresh in-memory Postgres with every migration applied. */
export async function createTestDb() {
  const db = new PGlite()
  await db.exec(supabaseStub)
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
  return db
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>

/** Creates an auth user and returns its id. Runs as the superuser. */
export async function createUser(db: TestDb): Promise<string> {
  await db.exec('reset role')
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (id) values (gen_random_uuid()) returning id',
  )
  return rows[0].id
}

/** Switches the session to act as a signed-in user, or as anon when null. */
export async function actAs(db: TestDb, userId: string | null) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? '',
  ])
  await db.exec(userId ? 'set role authenticated' : 'set role anon')
}

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * Supabase serves a REST API over every table in `public`. With Row-Level
 * Security off, anyone with the project ref and the anon key could read and
 * write all of it — this app never uses that API, but the endpoint exists
 * whether we use it or not.
 *
 * RLS is therefore on everywhere, with no policies, which denies the `anon`
 * and `authenticated` roles everything. The app is unaffected because it
 * connects as the table owner, which bypasses RLS. These tests pin both
 * halves of that: the protection is on, and the app still works.
 */

let server
let member

before(async () => {
  server = await startServer()
  member = await signUpUser(server, { gender: 'male' })
})
after(async () => { await server?.stop() })

describe('row-level security', () => {
  test('every table in public has it enabled', async () => {
    const rows = await server.sql(
      `SELECT c.relname AS table_name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
        ORDER BY 1`
    )
    assert.deepEqual(
      rows.map((r) => r.table_name),
      [],
      'these tables are readable and writable through the Supabase REST API',
    )
  })

  test('it is not FORCEd, which would lock out the app itself', async () => {
    // The server connects as the owner and relies on the owner bypass. FORCE
    // removes that bypass, so every query would start failing.
    const rows = await server.sql(
      `SELECT c.relname AS table_name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity = true`
    )
    assert.deepEqual(rows.map((r) => r.table_name), [])
  })

  test('the app still reads and writes normally', async () => {
    const save = await server.request('PUT', '/api/matrimony/me', {
      token: member.token,
      body: { profile: { religion: 'Hindu', village: 'Kadi' } },
    })
    assert.equal(save.status, 200)

    const read = await server.request('GET', '/api/matrimony/me', { token: member.token })
    assert.equal(read.status, 200)
    assert.equal(read.body.data.profile.religion, 'Hindu')
    assert.equal(read.body.data.profile.village, 'Kadi')
  })

  test('browsing and the guide still work', async () => {
    const profiles = await server.request('GET', '/api/matrimony/profiles', { token: member.token })
    assert.equal(profiles.status, 200)

    const guide = await server.request('GET', '/api/guide?lang=en-IN', { token: member.token })
    assert.equal(guide.status, 200)
    assert.ok(guide.body.data.length > 0)
  })
})

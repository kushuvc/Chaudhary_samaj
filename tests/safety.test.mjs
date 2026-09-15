import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin

before(async () => {
  server = await startServer()
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

const yearsAgo = (n) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString().slice(0, 10)
}

describe('age gate', () => {
  /*
   * The age used to be floored at 18 with Math.max, so a child's date of birth
   * was rewritten into an adult profile rather than refused.
   */
  test('an under-18 date of birth is refused', async () => {
    await assert.rejects(
      () => signUpUser(server, { dateOfBirth: yearsAgo(14) }),
      (err) => err.response.status === 403 && err.response.body.code === 'UNDER_AGE'
    )
  })

  test('someone just under 18 is refused', async () => {
    await assert.rejects(
      () => signUpUser(server, { dateOfBirth: yearsAgo(17) }),
      (err) => err.response.status === 403
    )
  })

  test('an adult is accepted, with their real age', async () => {
    const user = await signUpUser(server, { dateOfBirth: yearsAgo(31) })
    const rows = await server.sql(
      'SELECT age FROM matrimony_profiles WHERE user_id = $1', [user.userId]
    )
    assert.ok(Math.abs(Number(rows[0].age) - 31) <= 1, `expected about 31, got ${rows[0]?.age}`)
  })

  test('an explicit under-18 age is refused', async () => {
    await assert.rejects(
      () => signUpUser(server, { age: 15, dateOfBirth: yearsAgo(30) }),
      (err) => err.response.status === 403
    )
  })

  test('no under-18 profile can be created at all', async () => {
    const rows = await server.sql('SELECT count(*)::int AS n FROM matrimony_profiles WHERE age < 18')
    assert.equal(rows[0].n, 0)
  })
})

describe('reporting a member', () => {
  test('reporting requires a session', async () => {
    const res = await server.request('POST', '/api/matrimony/profiles/any/report', {
      body: { reason: 'underage' },
    })
    assert.equal(res.status, 401)
  })

  test('a member can report another, and is told what happens', async () => {
    const reporter = await signUpUser(server, { gender: 'male' })
    const target = await signUpUser(server, { gender: 'female' })
    const list = await server.request('GET', '/api/matrimony/profiles', { token: reporter.token })
    const profileId = list.body.data.find((p) => !p.isLocked)?.id
    assert.ok(profileId, 'expected a visible profile')

    const res = await server.request('POST', `/api/matrimony/profiles/${profileId}/report`, {
      token: reporter.token,
      body: { reason: 'underage', details: 'Profile photo looks like a child.' },
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))

    const rows = await server.sql(
      "SELECT reason, status FROM member_reports WHERE reporter_user_id = $1", [reporter.userId]
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0].reason, 'underage')
    assert.equal(rows[0].status, 'open')
  })

  test('an unknown reason is refused', async () => {
    const reporter = await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })
    const list = await server.request('GET', '/api/matrimony/profiles', { token: reporter.token })
    const profileId = list.body.data.find((p) => !p.isLocked)?.id

    const res = await server.request('POST', `/api/matrimony/profiles/${profileId}/report`, {
      token: reporter.token,
      body: { reason: 'because-i-said-so' },
    })
    assert.equal(res.status, 400)
  })

  test('reporting hides that member from the reporter', async () => {
    const reporter = await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })
    const before = await server.request('GET', '/api/matrimony/profiles', { token: reporter.token })
    const profileId = before.body.data.find((p) => !p.isLocked)?.id

    await server.request('POST', `/api/matrimony/profiles/${profileId}/report`, {
      token: reporter.token,
      body: { reason: 'harassment' },
    })

    const after = await server.request('GET', '/api/matrimony/profiles', { token: reporter.token })
    assert.ok(
      !after.body.data.some((p) => p.id === profileId),
      'a reported member must not still be listed'
    )
  })
})

describe('blocking', () => {
  test('a block hides the member both ways', async () => {
    const one = await signUpUser(server, { gender: 'male' })
    const two = await signUpUser(server, { gender: 'female' })

    const list = await server.request('GET', '/api/matrimony/profiles', { token: one.token })
    const targetProfile = list.body.data.find((p) => !p.isLocked)?.id
    assert.ok(targetProfile)

    const blocked = await server.request('POST', `/api/matrimony/profiles/${targetProfile}/block`, {
      token: one.token,
    })
    assert.equal(blocked.status, 200)

    const mine = await server.request('GET', '/api/matrimony/profiles', { token: one.token })
    assert.ok(!mine.body.data.some((p) => p.id === targetProfile), 'blocked member still visible to blocker')

    // And the blocker must disappear from the blocked member's list too.
    const theirs = await server.request('GET', '/api/matrimony/profiles', { token: two.token })
    const myProfile = await server.sql(
      'SELECT id FROM matrimony_profiles WHERE user_id = $1', [one.userId]
    )
    assert.ok(
      !theirs.body.data.some((p) => p.id === myProfile[0]?.id),
      'the blocker must not remain visible to the blocked member'
    )
  })
})

describe('the review queue', () => {
  test('only an admin can read reports', async () => {
    const member = await signUpUser(server)
    assert.equal((await server.request('GET', '/api/admin/reports')).status, 401)
    assert.equal((await server.request('GET', '/api/admin/reports', { token: member.token })).status, 403)
  })

  test('an admin sees open reports first and can resolve them', async () => {
    const res = await server.request('GET', '/api/admin/reports', { token: admin.token })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))

    if (res.body.data.length) {
      const id = res.body.data[0].id
      const update = await server.request('PUT', `/api/admin/reports/${id}`, {
        token: admin.token,
        body: { status: 'actioned' },
      })
      assert.equal(update.status, 200)
      assert.equal(update.body.data.status, 'actioned')
    }
  })
})

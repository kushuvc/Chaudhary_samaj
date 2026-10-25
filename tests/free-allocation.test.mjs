import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * The free allowance has to be the same profiles every time.
 *
 * It used to mean "the first N of the current ordering", and that ordering is
 * newest-first, so each new registration swapped out both of a free member's
 * profiles — unlimited free browsing for anyone patient enough to wait for
 * the next signup, and never the same two twice.
 */

const FREE_LIMIT = 2

let server
let browser

before(async () => {
  server = await startServer()
  browser = await signUpUser(server, { gender: 'male' })
  for (let i = 0; i < 4; i += 1) {
    await signUpUser(server, { gender: 'female', fullName: `Member ${i}`, age: 24 + i })
  }
})
after(async () => { await server?.stop() })

async function unlockedIds(query = '') {
  const res = await server.request('GET', `/api/matrimony/profiles?limit=50${query}`, { token: browser.token })
  assert.equal(res.status, 200)
  return res.body.data.filter((p) => !p.isLocked).map((p) => p.id).sort()
}

describe('the free allowance is a fixed set of profiles', () => {
  test('a free member sees exactly the allowance', async () => {
    const ids = await unlockedIds()
    assert.equal(ids.length, FREE_LIMIT)
  })

  test('new members registering does not change it', async () => {
    const before = await unlockedIds()
    for (let i = 0; i < 3; i += 1) {
      await signUpUser(server, { gender: 'female', fullName: `Newcomer ${i}`, age: 30 + i })
    }

    // The listing is cached per viewer and a signup does not clear it, so
    // without this the newcomers would not be in the list yet and the
    // assertion below would pass for the wrong reason. Shortlisting is the
    // public route that invalidates that cache.
    const someId = before[0]
    await server.request('POST', `/api/matrimony/profiles/${someId}/shortlist`, { token: browser.token })
    await server.request('POST', `/api/matrimony/profiles/${someId}/shortlist`, { token: browser.token })

    const after = await unlockedIds()
    // Guard the guard: the newcomers really are in the list now, and every
    // profile is scored 0 at signup, so newest-first ordering would have put
    // them at the top and taken both free slots.
    const listing = await server.request('GET', '/api/matrimony/profiles?limit=50', { token: browser.token })
    assert.ok(listing.body.pagination.total >= 7, 'the newcomers never reached the list')

    assert.deepEqual(after, before, 'a new registration handed out different free profiles')
  })

  test('filtering does not change it', async () => {
    const before = await unlockedIds()
    assert.deepEqual(await unlockedIds('&minAge=18&maxAge=99'), before)
    assert.deepEqual(await unlockedIds('&search=Member'), before)
  })

  test('sorting does not change it', async () => {
    const before = await unlockedIds()
    assert.deepEqual(await unlockedIds('&sortBy=name'), before)
    assert.deepEqual(await unlockedIds('&sortBy=age'), before)
  })

  test('paging does not change it', async () => {
    const before = await unlockedIds()
    const res = await server.request('GET', '/api/matrimony/profiles?limit=3&offset=3', { token: browser.token })
    assert.equal(res.status, 200)
    const extra = res.body.data.filter((p) => !p.isLocked).map((p) => p.id).filter((id) => !before.includes(id))
    assert.deepEqual(extra, [], 'a later page unlocked profiles outside the allowance')
  })

  test('the detail route allows exactly the same profiles', async () => {
    const allowed = await unlockedIds()
    for (const id of allowed) {
      const res = await server.request('GET', `/api/matrimony/profiles/${id}`, { token: browser.token })
      assert.equal(res.status, 200, 'an allocated profile was refused by the detail route')
    }

    const listing = await server.request('GET', '/api/matrimony/profiles?limit=50', { token: browser.token })
    const locked = listing.body.data.filter((p) => p.isLocked).map((p) => p.id)
    assert.ok(locked.length > 0, 'expected some locked profiles to test against')
    const res = await server.request('GET', `/api/matrimony/profiles/${locked[0]}`, { token: browser.token })
    assert.equal(res.status, 403, 'the detail route handed over a profile the list had locked')
  })

  test('each member gets their own allocation', async () => {
    const other = await signUpUser(server, { gender: 'male' })
    const res = await server.request('GET', '/api/matrimony/profiles?limit=50', { token: other.token })
    assert.equal(res.body.data.filter((p) => !p.isLocked).length, FREE_LIMIT)
  })

  test('subscribing lifts it, and unsubscribing returns the same set', async () => {
    const before = await unlockedIds()
    await server.sql(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, 'premium', 20000, 'test-pay', 'test-order', 'active', $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', expires_at = EXCLUDED.expires_at`,
      [browser.userId, new Date().toISOString(), new Date(Date.now() + 30 * 864e5).toISOString()]
    )
    const all = await unlockedIds()
    assert.ok(all.length > FREE_LIMIT, 'a subscription did not unlock everything')

    await server.sql('DELETE FROM user_subscriptions WHERE user_id = $1', [browser.userId])
    assert.deepEqual(await unlockedIds(), before, 'the allowance changed across a subscription')
  })
})

describe('the allowance is the first members to register', () => {
  let s
  let viewer
  let admin
  const women = []
  // Through the admin route, as the panel does, so the rules cache is cleared.
  const setLimit = async (n) => {
    const res = await s.request('PUT', '/api/admin/subscription-rules/male', {
      token: admin.token, body: { isFree: false, freeProfileLimit: n },
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
  }
  before(async () => {
    s = await startServer()
    viewer = await signUpUser(s, { gender: 'male' })
    admin = await signUpUser(s, { gender: 'male' })
    await s.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
    await setLimit(2)
    for (let i = 0; i < 4; i += 1) women.push(await signUpUser(s, { gender: 'female', fullName: `Early ${i}` }))
    // Spread registration times so the order is unambiguous.
    for (let i = 0; i < women.length; i += 1) {
      await s.sql(`UPDATE matrimony_profiles SET created_at = $2 WHERE user_id = $1`, [women[i].userId, `2026-0${i + 1}-01T00:00:00.000Z`])
    }
  })
  after(async () => { await s?.stop() })

  const profileIdOf = async (user) => (await s.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [user.userId]))[0].id
  async function list() {
    const res = await s.request('GET', '/api/matrimony/profiles?limit=50', { token: viewer.token })
    assert.equal(res.status, 200)
    return res.body.data
  }

  test('the two unlocked are the two earliest, and are listed first', async () => {
    const data = await list()
    const expected = [await profileIdOf(women[0]), await profileIdOf(women[1])]
    assert.deepEqual(data.filter((p) => !p.isLocked).map((p) => p.id).sort(), expected.sort())
    assert.equal(data[0].isLocked, undefined)
    assert.equal(data[1].isLocked, undefined)
  })

  test('if one of them deletes their account, the next in line opens', async () => {
    await s.request('DELETE', '/api/auth/account', { token: women[0].token })
    const open = (await list()).filter((p) => !p.isLocked).map((p) => p.id).sort()
    assert.deepEqual(open, [await profileIdOf(women[1]), await profileIdOf(women[2])].sort())
  })

  test('raising the allowance opens the next earliest', async () => {
    await setLimit(3)
    const open = (await list()).filter((p) => !p.isLocked).map((p) => p.id).sort()
    assert.deepEqual(open, [await profileIdOf(women[1]), await profileIdOf(women[2]), await profileIdOf(women[3])].sort())
  })

  test('the detail screen agrees with the list', async () => {
    await setLimit(1)
    const first = await profileIdOf(women[1])
    const later = await profileIdOf(women[3])
    assert.equal((await s.request('GET', `/api/matrimony/profiles/${first}`, { token: viewer.token })).status, 200)
    assert.equal((await s.request('GET', `/api/matrimony/profiles/${later}`, { token: viewer.token })).status, 403)
  })
})

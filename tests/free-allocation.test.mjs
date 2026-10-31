import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * The free allowance has to be the same profiles every time (a random pick per
 * member since 31 Oct 2026, kept once made).
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

describe('the allowance is a random pick, kept per member', () => {
  let s
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
    admin = await signUpUser(s, { gender: 'male' })
    await s.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
    await setLimit(2)
    for (let i = 0; i < 10; i += 1) women.push(await signUpUser(s, { gender: 'female', fullName: `Woman ${i}` }))
    for (let i = 0; i < women.length; i += 1) {
      await s.sql(`UPDATE matrimony_profiles SET created_at = $2 WHERE user_id = $1`, [women[i].userId, `2026-0${(i % 9) + 1}-0${(i % 7) + 1}T00:00:00.000Z`])
    }
  })
  after(async () => { await s?.stop() })

  const profileIdOf = async (user) => (await s.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [user.userId]))[0].id
  async function list(viewer) {
    const res = await s.request('GET', '/api/matrimony/profiles?limit=50', { token: viewer.token })
    assert.equal(res.status, 200)
    return res.body.data
  }
  const openIds = async (viewer) => (await list(viewer)).filter((p) => !p.isLocked).map((p) => p.id).sort()
  // The listing is cached per viewer for a few seconds; a shortlist toggle is
  // the public route that clears it.
  async function fresh(viewer, anyId) {
    await s.request('POST', `/api/matrimony/profiles/${anyId}/shortlist`, { token: viewer.token })
    await s.request('POST', `/api/matrimony/profiles/${anyId}/shortlist`, { token: viewer.token })
  }

  test('members get different pairs, not always the earliest two', async () => {
    const seen = new Set()
    const pairs = new Set()
    for (let i = 0; i < 12; i += 1) {
      const viewer = await signUpUser(s, { gender: 'male' })
      const open = await openIds(viewer)
      assert.equal(open.length, 2)
      open.forEach((id) => seen.add(id))
      pairs.add(open.join())
    }
    // 12 random pairs from 10 profiles: all the same, or never beyond the
    // earliest two, would mean it is not random (odds well under one in a million).
    assert.ok(pairs.size > 1, 'every member got the same pair')
    assert.ok(seen.size > 2, 'only two profiles were ever handed out')
  })

  test('the pick is listed first and stays the same on every request', async () => {
    const viewer = await signUpUser(s, { gender: 'male' })
    const data = await list(viewer)
    assert.equal(data[0].isLocked, undefined)
    assert.equal(data[1].isLocked, undefined)
    const first = await openIds(viewer)
    for (let i = 0; i < 3; i += 1) {
      await fresh(viewer, first[0])
      assert.deepEqual(await openIds(viewer), first)
    }
  })

  test('if a picked member deletes their account, one new random profile replaces only that one', async () => {
    const viewer = await signUpUser(s, { gender: 'male' })
    const [gone, stays] = await openIds(viewer)
    const ids = await Promise.all(women.map(profileIdOf))
    const owner = women[ids.indexOf(gone)]
    await s.request('DELETE', '/api/auth/account', { token: owner.token })
    women.splice(women.indexOf(owner), 1)
    await fresh(viewer, stays)
    const open = await openIds(viewer)
    assert.equal(open.length, 2)
    assert.ok(open.includes(stays), 'the profile that did not go was swapped too')
    assert.ok(!open.includes(gone))
  })

  test('blocking one of your own picks does not deal a new one', async () => {
    const viewer = await signUpUser(s, { gender: 'male' })
    const [blocked, other] = await openIds(viewer)
    await s.request('POST', `/api/matrimony/profiles/${blocked}/block`, { token: viewer.token })
    await fresh(viewer, other)
    assert.deepEqual(await openIds(viewer), [other])
  })

  test('if a picked member blocks the viewer, it is replaced', async () => {
    const viewer = await signUpUser(s, { gender: 'male' })
    const viewerProfile = await profileIdOf(viewer)
    const [lost, other] = await openIds(viewer)
    const ids = await Promise.all(women.map(profileIdOf))
    const owner = women[ids.indexOf(lost)]
    await s.request('POST', `/api/matrimony/profiles/${viewerProfile}/block`, { token: owner.token })
    await fresh(viewer, other)
    const open = await openIds(viewer)
    assert.equal(open.length, 2)
    assert.ok(open.includes(other) && !open.includes(lost))
  })

  test('raising the allowance keeps the pick and adds to it; the detail screen agrees', async () => {
    const viewer = await signUpUser(s, { gender: 'male' })
    const before = await openIds(viewer)
    await setLimit(3)
    await fresh(viewer, before[0])
    const after = await openIds(viewer)
    assert.equal(after.length, 3)
    assert.ok(before.every((id) => after.includes(id)))

    const all = (await list(viewer)).map((p) => p.id)
    const locked = all.find((id) => !after.includes(id))
    assert.equal((await s.request('GET', `/api/matrimony/profiles/${after[0]}`, { token: viewer.token })).status, 200)
    assert.equal((await s.request('GET', `/api/matrimony/profiles/${locked}`, { token: viewer.token })).status, 403)
    await setLimit(2)
  })
})

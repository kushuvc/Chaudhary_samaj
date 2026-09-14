import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

const FREE_LIMIT = 2

let server
let browser        // the member doing the browsing
let others         // profiles they can browse

before(async () => {
  server = await startServer()
  browser = await signUpUser(server, { gender: 'male' })
  others = []
  for (let i = 0; i < 5; i += 1) {
    others.push(await signUpUser(server, { gender: 'female', fullName: `Other ${i}` }))
  }
})
after(async () => { await server?.stop() })

/** Grants an active subscription the way a verified payment would. */
async function grantSubscription(userId) {
  const expires = new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
  await server.sql(
    `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
     VALUES ($1, 'premium', 20000, 'test-pay', 'test-order', 'active', $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET status = 'active', expires_at = EXCLUDED.expires_at`,
    [userId, new Date().toISOString(), expires]
  )
}

async function clearSubscription(userId) {
  await server.sql('DELETE FROM user_subscriptions WHERE user_id = $1', [userId])
}

describe('profile list paywall', () => {
  test('browsing requires authentication', async () => {
    const res = await server.request('GET', '/api/matrimony/profiles')
    assert.equal(res.status, 401)
  })

  test('a free member sees only the free allowance unlocked', async () => {
    await clearSubscription(browser.userId)
    const res = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    assert.equal(res.status, 200)

    const list = res.body.data
    assert.ok(Array.isArray(list) && list.length > FREE_LIMIT, 'need more profiles than the free limit to test')

    const unlocked = list.filter((p) => !p.isLocked)
    assert.equal(unlocked.length, FREE_LIMIT, `expected exactly ${FREE_LIMIT} unlocked`)
    assert.equal(res.body.access.subscribed, false)
  })

  /*
   * The paywall was decorative: the server sent every field and the app just
   * drew a blur over it, so the real data was one devtools panel away.
   */
  test('a locked profile carries no personal data whatsoever', async () => {
    await clearSubscription(browser.userId)
    const res = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    const locked = res.body.data.filter((p) => p.isLocked)
    assert.ok(locked.length > 0, 'expected at least one locked profile')

    for (const profile of locked) {
      assert.deepEqual(
        Object.keys(profile).sort(),
        ['id', 'isLocked'],
        `a locked profile must expose only id and isLocked, got: ${Object.keys(profile).join(', ')}`
      )
    }
  })

  test('a subscriber sees every profile unlocked', async () => {
    await grantSubscription(browser.userId)
    const res = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.access.subscribed, true)
    assert.equal(res.body.data.filter((p) => p.isLocked).length, 0)
    await clearSubscription(browser.userId)
  })

  test('an expired subscription does not unlock anything', async () => {
    const past = new Date(Date.now() - 24 * 3600_000).toISOString()
    await server.sql(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, 'premium', 20000, 'test-pay', 'test-order', 'active', $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', expires_at = EXCLUDED.expires_at`,
      [browser.userId, past, past]
    )
    const res = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    assert.equal(res.body.access.subscribed, false, 'an expired row must not count as active')
    await clearSubscription(browser.userId)
  })

  test('a cancelled subscription does not unlock anything', async () => {
    const future = new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
    await server.sql(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, 'premium', 20000, 'test-pay', 'test-order', 'cancelled', $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET status = 'cancelled', expires_at = EXCLUDED.expires_at`,
      [browser.userId, new Date().toISOString(), future]
    )
    const res = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    assert.equal(res.body.access.subscribed, false, 'status must be checked, not just expiry')
    await clearSubscription(browser.userId)
  })
})

describe('profile detail paywall', () => {
  /*
   * This route was fully public: it called resolveUserId but ignored the
   * result, so anyone could read any profile by id without even a token.
   */
  test('reading a profile by id requires authentication', async () => {
    const list = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    const someId = list.body.data[0].id
    const res = await server.request('GET', `/api/matrimony/profiles/${someId}`)
    assert.equal(res.status, 401, 'the detail route must not be public')
  })

  test('a free member cannot open a profile beyond the free allowance', async () => {
    await clearSubscription(browser.userId)
    const list = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    const lockedId = list.body.data.find((p) => p.isLocked)?.id
    assert.ok(lockedId, 'expected a locked profile')

    const res = await server.request('GET', `/api/matrimony/profiles/${lockedId}`, { token: browser.token })
    assert.equal(res.status, 403, 'a locked profile must not be readable by id')
    const text = JSON.stringify(res.body)
    assert.ok(!/phone|email/i.test(text) || !res.body.data, 'no contact detail may leak in the refusal')
  })

  test('a free member can open a profile inside the free allowance', async () => {
    await clearSubscription(browser.userId)
    const list = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    const openId = list.body.data.find((p) => !p.isLocked)?.id
    assert.ok(openId, 'expected an unlocked profile')

    const res = await server.request('GET', `/api/matrimony/profiles/${openId}`, { token: browser.token })
    assert.equal(res.status, 200)
  })

  test('a subscriber can open any profile', async () => {
    await grantSubscription(browser.userId)
    const list = await server.request('GET', '/api/matrimony/profiles', { token: browser.token })
    const anyId = list.body.data[list.body.data.length - 1].id

    const res = await server.request('GET', `/api/matrimony/profiles/${anyId}`, { token: browser.token })
    assert.equal(res.status, 200)
    await clearSubscription(browser.userId)
  })
})

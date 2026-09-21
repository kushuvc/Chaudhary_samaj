import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * The filter sheet has offered Name and Age since it shipped, and the app has
 * sent `sortBy` on every request — the endpoint simply never read it, so the
 * chip lit up and the list did not move.
 */

let server
let browser
const NAMES = ['Zara Patel', 'anita Chaudhary', 'Meera Desai', 'Bhavna Shah']
const AGES = [34, 22, 41, 28]

before(async () => {
  server = await startServer()
  browser = await signUpUser(server, { gender: 'male' })
  for (let i = 0; i < NAMES.length; i += 1) {
    await signUpUser(server, { gender: 'female', fullName: NAMES[i], age: AGES[i] })
  }
  // Sorting must be visible to the member doing the sorting, not hidden behind
  // the free allowance, so this browser pays.
  await server.sql(
    `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
     VALUES ($1, 'premium', 20000, 'test-pay', 'test-order', 'active', $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET status = 'active', expires_at = EXCLUDED.expires_at`,
    [browser.userId, new Date().toISOString(), new Date(Date.now() + 30 * 864e5).toISOString()]
  )
})
after(async () => { await server?.stop() })

async function list(params = '') {
  const res = await server.request('GET', `/api/matrimony/profiles?limit=50${params}`, { token: browser.token })
  assert.equal(res.status, 200)
  return res.body.data
}

describe('sorting the profile list', () => {
  test('sortBy=name orders by name, ignoring case', async () => {
    const names = (await list('&sortBy=name')).map((p) => p.name)
    const expected = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    assert.deepEqual(names, expected)
    // Lower-cased "anita" must lead, not trail after every capital letter the
    // way a plain code-unit comparison would put it.
    assert.equal(names[0], 'anita Chaudhary')
  })

  test('sortBy=age orders youngest first', async () => {
    const ages = (await list('&sortBy=age')).map((p) => p.age)
    assert.deepEqual(ages, [...ages].sort((a, b) => a - b))
  })

  test('an unknown sort value is ignored rather than erroring', async () => {
    const res = await server.request('GET', '/api/matrimony/profiles?sortBy=salary', { token: browser.token })
    assert.equal(res.status, 200)
  })

  test('sorting cannot walk a free member through extra profiles', async () => {
    // The free allowance is a fixed set of profiles, not "the first N of
    // whatever order you asked for" — otherwise ascending then descending
    // hands over two different free sets.
    await server.sql('DELETE FROM user_subscriptions WHERE user_id = $1', [browser.userId])
    const unlockedIds = async (params) =>
      (await list(params)).filter((p) => !p.isLocked).map((p) => p.id).sort()

    const plain = await unlockedIds('')
    const byName = await unlockedIds('&sortBy=name')
    const byAge = await unlockedIds('&sortBy=age')

    assert.deepEqual(byName, plain, 'sorting by name revealed a different free set')
    assert.deepEqual(byAge, plain, 'sorting by age revealed a different free set')
  })
})

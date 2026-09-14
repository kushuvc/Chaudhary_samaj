import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let member
let admin

before(async () => {
  server = await startServer()
  member = await signUpUser(server)
  admin = await signUpUser(server)
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

describe('admin routes', () => {
  for (const route of ['/api/admin/stats', '/api/admin/users']) {
    test(`${route} rejects an anonymous caller`, async () => {
      const res = await server.request('GET', route)
      assert.equal(res.status, 401)
    })

    test(`${route} rejects an ordinary signed-in member`, async () => {
      const res = await server.request('GET', route, { token: member.token })
      assert.equal(res.status, 403, 'a normal account must not read admin data')
    })

    test(`${route} allows an admin`, async () => {
      const res = await server.request('GET', route, { token: admin.token })
      assert.equal(res.status, 200)
    })
  }

  test('admin status cannot be claimed through a header', async () => {
    const res = await server.request('GET', '/api/admin/users', {
      token: member.token,
      headers: { 'x-is-admin': 'true', 'x-admin': '1' },
    })
    assert.equal(res.status, 403)
  })
})

describe('removed debug surface', () => {
  // These routes dumped table contents and ran arbitrary column migrations
  // over plain HTTP with no authentication at all.
  const gone = [
    ['POST', '/api/migrate-columns'],
    ['GET', '/api/debug/users'],
    ['GET', '/api/debug/profiles'],
    ['GET', '/api/debug/tables'],
    ['GET', '/api/debug/schema'],
  ]

  for (const [method, route] of gone) {
    test(`${method} ${route} no longer exists`, async () => {
      const res = await server.request(method, route)
      assert.equal(res.status, 404, `${route} must not be reachable`)
    })
  }
})

describe('cross-account access', () => {
  test('one member cannot read another member\'s settings', async () => {
    const other = await signUpUser(server)
    const res = await server.request('GET', '/api/settings', {
      token: member.token,
      headers: { 'x-user-id': other.userId },
    })
    if (res.status === 200) {
      const text = JSON.stringify(res.body)
      assert.ok(!text.includes(other.email), 'must not return the other account\'s data')
    }
  })

  test('deleting an account requires authentication', async () => {
    const res = await server.request('DELETE', '/api/auth/account')
    assert.equal(res.status, 401)
  })
})

describe('payment endpoints', () => {
  test('Play purchase verification requires authentication', async () => {
    const res = await server.request('POST', '/api/payments/play/verify', {
      body: { purchaseToken: 'fake-token' },
    })
    assert.equal(res.status, 401)
  })

  test('a fabricated Play token does not grant a subscription', async () => {
    const res = await server.request('POST', '/api/payments/play/verify', {
      token: member.token,
      body: { purchaseToken: 'totally-made-up-token' },
    })
    assert.notEqual(res.status, 200, 'an unverified token must never be accepted')

    const rows = await server.sql(
      "SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = 'active'",
      [member.userId]
    )
    assert.equal(rows.length, 0, 'no subscription may be created from an unverified token')
  })

  test('the subscription status route requires authentication', async () => {
    const res = await server.request('GET', '/api/payments/subscription')
    assert.equal(res.status, 401)
  })

  test('a member cannot grant themselves a subscription through the API', async () => {
    const res = await server.request('POST', '/api/payments/verify', {
      token: member.token,
      body: { razorpay_payment_id: 'fake', razorpay_order_id: 'fake', razorpay_signature: 'fake' },
    })
    assert.notEqual(res.status, 200, 'an unsigned payment must be rejected')
  })
})

describe('security headers and errors', () => {
  test('an unknown route returns a JSON 404, not a stack trace', async () => {
    const res = await server.request('GET', '/api/definitely-not-a-route')
    assert.equal(res.status, 404)
    assert.equal(res.body.success, false)
  })

  test('a malformed JSON body does not leak a stack trace', async () => {
    const raw = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    })
    const text = await raw.text()
    assert.ok(!text.includes('at Object.'), 'must not return a stack trace')
    assert.ok(!text.includes('/Users/'), 'must not leak filesystem paths')
  })
})

describe('member data is not public', () => {
  /*
   * These routes served member data to anyone on the internet with no token.
   * The help requests are the sharpest case — the app files them under
   * financial and medical help — and the business listings carry each owner's
   * name, phone number and email.
   */
  const routes = [
    '/api/help-requests',
    '/api/help-requests/some-id',
    '/api/business/listings',
    '/api/business/listings/some-id',
    '/api/community/posts',
    '/api/community/meetings',
    '/api/community/stats',
    '/api/matrimony/saved-filters',
  ]

  for (const route of routes) {
    test(`GET ${route} requires a session`, async () => {
      const res = await server.request('GET', route)
      assert.equal(res.status, 401, `${route} must not be readable without a token`)
    })

    test(`GET ${route} still works for a member`, async () => {
      const res = await server.request('GET', route, { token: member.token })
      assert.notEqual(res.status, 401, `${route} must remain available to signed-in members`)
    })
  }

  test('no contact details leak to an anonymous caller', async () => {
    const res = await server.request('GET', '/api/business/listings')
    const text = JSON.stringify(res.body)
    assert.ok(!/contact_phone|contactPhone|@/.test(text), 'no contact data may appear')
  })
})

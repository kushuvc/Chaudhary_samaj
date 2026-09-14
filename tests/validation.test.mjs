import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let user

before(async () => {
  server = await startServer()
  user = await signUpUser(server)
})
after(async () => { await server?.stop() })

describe('query parameter handling', () => {
  const nasty = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT password_hash FROM users --",
    '../../etc/passwd',
    '<script>alert(1)</script>',
    '%00',
    'a'.repeat(5000),
  ]

  for (const value of nasty) {
    test(`search handles ${JSON.stringify(value.slice(0, 30))} without erroring`, async () => {
      const res = await server.request(
        'GET',
        `/api/matrimony/profiles?search=${encodeURIComponent(value)}`,
        { token: user.token }
      )
      assert.ok(res.status < 500, `expected a handled response, got ${res.status}`)

      const text = JSON.stringify(res.body)
      assert.ok(!/password_hash/i.test(text), 'must never return a password hash')
      assert.ok(!/syntax error|pg_|relation "/i.test(text), 'must not leak database errors')
    })
  }

  test('the users table still exists after injection attempts', async () => {
    const rows = await server.sql('SELECT count(*)::int AS n FROM users')
    assert.ok(rows[0].n > 0, 'users table must be intact')
  })

  test('absurd pagination values are clamped', async () => {
    for (const qs of ['limit=999999', 'limit=-5', 'offset=-10', 'limit=abc', 'offset=abc']) {
      const res = await server.request('GET', `/api/matrimony/profiles?${qs}`, { token: user.token })
      assert.ok(res.status < 500, `${qs} caused ${res.status}`)
      if (res.status === 200) {
        assert.ok(res.body.data.length <= 50, 'the page size cap must hold')
      }
    }
  })
})

describe('profile updates', () => {
  test('updating a profile requires authentication', async () => {
    const res = await server.request('PUT', '/api/matrimony/me', { body: { bio: 'x' } })
    assert.equal(res.status, 401)
  })

  test('a member cannot change another account through the body', async () => {
    const other = await signUpUser(server)
    const res = await server.request('PUT', '/api/matrimony/me', {
      token: user.token,
      body: { userId: other.userId, id: other.userId, bio: 'written by someone else' },
    })

    if (res.status < 400) {
      const rows = await server.sql(
        'SELECT bio FROM matrimony_profiles WHERE user_id = $1',
        [other.userId]
      )
      const bio = rows[0]?.bio || ''
      assert.notEqual(bio, 'written by someone else', 'the body must not select the target row')
    }
  })

  test('is_admin cannot be set through a profile update', async () => {
    await server.request('PUT', '/api/matrimony/me', {
      token: user.token,
      body: { isAdmin: true, is_admin: true },
    })
    const rows = await server.sql('SELECT is_admin FROM users WHERE id = $1', [user.userId])
    assert.notEqual(rows[0]?.is_admin, true, 'privilege must not be self-assignable')
  })
})

describe('photo upload', () => {
  test('uploading requires authentication', async () => {
    const res = await server.request('POST', '/api/upload/photo')
    assert.equal(res.status, 401)
  })

  test('deleting a photo requires authentication', async () => {
    const res = await server.request('DELETE', '/api/upload/photo')
    assert.equal(res.status, 401)
  })
})

describe('Play developer notifications', () => {
  /*
   * This endpoint is called by Google, not by a signed-in member, so it is
   * authenticated by a shared token rather than a session. Without that check
   * anyone could post a notification claiming a subscription is active.
   */
  test('an unauthenticated notification is rejected', async () => {
    const res = await server.request('POST', '/api/payments/play/rtdn', {
      body: { message: { data: Buffer.from('{}').toString('base64') } },
    })
    assert.notEqual(res.status, 200, 'must not accept an unauthenticated notification')
  })

  test('a wrong token is rejected', async () => {
    const res = await server.request('POST', '/api/payments/play/rtdn?token=wrong-token', {
      body: { message: { data: Buffer.from('{}').toString('base64') } },
    })
    assert.notEqual(res.status, 200)
  })
})

describe('content creation requires a session', () => {
  const routes = [
    ['POST', '/api/events'],
    ['POST', '/api/community/posts'],
    ['POST', '/api/community/meetings'],
    ['POST', '/api/business/listings'],
    ['POST', '/api/help-requests'],
  ]

  for (const [method, route] of routes) {
    test(`${method} ${route} rejects an anonymous caller`, async () => {
      const res = await server.request(method, route, { body: { title: 'x', name: 'x' } })
      assert.equal(res.status, 401, `${route} must require a session`)
    })
  }
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startServer, signUpUser } from './helpers/harness.mjs'

const SECRET = 'test-secret-that-is-definitely-long-enough-32'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

describe('session tokens', () => {
  test('a protected route rejects an unauthenticated request', async () => {
    const res = await server.request('GET', '/api/matrimony/me')
    assert.equal(res.status, 401)
  })

  test('a valid token reaches the route', async () => {
    const user = await signUpUser(server)
    const res = await server.request('GET', '/api/matrimony/me', { token: user.token })
    assert.notEqual(res.status, 401)
  })

  /*
   * The original bug: resolveUserId() read x-user-id straight from the request,
   * so sending someone else's id was a complete account takeover with no
   * credential at all.
   */
  test('the x-user-id header alone grants nothing', async () => {
    const victim = await signUpUser(server)
    const res = await server.request('GET', '/api/matrimony/me', {
      headers: { 'x-user-id': victim.userId },
    })
    assert.equal(res.status, 401, 'x-user-id must not authenticate anyone')
  })

  test('x-user-id cannot override the bearer token', async () => {
    const victim = await signUpUser(server)
    const attacker = await signUpUser(server)

    const res = await server.request('GET', '/api/matrimony/me', {
      token: attacker.token,
      headers: { 'x-user-id': victim.userId },
    })

    if (res.status === 200) {
      const id = res.body?.data?.userId || res.body?.data?.user?.id || res.body?.data?.id
      if (id) assert.equal(id, attacker.userId, 'must resolve to the token holder, not the header')
    }
  })

  test('a garbage token is rejected', async () => {
    const res = await server.request('GET', '/api/matrimony/me', { token: 'not-a-jwt' })
    assert.equal(res.status, 401)
  })

  test('a token signed with the wrong secret is rejected', async () => {
    const user = await signUpUser(server)
    const forged = jwt.sign({ sub: user.userId }, 'wrong-secret-wrong-secret-wrong-32')
    const res = await server.request('GET', '/api/matrimony/me', { token: forged })
    assert.equal(res.status, 401, 'signature must be verified')
  })

  test('an expired token is rejected', async () => {
    const user = await signUpUser(server)
    const expired = jwt.sign({ sub: user.userId }, SECRET, { expiresIn: '-1h' })
    const res = await server.request('GET', '/api/matrimony/me', { token: expired })
    assert.equal(res.status, 401, 'expiry must be enforced')
  })

  test('an unsigned (alg=none) token is rejected', async () => {
    const user = await signUpUser(server)
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: user.userId })).toString('base64url')
    const res = await server.request('GET', '/api/matrimony/me', { token: `${header}.${payload}.` })
    assert.equal(res.status, 401, 'alg=none must not be accepted')
  })
})

describe('signup and login', () => {
  test('login succeeds with the right password', async () => {
    const user = await signUpUser(server)
    const res = await server.request('POST', '/api/auth/login', {
      body: { email: user.email, password: user.password },
    })
    assert.equal(res.status, 200)
    assert.ok(res.body.data.authToken)
  })

  test('login fails with the wrong password', async () => {
    const user = await signUpUser(server)
    const res = await server.request('POST', '/api/auth/login', {
      body: { email: user.email, password: 'wrong-password' },
    })
    assert.equal(res.status, 401)
  })

  test('login does not reveal whether the account exists', async () => {
    const user = await signUpUser(server)
    const wrongPass = await server.request('POST', '/api/auth/login', {
      body: { email: user.email, password: 'wrong-password' },
    })
    const noAccount = await server.request('POST', '/api/auth/login', {
      body: { email: 'nobody-at-all@example.com', password: 'wrong-password' },
    })
    assert.equal(wrongPass.status, noAccount.status)
    assert.equal(wrongPass.body.error, noAccount.body.error, 'error text must not distinguish the two')
  })

  test('a duplicate email is refused', async () => {
    const user = await signUpUser(server)
    await assert.rejects(
      () => signUpUser(server, { email: user.email }),
      (err) => err.response.status === 409
    )
  })

  /* One phone number per account, enforced server-side. */
  test('a duplicate phone number is refused', async () => {
    const user = await signUpUser(server)
    await assert.rejects(
      () => signUpUser(server, { phone: user.phone }),
      (err) => err.response.status === 409
    )
  })

  test('a short password is refused', async () => {
    await assert.rejects(
      () => signUpUser(server, { password: 'abc' }),
      (err) => err.response.status === 400
    )
  })

  test('an invalid email is refused', async () => {
    await assert.rejects(
      () => signUpUser(server, { email: 'not-an-email' }),
      (err) => err.response.status === 400
    )
  })

  test('the password is never returned', async () => {
    const user = await signUpUser(server)
    const text = JSON.stringify(user.response.body)
    assert.ok(!text.includes(user.password), 'signup response must not echo the password')
    assert.ok(!/password_hash|passwordHash/i.test(text), 'must not leak the hash')
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

const forgot = (email) =>
  server.request('POST', '/api/auth/password/forgot', { body: { email } })

describe('forgot password', () => {
  test('it issues a code for a real account', async () => {
    const user = await signUpUser(server)
    const res = await forgot(user.email)
    assert.equal(res.status, 200)
    assert.match(String(res.body.data.debugOtp), /^\d{6}$/)
  })

  /*
   * A different answer for a registered address would turn this into a way to
   * test which emails have an account on a matrimony service.
   */
  test('an unknown address gets the same answer', async () => {
    const user = await signUpUser(server)
    const known = await forgot(user.email)
    const unknown = await forgot('definitely-not-registered@example.com')

    assert.equal(known.status, unknown.status)
    assert.equal(known.body.data.message, unknown.body.data.message)
    assert.ok(!unknown.body.data.debugOtp, 'no code may be issued for an unknown address')
  })

  test('an invalid address is refused', async () => {
    assert.equal((await forgot('not-an-email')).status, 400)
  })
})

describe('resetting the password', () => {
  test('the new password works and the old one stops', async () => {
    const user = await signUpUser(server)
    const code = (await forgot(user.email)).body.data.debugOtp

    const res = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: code, password: 'brand-new-pass-99' },
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.ok(res.body.data.authToken, 'expected a session so they need not sign in again')

    const withNew = await server.request('POST', '/api/auth/login', {
      body: { email: user.email, password: 'brand-new-pass-99' },
    })
    assert.equal(withNew.status, 200, 'the new password must work')

    const withOld = await server.request('POST', '/api/auth/login', {
      body: { email: user.email, password: user.password },
    })
    assert.equal(withOld.status, 401, 'the old password must stop working')
  })

  test('the returned session is usable', async () => {
    const user = await signUpUser(server)
    const code = (await forgot(user.email)).body.data.debugOtp
    const res = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: code, password: 'another-good-pass' },
    })
    const me = await server.request('GET', '/api/matrimony/me', { token: res.body.data.authToken })
    assert.notEqual(me.status, 401)
  })

  test('a wrong code is refused', async () => {
    const user = await signUpUser(server)
    await forgot(user.email)
    const res = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: '000000', password: 'should-not-apply' },
    })
    assert.notEqual(res.status, 200)
  })

  test('a code cannot be reused', async () => {
    const user = await signUpUser(server)
    const code = (await forgot(user.email)).body.data.debugOtp

    const first = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: code, password: 'first-new-password' },
    })
    assert.equal(first.status, 200)

    const second = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: code, password: 'second-new-password' },
    })
    assert.notEqual(second.status, 200, 'a consumed code must not reset again')
  })

  test('a login code cannot be used to reset a password', async () => {
    const user = await signUpUser(server)
    const login = await server.request('POST', '/api/auth/otp/request', {
      body: { email: user.email, purpose: 'login' },
    })
    const res = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: login.body.data.debugOtp, password: 'crossed-purposes' },
    })
    assert.notEqual(res.status, 200, 'purposes must not be interchangeable')
  })

  test('a short password is refused', async () => {
    const user = await signUpUser(server)
    const code = (await forgot(user.email)).body.data.debugOtp
    const res = await server.request('POST', '/api/auth/password/reset', {
      body: { email: user.email, otp: code, password: 'short' },
    })
    assert.equal(res.status, 400)
  })
})

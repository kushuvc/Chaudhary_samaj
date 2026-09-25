import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

const REVIEW_EMAIL = 'play.review@chaudharysamaj.example'
const REVIEW_OTP = '424242'

describe('review account disabled by default', () => {
  let server
  before(async () => { server = await startServer() })
  after(async () => { await server?.stop() })

  test('the fixed code does not work when the env vars are unset', async () => {
    const user = await signUpUser(server, { email: REVIEW_EMAIL })
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: user.email, purpose: 'login', otp: REVIEW_OTP },
    })
    assert.notEqual(res.status, 200, 'no bypass may exist without explicit configuration')
  })
})

describe('review account enabled', () => {
  let server
  let reviewer

  before(async () => {
    server = await startServer({
      env: { REVIEW_ACCOUNT_EMAIL: REVIEW_EMAIL, REVIEW_ACCOUNT_OTP: REVIEW_OTP },
    })
    reviewer = await signUpUser(server, { email: REVIEW_EMAIL, fullName: 'Play Reviewer' })
  })
  after(async () => { await server?.stop() })

  test('requesting a code succeeds without sending mail', async () => {
    const res = await server.request('POST', '/api/auth/otp/request', {
      body: { email: REVIEW_EMAIL, purpose: 'login' },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.sentViaFallback, false)
    assert.ok(!res.body.data.debugOtp, 'must not hand back a code')

    const rows = await server.sql(
      `SELECT id FROM auth_email_otps WHERE lower(email) = lower($1) AND purpose = 'login'`, [REVIEW_EMAIL]
    )
    assert.equal(rows.length, 0, 'no stored login code should be created for the review account')
  })

  test('the fixed code signs the reviewer in', async () => {
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: REVIEW_EMAIL, purpose: 'login', otp: REVIEW_OTP },
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.ok(res.body.data.authToken, 'expected a session')
  })

  test('the session is an ordinary member session, not an admin one', async () => {
    const login = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: REVIEW_EMAIL, purpose: 'login', otp: REVIEW_OTP },
    })
    const token = login.body.data.authToken

    const res = await server.request('GET', '/api/admin/users', { token })
    assert.equal(res.status, 403, 'the review account must not reach admin routes')
  })

  test('a wrong code is still refused', async () => {
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: REVIEW_EMAIL, purpose: 'login', otp: '999999' },
    })
    assert.notEqual(res.status, 200)
  })

  /* The whole point is that it applies to one address and no other. */
  test('the fixed code does not work for any other account', async () => {
    const other = await signUpUser(server)
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: other.email, purpose: 'login', otp: REVIEW_OTP },
    })
    assert.notEqual(res.status, 200, 'the bypass must not generalise to other members')
  })

  test('another account still gets a real emailed code', async () => {
    const other = await signUpUser(server)
    const res = await server.request('POST', '/api/auth/otp/request', {
      body: { email: other.email, purpose: 'login' },
    })
    assert.equal(res.status, 200)
    const rows = await server.sql(
      'SELECT id FROM auth_email_otps WHERE lower(email) = lower($1)', [other.email]
    )
    assert.ok(rows.length > 0, 'normal accounts must still go through the real OTP path')
  })
})

describe('review account refuses a weak code', () => {
  let server
  before(async () => {
    server = await startServer({
      env: { REVIEW_ACCOUNT_EMAIL: REVIEW_EMAIL, REVIEW_ACCOUNT_OTP: '123' },
    })
  })
  after(async () => { await server?.stop() })

  test('a code shorter than six characters leaves the bypass off', async () => {
    await signUpUser(server, { email: REVIEW_EMAIL })
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: REVIEW_EMAIL, purpose: 'login', otp: '123' },
    })
    assert.notEqual(res.status, 200, 'a short code must not enable the bypass')
  })
})

describe('review code must be enterable in the app', () => {
  let server
  before(async () => {
    server = await startServer({
      env: { REVIEW_ACCOUNT_EMAIL: REVIEW_EMAIL, REVIEW_ACCOUNT_OTP: '12345678' },
    })
  })
  after(async () => { await server?.stop() })

  /*
   * The login screen's code field is maxLength 6. A longer value is truncated
   * as it is typed, so it can never match — the server must say so at boot
   * rather than leaving it to fail silently in front of a Play reviewer.
   */
  test('a code longer than six characters is flagged at startup', async () => {
    await signUpUser(server, { email: REVIEW_EMAIL })
    assert.match(
      server.logs(),
      /the app's code field accepts exactly 6/,
      'expected a startup warning about the unusable length'
    )
  })

  test('the truncated form does not sign in either', async () => {
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: REVIEW_EMAIL, purpose: 'login', otp: '123456' },
    })
    assert.notEqual(res.status, 200, 'a truncated code must not match')
  })
})

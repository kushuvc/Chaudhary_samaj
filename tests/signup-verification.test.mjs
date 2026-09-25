import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, getOtp, verifySignupEmail } from './helpers/harness.mjs'

/**
 * The app asks for an emailed code before creating an account, but the code
 * check and the signup were separate requests with nothing joining them — so a
 * script could call signup directly with any address, real or not, and skip
 * the code entirely. Signup now requires a correctly entered code for that
 * address, recorded on the server so installed builds need no change.
 */

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

const fresh = () => `sv${Math.random().toString(36).slice(2, 10)}@example.com`
const phone = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`

const signup = (email, extra = {}) =>
  server.request('POST', '/api/auth/signup', {
    body: {
      fullName: 'Signup Check', email, password: 'testpass123', confirmPassword: 'testpass123',
      phone: phone(), gender: 'female', dateOfBirth: '1996-01-01', ...extra,
    },
  })

describe('signing up requires a verified email', () => {
  test('an address that never entered a code is refused', async () => {
    const res = await signup(fresh())
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED')
  })

  test('no account is created when it is refused', async () => {
    const email = fresh()
    await signup(email)
    const rows = await server.sql('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email])
    assert.equal(rows.length, 0)
  })

  test('requesting a code without entering it is not enough', async () => {
    // A fresh request marks the previous code consumed, so "consumed" cannot be
    // what signup trusts — only a correctly entered code counts.
    const email = fresh()
    await getOtp(server, email, 'signup')
    await getOtp(server, email, 'signup')
    const res = await signup(email)
    assert.equal(res.status, 403)
  })

  test('a wrong code is not enough', async () => {
    const email = fresh()
    const { code } = await getOtp(server, email, 'signup')
    const wrong = code === '000000' ? '111111' : '000000'
    await server.request('POST', '/api/auth/otp/verify', { body: { email, purpose: 'signup', otp: wrong } })
    const res = await signup(email)
    assert.equal(res.status, 403)
  })

  test('verifying one address does not open another', async () => {
    const verified = fresh()
    await verifySignupEmail(server, verified)
    const res = await signup(fresh())
    assert.equal(res.status, 403)
  })

  test('a login code does not count as a signup code', async () => {
    // Planted directly: the server will not issue a login code for an address
    // with no account, so going through the API would prove nothing.
    const email = fresh()
    await server.sql(
      `INSERT INTO auth_email_otps (id, email, purpose, otp_code, expires_at, created_at, consumed_at, verified_at)
       VALUES (gen_random_uuid()::text, $1, 'login', '123456', (NOW() + INTERVAL '10 minutes')::text,
               NOW()::text, NOW()::text, NOW()::text)`,
      [email],
    )
    const res = await signup(email)
    assert.equal(res.status, 403)
  })

  test('the address is matched regardless of letter case', async () => {
    const email = fresh()
    await verifySignupEmail(server, email)
    const res = await signup(email.toUpperCase())
    assert.equal(res.status, 201, JSON.stringify(res.body))
  })

  test('a verification older than a day no longer counts', async () => {
    const email = fresh()
    await verifySignupEmail(server, email)
    await server.sql(
      `UPDATE auth_email_otps SET verified_at = (NOW() - INTERVAL '25 hours')::text WHERE lower(email) = lower($1)`,
      [email],
    )
    const res = await signup(email)
    assert.equal(res.status, 403)
  })

  test('the normal flow — code, then signup — still works', async () => {
    const email = fresh()
    await verifySignupEmail(server, email)
    const res = await signup(email)
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.ok(res.body.data.authToken)
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser, getOtp } from './helpers/harness.mjs'

let server
let user

before(async () => {
  server = await startServer()
  user = await signUpUser(server)
})
after(async () => { await server?.stop() })

describe('OTP issuing', () => {
  test('a login code is issued for a known address', async () => {
    const { res, code } = await getOtp(server, user.email, 'login')
    assert.equal(res.status, 200)
    assert.match(String(code), /^\d{6}$/, 'expected a six-digit code')
  })

  test('a login code verifies and returns a session', async () => {
    const fresh = await signUpUser(server)
    const { code } = await getOtp(server, fresh.email, 'login')
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: fresh.email, purpose: 'login', otp: code },
    })
    assert.equal(res.status, 200)
    assert.ok(res.body.data.authToken, 'expected a token')
  })

  test('the wrong code is rejected', async () => {
    const fresh = await signUpUser(server)
    const { code } = await getOtp(server, fresh.email, 'login')
    const wrong = code === '000000' ? '111111' : '000000'
    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: fresh.email, purpose: 'login', otp: wrong },
    })
    assert.notEqual(res.status, 200)
  })

  test('a code cannot be used twice', async () => {
    const fresh = await signUpUser(server)
    const { code } = await getOtp(server, fresh.email, 'login')

    const first = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: fresh.email, purpose: 'login', otp: code },
    })
    assert.equal(first.status, 200)

    const second = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: fresh.email, purpose: 'login', otp: code },
    })
    assert.notEqual(second.status, 200, 'a consumed code must not verify again')
  })

  test('an expired code is rejected', async () => {
    const fresh = await signUpUser(server)
    const { code } = await getOtp(server, fresh.email, 'login')

    await server.sql(
      `UPDATE auth_email_otps SET expires_at = $1
       WHERE lower(email) = lower($2) AND purpose = 'login'`,
      [new Date(Date.now() - 60_000).toISOString(), fresh.email]
    )

    const res = await server.request('POST', '/api/auth/otp/verify', {
      body: { email: fresh.email, purpose: 'login', otp: code },
    })
    assert.notEqual(res.status, 200, 'expiry must be enforced')
  })

  test('a login code for an unknown address does not create a session', async () => {
    const res = await server.request('POST', '/api/auth/otp/request', {
      body: { email: 'nobody-here@example.com', purpose: 'login' },
    })
    if (res.status === 200) {
      const verify = await server.request('POST', '/api/auth/otp/verify', {
        body: { email: 'nobody-here@example.com', purpose: 'login', otp: res.body.data.debugOtp },
      })
      assert.equal(verify.status, 404, 'no account means no session')
    }
  })

  test('signup is refused for an address that already has an account', async () => {
    const res = await server.request('POST', '/api/auth/otp/request', {
      body: { email: user.email, purpose: 'signup' },
    })
    assert.notEqual(res.status, 200, 'an existing member must be sent to login instead')
  })
})

describe('OTP throttling', () => {
  test('a second request within a minute is refused', async () => {
    const fresh = await signUpUser(server)
    const first = await getOtp(server, fresh.email, 'login')
    assert.equal(first.res.status, 200)

    const second = await getOtp(server, fresh.email, 'login')
    assert.equal(second.res.status, 429, 'expected the resend cooldown')
  })

  test('the hourly cap is enforced', async () => {
    const fresh = await signUpUser(server)

    // Backdate each issued row past the 60-second cooldown but inside the hour,
    // so this exercises the hourly cap rather than the cooldown.
    let lastStatus = 0
    for (let i = 0; i < 12; i += 1) {
      const { res } = await getOtp(server, fresh.email, 'login')
      lastStatus = res.status
      if (res.status === 429 && i >= 9) break
      await server.sql(
        `UPDATE auth_email_otps SET created_at = $1
         WHERE lower(email) = lower($2) AND purpose = 'login'
           AND created_at = (SELECT max(created_at) FROM auth_email_otps WHERE lower(email) = lower($2))`,
        [new Date(Date.now() - 120_000).toISOString(), fresh.email]
      )
    }
    assert.equal(lastStatus, 429, 'expected the hourly cap to stop issuing')
  })
})

describe('OTP in production', () => {
  let prod

  before(async () => {
    // No mailer credentials, exactly like a misconfigured deploy.
    prod = await startServer({ nodeEnv: 'production' })
  })
  after(async () => { await prod?.stop() })

  /*
   * With no mailer, the route used to hand the real code back in the response.
   * Anyone who knew an email address could then log in as that member.
   */
  test('a code is never returned to the caller', async () => {
    const account = await signUpUser(prod)
    const res = await prod.request('POST', '/api/auth/otp/request', {
      body: { email: account.email, purpose: 'login' },
    })

    const text = JSON.stringify(res.body)
    assert.ok(!/debugOtp/.test(text), 'debugOtp must never appear in production')
    assert.ok(!/\b\d{6}\b/.test(text), `no six-digit code may appear in the response: ${text}`)
  })

  test('an unconfigured mailer fails closed with 503', async () => {
    const account = await signUpUser(prod)
    const res = await prod.request('POST', '/api/auth/otp/request', {
      body: { email: account.email, purpose: 'login' },
    })
    assert.equal(res.status, 503, 'must refuse rather than issue a code it cannot deliver')
  })

  test('a code that could not be delivered is invalidated', async () => {
    const account = await signUpUser(prod)
    await prod.request('POST', '/api/auth/otp/request', {
      body: { email: account.email, purpose: 'login' },
    })

    const rows = await prod.sql(
      `SELECT id FROM auth_email_otps
       WHERE lower(email) = lower($1) AND consumed_at IS NULL
         AND expires_at::timestamptz > NOW()`,
      [account.email]
    )
    assert.equal(rows.length, 0, 'an undeliverable code must not stay live in the database')
  })
})

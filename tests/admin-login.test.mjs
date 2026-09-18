import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin

before(async () => {
  server = await startServer()
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

/*
 * The admin screen used to offer only an emailed code, so anything wrong with
 * mail delivery locked the one admin out of their own settings. These cover the
 * second way in.
 */
describe('signing in to the admin screen with a password', () => {
  test('the right password returns a usable token', async () => {
    const res = await server.request('POST', '/api/auth/login', {
      body: { email: admin.email, password: admin.password },
    })
    assert.equal(res.status, 200)

    const token = res.body.data.authToken
    assert.ok(token, 'a token must come back')

    // The token has to actually open the admin endpoints, not just exist.
    const rules = await server.request('GET', '/api/admin/subscription-rules', { token })
    assert.equal(rules.status, 200)
    const plans = await server.request('GET', '/api/admin/plans', { token })
    assert.equal(plans.status, 200)
  })

  test('a wrong password is refused', async () => {
    const res = await server.request('POST', '/api/auth/login', {
      body: { email: admin.email, password: 'not-the-password' },
    })
    assert.equal(res.status, 401)
    assert.ok(!res.body?.data?.authToken)
  })

  test('a member who signs in this way still cannot reach admin endpoints', async () => {
    const member = await signUpUser(server)
    const res = await server.request('POST', '/api/auth/login', {
      body: { email: member.email, password: member.password },
    })
    assert.equal(res.status, 200)

    // Password sign-in is not a back door: being able to log in is not being
    // an admin.
    const rules = await server.request('GET', '/api/admin/subscription-rules', {
      token: res.body.data.authToken,
    })
    assert.equal(rules.status, 403)
  })

  test('the page offers both ways in', async () => {
    const html = await (await fetch(`${server.base}/admin`)).text()
    assert.match(html, /id="signInPassword"/, 'password sign-in must be on the page')
    assert.match(html, /id="sendCode"/, 'the emailed code must still be offered')
    assert.match(html, /Email me a code instead/)
  })
})

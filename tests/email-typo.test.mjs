import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser, markEmailVerified } from './helpers/harness.mjs'
import { suggestEmail } from '../server/email-typo.js'
import { suggestEmail as appSuggestEmail } from '../apps/mobile/src/utils/emailTypo.ts'

const CASES = {
  // misspelt providers → corrected
  'chaudhary.rekha.2010@gamil.com': 'chaudhary.rekha.2010@gmail.com',
  'a@gmial.com': 'a@gmail.com',
  'a@gmai.com': 'a@gmail.com',
  'a@gmail.con': 'a@gmail.com',
  'a@gmail.co': 'a@gmail.com',
  'a@gmail.com.com': 'a@gmail.com',
  'A@GAMIL.COM': 'a@gmail.com',
  'a@yaho.com': 'a@yahoo.com',
  'a@hotmial.com': 'a@hotmail.com',
  'a@outlok.com': 'a@outlook.com',
  'a@rediffmail.co': 'a@rediffmail.com',
  // real domains → left alone
  'a@gmail.com': null,
  'a@ymail.com': null,
  'a@mail.com': null,
  'a@gmx.com': null,
  'a@yahoo.co.in': null,
  'a@company.in': null,
  'a@iitb.ac.in': null,
  'a@chaudharysamaj.com': null,
}

describe('email typo suggestions', () => {
  test('misspelt providers are corrected and real domains left alone', () => {
    for (const [input, expected] of Object.entries(CASES)) assert.equal(suggestEmail(input), expected, input)
  })

  test('the app and the server agree', () => {
    for (const input of Object.keys(CASES)) assert.equal(appSuggestEmail(input), suggestEmail(input), input)
  })
})

describe('signup refuses a misspelt email', () => {
  let server
  before(async () => { server = await startServer() })
  after(async () => { await server?.stop() })

  test('asking for a signup code', async () => {
    const res = await server.request('POST', '/api/auth/otp/request', { body: { email: 'new.member@gamil.com', purpose: 'signup' } })
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'EMAIL_TYPO')
    assert.equal(res.body.suggestion, 'new.member@gmail.com')
  })

  test('creating the account', async () => {
    await markEmailVerified(server, 'other.member@gmial.com')
    await assert.rejects(
      () => signUpUser(server, { email: 'other.member@gmial.com' }),
      (err) => err.response.status === 400 && err.response.body.code === 'EMAIL_TYPO'
    )
  })

  test('an existing account with such an address can still log in', async () => {
    const user = await signUpUser(server, { email: `legacy${Date.now()}@example.com` })
    await server.sql('UPDATE users SET email = $1 WHERE id = $2', ['legacy.member@gamil.com', user.userId])
    await server.sql('UPDATE auth_accounts SET email = $1 WHERE user_id = $2', ['legacy.member@gamil.com', user.userId]).catch(() => {})
    const res = await server.request('POST', '/api/auth/login', { body: { email: 'legacy.member@gamil.com', password: user.password } })
    assert.notEqual(res.body.code, 'EMAIL_TYPO')
  })
})

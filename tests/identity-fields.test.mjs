import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

/*
 * Email and phone identify an account and are how it is recovered — a reset
 * goes to the address, a sign-in code to the number. The profile update
 * endpoint used to write whatever phone the client sent, so an account could
 * be moved onto a different number by saving a form.
 */
describe('email and phone are not editable through a profile update', () => {
  test('a posted phone number is ignored', async () => {
    const me = await signUpUser(server, { gender: 'male' })
    const [before] = await server.sql('SELECT phone FROM users WHERE id = $1', [me.userId])

    const res = await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { user: { fullName: 'New Name', phone: '9999900000' } },
    })
    assert.equal(res.status, 200)

    const [after] = await server.sql('SELECT full_name, phone FROM users WHERE id = $1', [me.userId])
    assert.equal(after.phone, before.phone, 'the phone must not move')
    assert.equal(after.full_name, 'New Name', 'the name should still save')
  })

  test('a posted email is ignored', async () => {
    const me = await signUpUser(server, { gender: 'male' })
    const [before] = await server.sql('SELECT email FROM users WHERE id = $1', [me.userId])

    await server.request('PUT', '/api/matrimony/me', {
      token: me.token,
      body: { user: { email: 'taken-over@example.com' } },
    })

    const [after] = await server.sql('SELECT email FROM users WHERE id = $1', [me.userId])
    assert.equal(after.email, before.email, 'the address must not move')
  })

  test('someone else\'s number cannot be claimed', async () => {
    // The unique index would have turned this into a raw 500; now it is simply
    // not a thing the endpoint does.
    const victim = await signUpUser(server, { gender: 'female' })
    const attacker = await signUpUser(server, { gender: 'male' })
    const [theirs] = await server.sql('SELECT phone FROM users WHERE id = $1', [victim.userId])

    const res = await server.request('PUT', '/api/matrimony/me', {
      token: attacker.token,
      body: { user: { phone: theirs.phone } },
    })
    assert.ok(res.status < 500, `should not blow up: got ${res.status}`)

    const [still] = await server.sql('SELECT phone FROM users WHERE id = $1', [victim.userId])
    assert.equal(still.phone, theirs.phone, 'the victim keeps their number')
  })

  test('the app does not offer the fields for editing either', () => {
    const src = readFileSync(new URL('../apps/mobile/src/screens/ProfileScreen.tsx', import.meta.url), 'utf8')
    const emailBlock = src.slice(src.indexOf("label={t('emailLabel')}"), src.indexOf("label={t('locationLabel')}"))
    assert.match(emailBlock, /editable=\{false\}/, 'email must be read-only')
    assert.doesNotMatch(emailBlock, /editable=\{isEditing\}/, 'neither field may follow edit mode')
  })
})

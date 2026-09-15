import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

describe('account deletion', () => {
  test('it requires authentication', async () => {
    const res = await server.request('DELETE', '/api/auth/account')
    assert.equal(res.status, 401)
  })

  /*
   * The app's confirmation warns that everything is removed permanently, and
   * Play requires that to be true. Until this was wired up the button only
   * called logout() and every row stayed exactly where it was.
   */
  test('it removes the account and its data', async () => {
    const user = await signUpUser(server)

    await server.sql(
      `INSERT INTO user_settings (user_id, language) VALUES ($1, 'gu-IN')
       ON CONFLICT (user_id) DO NOTHING`, [user.userId]
    )
    await server.sql(
      `INSERT INTO user_subscriptions
         (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1,'premium',20000,'t','t','active',$2,$3)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.userId, new Date().toISOString(), new Date(Date.now() + 86400000).toISOString()]
    )

    const res = await server.request('DELETE', '/api/auth/account', { token: user.token })
    assert.equal(res.status, 200, JSON.stringify(res.body))

    for (const [table, column] of [
      ['users', 'id'],
      ['matrimony_profiles', 'user_id'],
      ['user_settings', 'user_id'],
      ['user_subscriptions', 'user_id'],
    ]) {
      const rows = await server.sql(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [user.userId])
      assert.equal(rows.length, 0, `${table} still holds a row for the deleted account`)
    }
  })

  test('the session stops working afterwards', async () => {
    const user = await signUpUser(server)
    await server.request('DELETE', '/api/auth/account', { token: user.token })

    const res = await server.request('GET', '/api/matrimony/me', { token: user.token })
    assert.notEqual(res.status, 200, 'a deleted account must not keep a usable session')
  })

  test('the email can be reused after deletion', async () => {
    const user = await signUpUser(server)
    await server.request('DELETE', '/api/auth/account', { token: user.token })

    const again = await signUpUser(server, { email: user.email, phone: user.phone })
    assert.ok(again.token, 'the address must be free to register again')
  })

  test('one member cannot delete another account', async () => {
    const victim = await signUpUser(server)
    const attacker = await signUpUser(server)

    await server.request('DELETE', '/api/auth/account', {
      token: attacker.token,
      headers: { 'x-user-id': victim.userId },
    })

    const rows = await server.sql('SELECT 1 FROM users WHERE id = $1', [victim.userId])
    assert.equal(rows.length, 1, 'the header must not select whose account is deleted')
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin

before(async () => {
  server = await startServer()
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

const remove = (userId, body = { reason: 'Repeated harassment after a warning' }, token = admin.token) =>
  server.request('DELETE', `/api/admin/users/${userId}`, { token, body })

async function fileReport(reporterId, reportedId) {
  await server.sql(
    `INSERT INTO member_reports (id, reporter_user_id, reported_user_id, reason, status, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, 'harassment', 'open', NOW()::text)`,
    [reporterId, reportedId]
  )
}

describe('admin removing a member', () => {
  test('only an admin can remove a member', async () => {
    const member = await signUpUser(server)
    const other = await signUpUser(server)
    const res = await remove(member.userId, undefined, other.token)
    assert.equal(res.status, 403)
    const rows = await server.sql('SELECT 1 FROM users WHERE id = $1', [member.userId])
    assert.equal(rows.length, 1)
  })

  test('a reason is required', async () => {
    const member = await signUpUser(server)
    const res = await remove(member.userId, { reason: '  ' })
    assert.equal(res.status, 400)
  })

  test('an admin cannot remove themselves or another admin', async () => {
    assert.equal((await remove(admin.userId)).status, 400)
    const otherAdmin = await signUpUser(server)
    await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [otherAdmin.userId])
    assert.equal((await remove(otherAdmin.userId)).status, 400)
  })

  test('an unknown member is a 404', async () => {
    assert.equal((await remove('no-such-user')).status, 404)
  })

  test('removes the account, closes reports about them, and keeps who they were', async () => {
    const reporter = await signUpUser(server, { gender: 'male' })
    const member = await signUpUser(server, { gender: 'female' })
    await fileReport(reporter.userId, member.userId)
    await server.sql(
      `INSERT INTO member_verifications (user_id, status, fingerprint, submitted_at)
       VALUES ($1, 'verified', 'fp-removed-test', NOW()::text)`,
      [member.userId]
    )

    const res = await remove(member.userId)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.activeSubscription, null)

    for (const [table, column] of [
      ['users', 'id'],
      ['matrimony_profiles', 'user_id'],
      ['member_verifications', 'user_id'],
    ]) {
      const rows = await server.sql(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [member.userId])
      assert.equal(rows.length, 0, `${table} still holds a row for the removed member`)
    }

    const removed = await server.sql('SELECT email, aadhaar_fingerprint, reason FROM removed_members WHERE user_id = $1', [member.userId])
    assert.equal(removed[0].email, member.email.toLowerCase())
    assert.equal(removed[0].aadhaar_fingerprint, 'fp-removed-test')

    // The report stays, closed, and still names who it was about.
    const reports = await server.request('GET', '/api/admin/reports', { token: admin.token })
    const report = reports.body.data.find((r) => r.reported_user_id === member.userId)
    assert.equal(report.status, 'actioned')
    assert.equal(report.reported_email, member.email.toLowerCase())
    assert.equal(report.reported_removed, true)

    // The session stops working.
    const me = await server.request('GET', '/api/matrimony/me', { token: member.token })
    assert.notEqual(me.status, 200)
  })

  test('a removed member cannot sign up again with the same email or phone', async () => {
    const member = await signUpUser(server)
    assert.equal((await remove(member.userId)).status, 200)

    await assert.rejects(
      () => signUpUser(server, { email: member.email }),
      (err) => err.response.status === 403 && err.response.body.code === 'ACCOUNT_REMOVED'
    )
    await assert.rejects(
      () => signUpUser(server, { phone: member.phone }),
      (err) => err.response.status === 403 && err.response.body.code === 'ACCOUNT_REMOVED'
    )

    const otp = await server.request('POST', '/api/auth/otp/request', {
      body: { email: member.email.toUpperCase(), purpose: 'signup' },
    })
    assert.equal(otp.status, 403)
    assert.equal(otp.body.code, 'ACCOUNT_REMOVED')
  })

  test('the admin is told about an active subscription to cancel in Play Console', async () => {
    const member = await signUpUser(server)
    await server.sql(
      `INSERT INTO user_subscriptions
         (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at, play_purchase_token)
       VALUES ($1, 'premium', 20000, 'p', 'GPA.1234-5678', 'active', $2, $3, 'tok')`,
      [member.userId, new Date().toISOString(), new Date(Date.now() + 86400000).toISOString()]
    )
    const res = await remove(member.userId)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.activeSubscription.orderId, 'GPA.1234-5678')
    assert.equal(res.body.data.activeSubscription.viaPlay, true)
  })

  test('the members list shows how many reports each member has', async () => {
    const reporter = await signUpUser(server)
    const member = await signUpUser(server)
    await fileReport(reporter.userId, member.userId)
    const res = await server.request('GET', '/api/admin/users?limit=100', { token: admin.token })
    const row = res.body.data.users.find((u) => u.id === member.userId)
    assert.equal(row.report_count, 1)
  })
})

describe('deleting your own account', () => {
  test('does not put the member on the removed list', async () => {
    const member = await signUpUser(server)
    await server.request('DELETE', '/api/auth/account', { token: member.token })
    const rows = await server.sql('SELECT 1 FROM removed_members WHERE user_id = $1', [member.userId])
    assert.equal(rows.length, 0)
    const again = await signUpUser(server, { email: member.email, phone: member.phone })
    assert.ok(again.token)
  })
})

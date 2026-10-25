import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'
import { pendingAlerts, capacityLimits } from '../server/admin-alerts.js'

const base = { members: 0, newThisWeek: 0, paying: 0, dbMb: 10, storageMb: 10 }
const limits = { dbMb: 500, storageMb: 1024 }
const keys = (stats, sent = []) => pendingAlerts({ ...base, ...stats }, sent, limits).map((a) => a.key)

describe('which alerts are due', () => {
  test('nothing below the first milestones', () => {
    assert.deepEqual(keys({ members: 18, paying: 2 }), [])
  })

  test('crossing 100 members is due once', () => {
    assert.deepEqual(keys({ members: 100 }), ['members:25', 'members:50', 'members:100'])
    assert.deepEqual(keys({ members: 120 }, ['members:25', 'members:50', 'members:100']), [])
  })

  test('paying members have their own milestones', () => {
    assert.deepEqual(keys({ paying: 10 }), ['paying:5', 'paying:10'])
  })

  test('storage at 70% and 90% of the limit warns, and is marked as a warning', () => {
    const due = pendingAlerts({ ...base, storageMb: 950 }, [], limits)
    assert.deepEqual(due.map((a) => a.key), ['storage:1024:70', 'storage:1024:90'])
    assert.ok(due.every((a) => a.warning))
  })

  test('raising the limit after an upgrade re-arms the warnings', () => {
    const sent = ['db:500:70', 'db:500:90']
    assert.deepEqual(pendingAlerts({ ...base, dbMb: 460 }, sent, limits).map((a) => a.key), [])
    assert.deepEqual(
      pendingAlerts({ ...base, dbMb: 6000 }, sent, { dbMb: 8192, storageMb: 1024 }).map((a) => a.key),
      ['db:8192:70']
    )
  })

  test('plan buyer milestones, with a review reminder at 100 yearly buyers', () => {
    const plans = [
      { code: 'premium', name: 'Monthly', durationDays: 30, buyers: 100, active: 40 },
      { code: 'yearly', name: 'Yearly', durationDays: 365, buyers: 100, active: 100 },
    ]
    const due = pendingAlerts({ ...base, plans }, [], limits)
    const monthly100 = due.find((a) => a.key === 'plan:premium:100')
    const yearly100 = due.find((a) => a.key === 'plan:yearly:100')
    assert.ok(monthly100 && !monthly100.warning)
    assert.ok(yearly100.warning)
    assert.match(yearly100.line, /review the yearly plan/)
    assert.ok(due.some((a) => a.key === 'plan:yearly:10'))
    assert.equal(pendingAlerts({ ...base, plans }, due.map((a) => a.key), limits).length, 0)
  })

  test('limits default to the free plan and follow the env', () => {
    assert.deepEqual(capacityLimits({}), { dbMb: 500, storageMb: 1024 })
    assert.deepEqual(capacityLimits({ DB_LIMIT_MB: '8192', STORAGE_LIMIT_MB: '102400' }), { dbMb: 8192, storageMb: 102400 })
  })
})

describe('admin "email me a summary" check', () => {
  let server
  let admin
  before(async () => {
    server = await startServer()
    admin = await signUpUser(server)
    await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  })
  after(async () => { await server?.stop() })

  test('only an admin can run it', async () => {
    const member = await signUpUser(server)
    assert.equal((await server.request('POST', '/api/admin/alerts/check', { token: member.token })).status, 403)
    assert.equal((await server.request('POST', '/api/admin/alerts/check')).status, 401)
  })

  test('reports the numbers, and marks nothing sent when no email went out', async () => {
    const res = await server.request('POST', '/api/admin/alerts/check', { token: admin.token })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { stats, sent, recipients } = res.body.data
    assert.ok(stats.members >= 2)
    assert.equal(typeof stats.dbMb, 'number')
    assert.equal(recipients, 1, 'the admin account is the recipient')
    // The suite has no Brevo key, so nothing is sent and nothing is recorded:
    // the alert must go out once email works, not be lost.
    assert.equal(sent, false)
    assert.ok(Array.isArray(stats.plans), 'per-plan counts are reported')
    const rows = await server.sql('SELECT key FROM admin_alerts_sent')
    assert.equal(rows.length, 0)
  })
})

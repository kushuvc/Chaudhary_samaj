import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin
before(async () => {
  server = await startServer()
  admin = await signUpUser(server)
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

async function subscribe(user, { provider, amount, paymentId, token = null }) {
  await server.sql(
    `INSERT INTO user_subscriptions
       (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at, provider, play_purchase_token)
     VALUES ($1, 'premium', $2, $3, $3, 'active', $4, $5, $6, $7)`,
    [user.userId, amount, paymentId, new Date().toISOString(), new Date(Date.now() + 864e5).toISOString(), provider, token]
  )
}

describe('admin overview revenue', () => {
  /*
   * The Play reviewer's free access is an active row with amount 20000 from
   * older code; it used to be added to revenue and to the subscriber count.
   */
  test('only paid subscriptions count as revenue and subscribers', async () => {
    await subscribe(await signUpUser(server), { provider: 'google_play', amount: 50, paymentId: 'GPA.1', token: 't1' })
    await subscribe(await signUpUser(server), { provider: 'razorpay', amount: 199, paymentId: 'pay_ABC' })
    await subscribe(await signUpUser(server), { provider: 'razorpay', amount: 20000, paymentId: 'play-review-no-charge' })
    await subscribe(await signUpUser(server), { provider: 'razorpay', amount: 200, paymentId: 'test_cleanup' })

    const res = await server.request('GET', '/api/admin/stats', { token: admin.token })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.activePremium, 2)
    assert.equal(res.body.data.activeValue, 249)
    assert.equal(res.body.data.freeAccess, 2)
  })

  test('the milestone email counts paying members the same way', async () => {
    const res = await server.request('POST', '/api/admin/alerts/check', { token: admin.token })
    assert.equal(res.body.data.stats.paying, 2)
  })
})

describe('plan purchase log', () => {
  test('counts distinct buyers per plan from the purchase log', async () => {
    const a = await signUpUser(server)
    const b = await signUpUser(server)
    await server.sql(`INSERT INTO plan_purchases (order_id, user_id, plan, created_at) VALUES
      ('GPA.y1', $1, 'yearly', NOW()::text), ('GPA.y1..0', $1, 'yearly', NOW()::text), ('GPA.y2', $2, 'yearly', NOW()::text)`,
      [a.userId, b.userId])
    await server.sql(`INSERT INTO subscription_plans (code, name, duration_days, price_paise, is_active, sort_order, updated_at)
      VALUES ('yearly', 'Yearly', 365, 150000, true, 9, NOW()::text) ON CONFLICT (code) DO NOTHING`)
    const res = await server.request('POST', '/api/admin/alerts/check', { token: admin.token })
    const yearly = res.body.data.stats.plans.find((p) => p.code === 'yearly')
    assert.equal(yearly.buyers, 2, 'a renewal does not count as a second buyer')
  })
})

describe('total sales', () => {
  test('a paying member deleting their account does not lower total sales', async () => {
    const before = (await server.request('GET', '/api/admin/stats', { token: admin.token })).body.data.totalRevenue
    const buyer = await signUpUser(server)
    await subscribe(buyer, { provider: 'google_play', amount: 1500, paymentId: 'GPA.year', token: 'tok-year' })
    await server.sql(`INSERT INTO plan_purchases (order_id, user_id, plan, amount, created_at) VALUES ('GPA.year', $1, 'yearly', 1500, NOW()::text)`, [buyer.userId])
    const withSale = (await server.request('GET', '/api/admin/stats', { token: admin.token })).body.data
    assert.equal(withSale.totalRevenue, before + 1500)

    assert.equal((await server.request('DELETE', '/api/auth/account', { token: buyer.token })).status, 200)
    const after = (await server.request('GET', '/api/admin/stats', { token: admin.token })).body.data
    assert.equal(after.totalRevenue, before + 1500, 'nothing was refunded, so the sale still counts')
  })
})

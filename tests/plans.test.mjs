import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin
let member

before(async () => {
  server = await startServer()
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  member = await signUpUser(server, { gender: 'male' })
})
after(async () => { await server?.stop() })

const putPlan = (code, body, token = admin.token) =>
  server.request('PUT', `/api/admin/plans/${code}`, { token, body })

const dropPlan = (code, token = admin.token) =>
  server.request('DELETE', `/api/admin/plans/${code}`, { token })

const quarterly = {
  name: 'Quarterly',
  durationDays: 90,
  pricePaise: 50000,
  playProductId: 'premium_quarterly',
  badge: 'Best value',
  sortOrder: 1,
}

describe('the seeded plan', () => {
  test('the plan that used to be hardcoded is in the table', async () => {
    const res = await server.request('GET', '/api/admin/plans', { token: admin.token })
    assert.equal(res.status, 200)

    const premium = res.body.data.find((plan) => plan.code === 'premium')
    assert.ok(premium, 'the premium plan should be seeded')
    // These are the values the app and server both had as constants. Changing
    // them here would silently reprice or re-date every existing subscription.
    assert.equal(premium.durationDays, 30)
    assert.equal(premium.pricePaise, 20000)
    assert.equal(premium.playProductId, 'premium_monthly')
    assert.equal(premium.isActive, true)
  })

  test('members are offered it without being an admin', async () => {
    const res = await server.request('GET', '/api/payments/plans', { token: member.token })
    assert.equal(res.status, 200)
    assert.ok(res.body.data.some((plan) => plan.code === 'premium'))
  })
})

describe('adding and editing plans', () => {
  test('an admin can add a plan and members see it immediately', async () => {
    assert.equal((await putPlan('premium_quarterly', quarterly)).status, 200)

    // No redeploy, no cache wait: the write invalidates the cache itself.
    const res = await server.request('GET', '/api/payments/plans', { token: member.token })
    const added = res.body.data.find((plan) => plan.code === 'premium_quarterly')
    assert.ok(added, 'the new plan should be on sale at once')
    assert.equal(added.durationDays, 90)
    assert.equal(added.pricePaise, 50000)
    assert.equal(added.badge, 'Best value')
  })

  test('plans come back in the order the admin set', async () => {
    const res = await server.request('GET', '/api/payments/plans', { token: member.token })
    const codes = res.body.data.map((plan) => plan.code)
    assert.deepEqual(codes.slice(0, 2), ['premium', 'premium_quarterly'])
  })

  test('editing a price changes what members are offered', async () => {
    await putPlan('premium_quarterly', { ...quarterly, pricePaise: 45000 })
    const res = await server.request('GET', '/api/payments/plans', { token: member.token })
    const edited = res.body.data.find((plan) => plan.code === 'premium_quarterly')
    assert.equal(edited.pricePaise, 45000)
  })

  test('deactivating hides a plan from members but keeps it for the admin', async () => {
    await putPlan('premium_quarterly', { ...quarterly, isActive: false })

    const offered = await server.request('GET', '/api/payments/plans', { token: member.token })
    assert.ok(!offered.body.data.some((plan) => plan.code === 'premium_quarterly'))

    const all = await server.request('GET', '/api/admin/plans', { token: admin.token })
    assert.ok(all.body.data.some((plan) => plan.code === 'premium_quarterly'))

    await putPlan('premium_quarterly', { ...quarterly, isActive: true })
  })

  test('a plan with no Play product id is still offered', async () => {
    await putPlan('web_only', {
      name: 'Web only',
      durationDays: 30,
      pricePaise: 15000,
      playProductId: '',
    })
    const res = await server.request('GET', '/api/payments/plans', { token: member.token })
    const webOnly = res.body.data.find((plan) => plan.code === 'web_only')
    assert.ok(webOnly)
    assert.equal(webOnly.playProductId, null)
  })

  test('two plans cannot share a Play product id', async () => {
    const res = await putPlan('premium_copy', { ...quarterly, playProductId: 'premium_quarterly' })
    assert.equal(res.status, 409)
  })
})

describe('plan validation', () => {
  test('a code with spaces or capitals is refused', async () => {
    assert.equal((await putPlan('Bad Code', quarterly)).status, 400)
  })

  test('a zero or negative duration is refused', async () => {
    assert.equal((await putPlan('bad_days', { ...quarterly, durationDays: 0 })).status, 400)
    assert.equal((await putPlan('bad_days', { ...quarterly, durationDays: -30 })).status, 400)
  })

  test('a fractional or negative price is refused', async () => {
    assert.equal((await putPlan('bad_price', { ...quarterly, pricePaise: 99.5 })).status, 400)
    assert.equal((await putPlan('bad_price', { ...quarterly, pricePaise: -1 })).status, 400)
  })

  test('a nameless plan is refused', async () => {
    assert.equal((await putPlan('no_name', { ...quarterly, name: '   ' })).status, 400)
  })
})

describe('only admins manage plans', () => {
  test('reading the admin list needs an admin', async () => {
    assert.equal((await server.request('GET', '/api/admin/plans')).status, 401)
    assert.equal(
      (await server.request('GET', '/api/admin/plans', { token: member.token })).status,
      403
    )
  })

  test('a member cannot add, edit or remove a plan', async () => {
    assert.equal((await putPlan('sneaky', quarterly, member.token)).status, 403)
    assert.equal((await dropPlan('premium', member.token)).status, 403)
  })
})

describe('retiring a plan', () => {
  test('an unused plan is deleted outright', async () => {
    await putPlan('temp_plan', { ...quarterly, playProductId: '' })
    const res = await dropPlan('temp_plan')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.removed, true)

    const all = await server.request('GET', '/api/admin/plans', { token: admin.token })
    assert.ok(!all.body.data.some((plan) => plan.code === 'temp_plan'))
  })

  test('a plan someone is subscribed on is hidden, never deleted', async () => {
    // Deleting it would leave that subscription pointing at nothing, and its
    // renewal with no length to date it by.
    const subscriber = await signUpUser(server, { gender: 'male' })
    await putPlan('held_plan', { ...quarterly, playProductId: '' })
    await server.sql(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, 'held_plan', 500, 'p_test', 'o_test', 'active', NOW()::text, (NOW() + INTERVAL '90 days')::text)`,
      [subscriber.userId]
    )

    const res = await dropPlan('held_plan')
    assert.equal(res.body.data.removed, false)
    assert.equal(res.body.data.deactivated, true)

    const all = await server.request('GET', '/api/admin/plans', { token: admin.token })
    const held = all.body.data.find((plan) => plan.code === 'held_plan')
    assert.ok(held, 'the plan must survive so the subscription still resolves')
    assert.equal(held.isActive, false)
  })
})

describe('pricing cannot be set by the client', () => {
  test('a payment link is refused for a plan that is not on sale', async () => {
    const res = await server.request('POST', '/api/payments/create-link', {
      token: member.token,
      body: { plan: 'does_not_exist' },
    })
    // 400 when payments are configured, 503 when the keys are unset — either
    // way no link is handed back for an unknown plan.
    assert.ok([400, 503].includes(res.status), `unexpected status ${res.status}`)
    assert.ok(!res.body?.data?.short_url)
  })

  test('an amount posted by the client is ignored', async () => {
    const res = await server.request('POST', '/api/payments/create-link', {
      token: member.token,
      body: { plan: 'premium', amount: 1 },
    })
    // The point is that nothing is created at a client-chosen price. Without
    // Razorpay keys this is a 503; with them the link carries the plan's price.
    assert.notEqual(res.body?.data?.amount, 1)
  })
})

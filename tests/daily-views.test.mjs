import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin
before(async () => {
  server = await startServer()
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  // Make sure men pay, so a man's access comes from his plan.
  await server.sql(`UPDATE subscription_rules SET is_free = false WHERE gender = 'male'`)
})
after(async () => { await server?.stop() })

const putPlan = (code, body) => server.request('PUT', `/api/admin/plans/${code}`, { token: admin.token, body })
const plan = { name: 'Capped', durationDays: 30, pricePaise: 10000, playProductId: '' }

async function subscribe(userId, planCode) {
  await server.sql(
    `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
     VALUES ($1, $2, 100, 'p_test', 'o_test', 'active', NOW()::text, (NOW() + INTERVAL '30 days')::text)
     ON CONFLICT (user_id) DO UPDATE SET plan = $2, status = 'active', expires_at = (NOW() + INTERVAL '30 days')::text`,
    [userId, planCode]
  )
}

async function womenProfiles(viewer, n) {
  for (let i = 0; i < n; i++) await signUpUser(server, { gender: 'female' })
  const list = await server.request('GET', '/api/matrimony/profiles?limit=100', { token: viewer.token })
  return list.body.data.filter((p) => !p.isLocked).map((p) => p.id)
}

const open = (viewer, id) => server.request('GET', `/api/matrimony/profiles/${id}`, { token: viewer.token })

describe('plan profile views per day', () => {
  test('admin sets, shows and clears the limit; the app plan list carries it', async () => {
    assert.equal((await putPlan('capped_a', { ...plan, dailyProfileViews: 3 })).body.data.dailyProfileViews, 3)
    const list = await server.request('GET', '/api/admin/plans', { token: admin.token })
    assert.equal(list.body.data.find((p) => p.code === 'capped_a').dailyProfileViews, 3)
    // Saving without the field keeps it; null clears it to unlimited.
    assert.equal((await putPlan('capped_a', { ...plan })).body.data.dailyProfileViews, 3)
    assert.equal((await putPlan('capped_a', { ...plan, dailyProfileViews: null })).body.data.dailyProfileViews, null)
    assert.equal((await putPlan('capped_a', { ...plan, dailyProfileViews: -1 })).status, 400)
    await putPlan('capped_a', { ...plan, dailyProfileViews: 3 })
    const pub = await server.request('GET', '/api/payments/plans')
    assert.equal(pub.body.data.find((p) => p.code === 'capped_a').dailyProfileViews, 3)
  })

  test('a capped subscriber opens N new profiles a day, re-opens them freely, then is stopped', async () => {
    await putPlan('capped_b', { ...plan, dailyProfileViews: 2 })
    const viewer = await signUpUser(server, { gender: 'male' })
    await subscribe(viewer.userId, 'capped_b')
    const ids = await womenProfiles(viewer, 3)
    assert.ok(ids.length >= 3)
    assert.equal((await open(viewer, ids[0])).status, 200)
    assert.equal((await open(viewer, ids[1])).status, 200)
    assert.equal((await open(viewer, ids[0])).status, 200, 'already opened today stays open')
    const third = await open(viewer, ids[2])
    assert.equal(third.status, 403)
    assert.equal(third.body.code, 'DAILY_VIEW_LIMIT')
    assert.equal(third.body.limit, 2)

    // Tomorrow it resets.
    await server.sql(`UPDATE profile_daily_views SET day = '2000-01-01' WHERE viewer_user_id = $1`, [viewer.userId])
    assert.equal((await open(viewer, ids[2])).status, 200)
  })

  test('someone you have an interest with is never blocked by the cap', async () => {
    await putPlan('capped_c', { ...plan, dailyProfileViews: 1 })
    const viewer = await signUpUser(server, { gender: 'male' })
    await subscribe(viewer.userId, 'capped_c')
    const ids = await womenProfiles(viewer, 2)
    assert.equal((await open(viewer, ids[0])).status, 200)
    await server.request('POST', `/api/matrimony/profiles/${ids[1]}/interest`, { token: viewer.token })
    assert.equal((await open(viewer, ids[1])).status, 200)
  })

  test('plans without a limit stay unlimited', async () => {
    await putPlan('open_d', { ...plan })
    const viewer = await signUpUser(server, { gender: 'male' })
    await subscribe(viewer.userId, 'open_d')
    const ids = await womenProfiles(viewer, 3)
    for (const id of ids) assert.equal((await open(viewer, id)).status, 200)
  })
})

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

const token = (n = 1) => `ExponentPushToken[test-${Date.now()}-${n}-${Math.random().toString(36).slice(2)}]`
const send = (body, as = admin) =>
  server.request('POST', '/api/admin/notifications', { token: as.token, body })
const list = (member) => server.request('GET', '/api/notifications', { token: member.token })

async function profileIdOf(userId) {
  return (await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [userId]))[0].id
}

describe('device registration', () => {
  test('a valid Expo token is stored against the member', async () => {
    const member = await signUpUser(server, { gender: 'female' })
    const t = token()
    const res = await server.request('POST', '/api/push-tokens', {
      token: member.token, body: { token: t, platform: 'android' },
    })
    assert.equal(res.status, 200)
    const rows = await server.sql('SELECT user_id FROM push_tokens WHERE token = $1', [t])
    assert.equal(rows[0].user_id, member.userId)
  })

  test('anything that is not an Expo token is refused', async () => {
    const member = await signUpUser(server, { gender: 'female' })
    const res = await server.request('POST', '/api/push-tokens', {
      token: member.token, body: { token: 'not-a-token' },
    })
    assert.equal(res.status, 400)
  })

  test('a device moves to whoever signs in on it last', async () => {
    const first = await signUpUser(server, { gender: 'female' })
    const second = await signUpUser(server, { gender: 'male' })
    const t = token()
    await server.request('POST', '/api/push-tokens', { token: first.token, body: { token: t } })
    await server.request('POST', '/api/push-tokens', { token: second.token, body: { token: t } })
    const rows = await server.sql('SELECT user_id FROM push_tokens WHERE token = $1', [t])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].user_id, second.userId)
  })

  test('signing out removes the device', async () => {
    const member = await signUpUser(server, { gender: 'female' })
    const t = token()
    await server.request('POST', '/api/push-tokens', { token: member.token, body: { token: t } })
    const res = await server.request('DELETE', '/api/push-tokens', { token: member.token, body: { token: t } })
    assert.equal(res.status, 200)
    assert.equal((await server.sql('SELECT 1 FROM push_tokens WHERE token = $1', [t])).length, 0)
  })
})

describe('admin broadcasts', () => {
  test('only an admin can send one', async () => {
    const member = await signUpUser(server, { gender: 'female' })
    const res = await send({ audience: 'all', title: 'Hi', body: 'There' }, member)
    assert.equal(res.status, 403)
  })

  test('a dry run counts recipients and sends nothing', async () => {
    const before = (await server.sql('SELECT COUNT(*)::int AS n FROM notifications'))[0].n
    const res = await send({ audience: 'all', dryRun: true })
    assert.equal(res.status, 200)
    assert.ok(res.body.data.recipients > 0)
    const afterCount = (await server.sql('SELECT COUNT(*)::int AS n FROM notifications'))[0].n
    assert.equal(afterCount, before)
  })

  test('a gender broadcast reaches only that gender, and shows in their list', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const him = await signUpUser(server, { gender: 'male' })
    const res = await send({ audience: 'female', title: 'For women', body: 'Hello' })
    assert.equal(res.status, 200)

    const hers = (await list(her)).body.data
    assert.ok(hers.some((n) => n.title === 'For women' && n.type === 'announcement' && !n.read))
    const his = (await list(him)).body.data
    assert.ok(!his.some((n) => n.title === 'For women'))
  })

  test('one member can be reached by email', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const res = await send({ audience: 'user', target: her.email, title: 'Just you', body: 'Hi' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.recipients, 1)
    assert.ok((await list(her)).body.data.some((n) => n.title === 'Just you'))
  })

  test('a plan broadcast reaches only members on that plan', async () => {
    await server.request('PUT', '/api/admin/plans/gold', {
      token: admin.token,
      body: { name: 'Gold', durationDays: 30, pricePaise: 10000, playProductId: '' },
    })
    const onPlan = await signUpUser(server, { gender: 'male' })
    const offPlan = await signUpUser(server, { gender: 'male' })
    await server.sql(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, 'gold', 100, 'p', 'o', 'active', NOW()::text, (NOW() + INTERVAL '30 days')::text)`,
      [onPlan.userId]
    )
    const res = await send({ audience: 'plan', target: 'gold', title: 'Gold news', body: 'Hi' })
    assert.equal(res.body.data.recipients, 1)
    assert.ok((await list(onPlan)).body.data.some((n) => n.title === 'Gold news'))
    assert.ok(!(await list(offPlan)).body.data.some((n) => n.title === 'Gold news'))
  })

  test('a missing title or an overlong one is refused', async () => {
    assert.equal((await send({ audience: 'all', title: '', body: 'x' })).status, 400)
    assert.equal((await send({ audience: 'all', title: 'x'.repeat(66), body: 'x' })).status, 400)
  })

  test('what was sent is listed with its counts', async () => {
    await send({ audience: 'male', title: 'History check', body: 'Hi' })
    const res = await server.request('GET', '/api/admin/notifications', { token: admin.token })
    const row = res.body.data.history.find((h) => h.title === 'History check')
    assert.ok(row)
    assert.equal(row.audience, 'male')
    assert.ok(row.recipients > 0)
  })
})

describe('automatic notifications', () => {
  test('receiving an interest, then having yours accepted', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })

    const sent = await server.request('POST', `/api/matrimony/profiles/${await profileIdOf(her.userId)}/interest`, {
      token: him.token,
    })
    assert.equal(sent.status, 200)

    // Recorded in the background, so allow it a moment.
    let hers = []
    for (let i = 0; i < 20 && !hers.some((n) => n.type === 'interest_received'); i++) {
      await new Promise((r) => setTimeout(r, 50))
      hers = (await list(her)).body.data
    }
    const received = hers.find((n) => n.type === 'interest_received')
    assert.ok(received, 'she is told about the interest')
    assert.equal(received.data.screen, 'Interests')

    await server.request('PUT', `/api/matrimony/interests/${sent.body.data.interestId}`, {
      token: her.token, body: { accept: true },
    })
    let his = []
    for (let i = 0; i < 20 && !his.some((n) => n.type === 'interest_accepted'); i++) {
      await new Promise((r) => setTimeout(r, 50))
      his = (await list(him)).body.data
    }
    assert.ok(his.some((n) => n.type === 'interest_accepted'), 'he is told it was accepted')
  })

  test('reading marks them read, one or all', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    await send({ audience: 'user', target: her.email, title: 'One', body: 'a' })
    await send({ audience: 'user', target: her.email, title: 'Two', body: 'b' })
    const items = (await list(her)).body.data
    const one = items.find((n) => n.title === 'One')

    await server.request('POST', '/api/notifications/read', { token: her.token, body: { ids: [one.id] } })
    let now = (await list(her)).body.data
    assert.equal(now.find((n) => n.title === 'One').read, true)
    assert.equal(now.find((n) => n.title === 'Two').read, false)

    await server.request('POST', '/api/notifications/read', { token: her.token, body: {} })
    now = (await list(her)).body.data
    assert.ok(now.every((n) => n.read))
  })
})

describe('welcome and plan expiry', () => {
  async function waitFor(member, type) {
    for (let i = 0; i < 30; i++) {
      const items = (await list(member)).body.data
      const hit = items.find((n) => n.type === type)
      if (hit) return hit
      await new Promise((r) => setTimeout(r, 50))
    }
    return null
  }

  test('a new member is welcomed', async () => {
    const member = await signUpUser(server, { gender: 'female' })
    const welcome = await waitFor(member, 'welcome')
    assert.ok(welcome, 'the welcome is in their list')
    assert.equal(welcome.title, 'Welcome to Chaudhary Samaj')
  })

  async function subscription(userId, { hoursLeft, provider = 'razorpay', playState = null }) {
    await server.sql(
      `INSERT INTO user_subscriptions
         (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at, provider, play_state)
       VALUES ($1, 'premium', 100, 'p', 'o', 'active', NOW()::text,
               (NOW() + ($2 || ' hours')::interval)::text, $3, $4)`,
      [userId, String(hoursLeft), provider, playState]
    )
  }
  const runReminders = () =>
    server.request('POST', '/api/admin/notifications/expiry-reminders', { token: admin.token })
  const expiring = async (member) =>
    (await list(member)).body.data.filter((n) => n.type === 'plan_expiring')

  test('a plan ending in two days gets the 3-day reminder, once', async () => {
    const member = await signUpUser(server, { gender: 'male' })
    await subscription(member.userId, { hoursLeft: 48 })
    await runReminders()
    await runReminders()
    const got = await expiring(member)
    assert.equal(got.length, 1)
    assert.equal(got[0].title, 'Your plan ends in 3 days')
    assert.equal(got[0].data.screen, 'Subscriptions')
  })

  test('a plan ending tomorrow gets only the 1-day reminder', async () => {
    const member = await signUpUser(server, { gender: 'male' })
    await subscription(member.userId, { hoursLeft: 20 })
    await runReminders()
    const got = await expiring(member)
    assert.deepEqual(got.map((n) => n.title), ['Your plan ends tomorrow'])
  })

  test('a Play subscription that will renew is not warned', async () => {
    const member = await signUpUser(server, { gender: 'male' })
    await subscription(member.userId, { hoursLeft: 20, provider: 'google_play', playState: 'SUBSCRIPTION_STATE_ACTIVE' })
    await runReminders()
    assert.equal((await expiring(member)).length, 0)
  })

  test('a Play subscription the member cancelled is warned', async () => {
    const member = await signUpUser(server, { gender: 'male' })
    await subscription(member.userId, { hoursLeft: 20, provider: 'google_play', playState: 'SUBSCRIPTION_STATE_CANCELED' })
    await runReminders()
    assert.equal((await expiring(member)).length, 1)
  })

  test('a plan with weeks left is not warned', async () => {
    const member = await signUpUser(server, { gender: 'male' })
    await subscription(member.userId, { hoursLeft: 24 * 20 })
    await runReminders()
    assert.equal((await expiring(member)).length, 0)
  })
})

describe('profile viewed', () => {
  const view = (viewer, profileId) =>
    server.request('POST', `/api/matrimony/profiles/${profileId}/view`, { token: viewer.token })
  const views = async (member) =>
    (await list(member)).body.data.filter((n) => n.type === 'profile_viewed')
  const settle = () => new Promise((r) => setTimeout(r, 300))

  test('the owner is told, once per viewer per day', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    const herProfile = await profileIdOf(her.userId)

    await view(him, herProfile)
    await settle()
    await view(him, herProfile)
    await settle()

    const got = await views(her)
    assert.equal(got.length, 1)
    assert.equal(got[0].data.screen, 'Matrimony')
  })

  test('the notice does not name the viewer', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    const [{ full_name }] = await server.sql('SELECT full_name FROM users WHERE id = $1', [him.userId])

    await view(him, await profileIdOf(her.userId))
    await settle()

    const [got] = await views(her)
    assert.ok(got)
    assert.ok(!got.title.includes(full_name))
    assert.ok(!got.body.includes(full_name))
  })

  test('looking at your own profile tells no one', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    await view(her, await profileIdOf(her.userId))
    await settle()
    assert.equal((await views(her)).length, 0)
  })

  test('a busy day is capped', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const herProfile = await profileIdOf(her.userId)
    for (let i = 0; i < 7; i++) {
      const viewer = await signUpUser(server, { gender: 'male' })
      await view(viewer, herProfile)
      await settle()
    }
    assert.equal((await views(her)).length, 5)
  })
})

describe('retention', () => {
  test('notifications older than a month are not listed', async () => {
    const member = await signUpUser(server, { gender: 'female' })
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    await server.sql(
      `INSERT INTO notifications (id, user_id, type, title, body, created_at)
       VALUES ($1, $3, 'test', 'old', 'old', $4), ($2, $3, 'test', 'recent', 'recent', $5)`,
      [`old-${member.userId}`, `recent-${member.userId}`, member.userId, old, recent]
    )
    const titles = (await list(member)).body.data.filter((n) => n.type === 'test').map((n) => n.title)
    assert.deepEqual(titles, ['recent'])
  })
})

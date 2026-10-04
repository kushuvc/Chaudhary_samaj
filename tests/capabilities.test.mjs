import { test, describe, before, after, beforeEach } from 'node:test'
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

const putPlan = (code, body) =>
  server.request('PUT', `/api/admin/plans/${code}`, { token: admin.token, body })

const basicPlan = {
  name: 'Basic',
  durationDays: 30,
  pricePaise: 10000,
  playProductId: '',
  canViewPhone: false,
  canSendInterest: true,
  canChat: false,
}

/** Puts a member on a plan without going through a payment provider. */
async function subscribe(userId, planCode) {
  await server.sql(
    `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
     VALUES ($1, $2, 100, 'p_test', 'o_test', 'active', NOW()::text, (NOW() + INTERVAL '30 days')::text)
     ON CONFLICT (user_id) DO UPDATE SET plan = $2, status = 'active',
       expires_at = (NOW() + INTERVAL '30 days')::text`,
    [userId, planCode]
  )
}

/** A pair who have accepted each other, which contact numbers depend on. */
async function matchedPair() {
  const him = await signUpUser(server, { gender: 'male' })
  const her = await signUpUser(server, { gender: 'female' })

  const profiles = await server.request('GET', '/api/matrimony/profiles', { token: him.token })
  const herProfile = profiles.body.data.find((p) => !p.isLocked)

  await server.sql(
    `INSERT INTO matrimony_interests (id, sender_id, receiver_id, status, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, 'accepted', NOW()::text)`,
    [him.userId, her.userId]
  )

  const herProfileId = (
    await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
  )[0].id

  return { him, her, herProfileId, herPhone: her.phone, listed: herProfile }
}

describe('plans carry capabilities', () => {
  test('a plan created without them grants everything', async () => {
    await putPlan('everything', {
      name: 'Everything', durationDays: 30, pricePaise: 20000, playProductId: '',
    })
    const res = await server.request('GET', '/api/admin/plans', { token: admin.token })
    const plan = res.body.data.find((p) => p.code === 'everything')
    // A capability added later must never quietly take something away from a
    // plan that already existed.
    assert.deepEqual(plan.capabilities, {
      canViewPhone: true, canSendInterest: true, canChat: true,
      canViewPhoneUnmatched: false, canHidePhone: false,
    })
  })

  test('capabilities can be switched off and read back', async () => {
    await putPlan('basic', basicPlan)
    const res = await server.request('GET', '/api/payments/plans', { token: admin.token })
    const plan = res.body.data.find((p) => p.code === 'basic')
    assert.deepEqual(plan.capabilities, {
      canViewPhone: false, canSendInterest: true, canChat: false,
      canViewPhoneUnmatched: false, canHidePhone: false,
    })
  })

  test('a non-boolean capability is refused', async () => {
    const res = await putPlan('bad_caps', { ...basicPlan, canChat: 'yes' })
    assert.equal(res.status, 400)
  })
})

describe('a member is told what their own plan allows', () => {
  test('the status endpoint carries their capabilities', async () => {
    await putPlan('basic', basicPlan)
    const member = await signUpUser(server, { gender: 'male' })
    await subscribe(member.userId, 'basic')

    const res = await server.request('GET', '/api/payments/subscription', { token: member.token })
    assert.deepEqual(res.body.data.plan.capabilities, {
      canViewPhone: false, canSendInterest: true, canChat: false,
      canViewPhoneUnmatched: false, canHidePhone: false,
    })
  })
})

describe('contact numbers', () => {
  beforeEach(async () => {
    await putPlan('basic', basicPlan)
    await putPlan('full', {
      name: 'Full', durationDays: 30, pricePaise: 20000, playProductId: '',
      canViewPhone: true, canSendInterest: true, canChat: true,
    })
  })

  test('a plan that includes them hands the number over', async () => {
    const { him, herProfileId, herPhone } = await matchedPair()
    await subscribe(him.userId, 'full')

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: him.token,
    })
    assert.equal(res.status, 200)
    // The regression this guards: the endpoint used to answer `{unlocked:true}`
    // and nothing else, so every member was told the person had no number.
    assert.equal(res.body.data.phone, herPhone)
  })

  test('a plan without them is refused, and no number leaks', async () => {
    const { him, herProfileId } = await matchedPair()
    await subscribe(him.userId, 'basic')

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: him.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PLAN_UPGRADE_REQUIRED')
    assert.equal(res.body.data, undefined)
    assert.ok(!JSON.stringify(res.body).match(/\d{10}/), 'no phone number in the refusal')
  })

  test('no subscription at all is refused too', async () => {
    const { him, herProfileId } = await matchedPair()
    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: him.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED')
  })

  test('a number is not shared until both sides have accepted', async () => {
    const stranger = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    await subscribe(stranger.userId, 'full')

    const herProfileId = (
      await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
    )[0].id

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: stranger.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'INTEREST_REQUIRED')
  })

  test('the profile payload never carries a phone number', async () => {
    const { him, herProfileId } = await matchedPair()
    await subscribe(him.userId, 'full')

    const res = await server.request('GET', `/api/matrimony/profiles/${herProfileId}`, {
      token: him.token,
    })
    assert.equal(res.status, 200)
    // Even for a member allowed to see it, the number comes from the one route
    // that checks the interest — never as a field on the profile.
    assert.equal(res.body.data.phone, undefined)
  })
})

describe('sending interests', () => {
  test('a plan without it is refused by the server, not just the app', async () => {
    await putPlan('no_interest', {
      name: 'No interest', durationDays: 30, pricePaise: 10000, playProductId: '',
      canSendInterest: false,
    })
    const member = await signUpUser(server, { gender: 'male' })
    await subscribe(member.userId, 'no_interest')
    const her = await signUpUser(server, { gender: 'female' })
    const herProfileId = (
      await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
    )[0].id

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/interest`, {
      token: member.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PLAN_UPGRADE_REQUIRED')

    const stored = await server.sql(
      'SELECT id FROM matrimony_interests WHERE sender_id = $1',
      [member.userId]
    )
    assert.equal(stored.length, 0, 'nothing should have been recorded')
  })

  test('a plan with it goes through', async () => {
    await putPlan('full', {
      name: 'Full', durationDays: 30, pricePaise: 20000, playProductId: '',
    })
    const member = await signUpUser(server, { gender: 'male' })
    await subscribe(member.userId, 'full')
    const her = await signUpUser(server, { gender: 'female' })
    const herProfileId = (
      await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
    )[0].id

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/interest`, {
      token: member.token,
    })
    assert.equal(res.status, 200)
  })
})

describe('a free gender gets the capabilities set for it', () => {
  test('the seeded default is what the app already did, not everything', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const res = await server.request('GET', '/api/payments/subscription', { token: her.token })
    // Interests and chat were always open to non-payers; contact numbers were
    // not. Seeding these to all-true would have handed out numbers the moment
    // the switches started governing non-subscribers.
    assert.deepEqual(res.body.data.plan.capabilities, {
      canViewPhone: false, canSendInterest: true, canChat: true,
      canViewPhoneUnmatched: false, canHidePhone: false,
    })
  })

  test('a gender can be given everything deliberately', async () => {
    await server.request('PUT', '/api/admin/subscription-rules/female', {
      token: admin.token,
      body: { isFree: true, canViewPhone: true },
    })
    const her = await signUpUser(server, { gender: 'female' })
    const res = await server.request('GET', '/api/payments/subscription', { token: her.token })
    assert.equal(res.body.data.plan.freeForYou, true)
    assert.equal(res.body.data.plan.capabilities.canViewPhone, true)

    await server.request('PUT', '/api/admin/subscription-rules/female', {
      token: admin.token,
      body: { isFree: false, canViewPhone: false },
    })
  })

  test('a free gender can be restricted without charging them', async () => {
    await server.request('PUT', '/api/admin/subscription-rules/female', {
      token: admin.token,
      body: { isFree: true, canViewPhone: false },
    })

    const her = await signUpUser(server, { gender: 'female' })
    const status = await server.request('GET', '/api/payments/subscription', { token: her.token })
    assert.equal(status.body.data.plan.capabilities.canViewPhone, false)
    // Still free, still sees the directory — only the number is withheld.
    assert.equal(status.body.data.entitled, true)

    await server.request('PUT', '/api/admin/subscription-rules/female', {
      token: admin.token,
      body: { isFree: true, canViewPhone: true },
    })
  })
})

describe('a retired plan keeps working for whoever holds it', () => {
  test('capabilities still resolve after the plan leaves the shop', async () => {
    await putPlan('legacy', {
      name: 'Legacy', durationDays: 30, pricePaise: 5000, playProductId: '',
      canViewPhone: true, canSendInterest: true, canChat: true,
    })
    const member = await signUpUser(server, { gender: 'male' })
    await subscribe(member.userId, 'legacy')
    await putPlan('legacy', {
      name: 'Legacy', durationDays: 30, pricePaise: 5000, playProductId: '',
      canViewPhone: true, canSendInterest: true, canChat: true, isActive: false,
    })

    const res = await server.request('GET', '/api/payments/subscription', { token: member.token })
    // They paid for what it offered; taking it away because it left the shop
    // would be wrong.
    assert.equal(res.body.data.plan.capabilities.canViewPhone, true)
    assert.equal(res.body.data.entitled, true)
  })
})

describe('the per-gender switches govern every non-subscriber', () => {
  /*
   * They used to apply only when a gender was set to free, so unticking one on
   * a paid gender silently did nothing — the admin card looked like a control
   * and was not.
   */
  test('unticking interests stops a non-subscriber of that gender sending one', async () => {
    await server.request('PUT', '/api/admin/subscription-rules/male', {
      token: admin.token,
      body: { isFree: false, canSendInterest: false },
    })

    const him = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    const herProfileId = (
      await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
    )[0].id

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/interest`, {
      token: him.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED')

    await server.request('PUT', '/api/admin/subscription-rules/male', {
      token: admin.token,
      body: { isFree: false, canSendInterest: true },
    })
  })

  test('a subscription overrides the gender switches', async () => {
    await server.request('PUT', '/api/admin/subscription-rules/male', {
      token: admin.token,
      body: { isFree: false, canSendInterest: false },
    })
    await putPlan('full_interest', {
      name: 'Full', durationDays: 30, pricePaise: 20000, playProductId: '',
      canSendInterest: true,
    })

    const him = await signUpUser(server, { gender: 'male' })
    await subscribe(him.userId, 'full_interest')
    const her = await signUpUser(server, { gender: 'female' })
    const herProfileId = (
      await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
    )[0].id

    // Paying is what the plan is for: its switches win over the gender's.
    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/interest`, {
      token: him.token,
    })
    assert.equal(res.status, 200)

    await server.request('PUT', '/api/admin/subscription-rules/male', {
      token: admin.token,
      body: { isFree: false, canSendInterest: true },
    })
  })
})

describe('what a member without a subscription keeps', () => {
  /*
   * Introducing plan tiers must not take anything away from free members.
   * Before capabilities existed, interests and chat had no server gate and
   * contact numbers needed a subscription — that is what these pin.
   */
  test('they can still send an interest', async () => {
    const member = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    const herProfileId = (
      await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
    )[0].id

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/interest`, {
      token: member.token,
    })
    assert.equal(res.status, 200, 'a free member could always send interests')
  })

  test('they can still send a message to a match', async () => {
    const { him, her } = await matchedPair()
    const [match] = await server.sql(
      `INSERT INTO matrimony_matches (id, user1_id, user2_id, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, NOW()::text) RETURNING id`,
      [him.userId, her.userId]
    )

    const res = await server.request('POST', `/api/matrimony/matches/${match.id}/messages`, {
      token: him.token,
      body: { content: 'hello' },
    })
    assert.equal(res.status, 200, 'chat was never gated for free members')
  })

  test('but contact numbers still need a subscription', async () => {
    const { him, herProfileId } = await matchedPair()
    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: him.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED')
  })
})

describe('numbers without a match, and members hiding theirs', () => {
  const sharing = (token) => server.request('GET', '/api/settings', { token })
  const setSharing = (token, show) =>
    server.request('PUT', '/api/settings', { token, body: { privacy: { showPhoneToConnections: show } } })

  async function profileIdOf(userId) {
    return (await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [userId]))[0].id
  }

  beforeEach(async () => {
    await putPlan('full', {
      name: 'Full', durationDays: 30, pricePaise: 20000, playProductId: '',
      canViewPhone: true, canSendInterest: true, canChat: true,
    })
    await putPlan('open_book', {
      name: 'Open book', durationDays: 30, pricePaise: 30000, playProductId: '',
      canViewPhone: true, canSendInterest: true, canChat: true, canViewPhoneUnmatched: true,
    })
    await putPlan('private', {
      name: 'Private', durationDays: 30, pricePaise: 30000, playProductId: '',
      canViewPhone: true, canSendInterest: true, canChat: true, canHidePhone: true,
    })
  })

  test('both are off on a plan that does not mention them', async () => {
    const res = await server.request('GET', '/api/admin/plans', { token: admin.token })
    const full = res.body.data.find((plan) => plan.code === 'full')
    assert.equal(full.capabilities.canViewPhoneUnmatched, false)
    assert.equal(full.capabilities.canHidePhone, false)
  })

  test('a plan with numbers-without-a-match skips the interest check', async () => {
    const stranger = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    await subscribe(stranger.userId, 'open_book')

    const res = await server.request('POST', `/api/matrimony/profiles/${await profileIdOf(her.userId)}/unlock`, {
      token: stranger.token,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.phone, her.phone)
  })

  test('sharing is on for a member who never touched the setting', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const res = await sharing(her.token)
    assert.equal(res.body.data.privacy.showPhoneToConnections, true)
    assert.equal(res.body.data.canHidePhone, false)
  })

  test('hiding is refused without a plan that includes it', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const res = await setSharing(her.token, false)
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PLAN_NO_HIDE_PHONE')
    assert.equal((await sharing(her.token)).body.data.privacy.showPhoneToConnections, true)
  })

  test('a member on a hiding plan is not shared, and the refusal says why', async () => {
    const { him, her, herProfileId } = await matchedPair()
    await subscribe(him.userId, 'full')
    await subscribe(her.userId, 'private')
    assert.equal((await setSharing(her.token, false)).status, 200)

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: him.token,
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PHONE_HIDDEN')
    assert.ok(!JSON.stringify(res.body).match(/\d{10}/), 'no phone number in the refusal')
  })

  test('a hidden number is shared again once the hiding plan is gone', async () => {
    const { him, her, herProfileId, herPhone } = await matchedPair()
    await subscribe(him.userId, 'full')
    await subscribe(her.userId, 'private')
    await setSharing(her.token, false)
    await server.sql('DELETE FROM user_subscriptions WHERE user_id = $1', [her.userId])

    const res = await server.request('POST', `/api/matrimony/profiles/${herProfileId}/unlock`, {
      token: him.token,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.phone, herPhone)
  })
})

describe('unread messages', () => {
  test('reading a chat clears the unread count, even when the messages were cached', async () => {
    const { him, her } = await matchedPair()
    const matchId = 'm_' + him.userId.slice(0, 8)
    await server.sql(
      'INSERT INTO matrimony_matches (id, user1_id, user2_id, created_at) VALUES ($1, $2, $3, NOW()::text)',
      [matchId, him.userId, her.userId]
    )

    const sent = await server.request('POST', `/api/matrimony/matches/${matchId}/messages`, {
      token: him.token, body: { content: 'hello' },
    })
    assert.equal(sent.status, 200)

    const before = await server.request('GET', '/api/matrimony/matches?fresh=1', { token: her.token })
    assert.equal(before.body.data.find((m) => m.id === matchId).unreadCount, 1)

    // The sender's own fetch fills the message cache. Her read used to be
    // answered from that cache, which skipped marking anything read.
    await server.request('GET', `/api/matrimony/matches/${matchId}/messages`, { token: him.token })
    await server.request('GET', `/api/matrimony/matches/${matchId}/messages`, { token: her.token })

    const after = await server.request('GET', '/api/matrimony/matches?fresh=1', { token: her.token })
    assert.equal(after.body.data.find((m) => m.id === matchId).unreadCount, 0)

    const seen = await server.request('GET', `/api/matrimony/matches/${matchId}/messages`, { token: him.token })
    assert.ok(seen.body.data[0].isRead, 'the sender sees it as read')
  })
})

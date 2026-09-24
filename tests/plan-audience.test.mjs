import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * Plans can be offered to women only, men only, or everyone.
 *
 * Hiding a plan in the list is presentation; the purchase routes refuse it as
 * well, so a request made by hand cannot buy a plan meant for the other gender.
 *
 * Razorpay keys are fake. The refusal happens before any call to Razorpay, and
 * the verify route checks the signature locally, so nothing leaves the machine.
 */

let server
let admin
let man
let woman
let unknown

before(async () => {
  server = await startServer({
    env: { RAZORPAY_KEY_ID: 'rzp_test_fake', RAZORPAY_KEY_SECRET: 'fake_secret' },
  })
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  man = await signUpUser(server, { gender: 'male' })
  woman = await signUpUser(server, { gender: 'female' })
  unknown = await signUpUser(server, { gender: 'male' })
  await server.sql(`UPDATE matrimony_profiles SET gender = 'unspecified' WHERE user_id = $1`, [unknown.userId])

  const base = { durationDays: 30, pricePaise: 10000, sortOrder: 5 }
  for (const [code, audience] of [['for_women', 'female'], ['for_men', 'male'], ['for_all', 'all']]) {
    const res = await server.request('PUT', `/api/admin/plans/${code}`, {
      token: admin.token,
      body: { ...base, name: code, audience },
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
  }
})
after(async () => { await server?.stop() })

const codesFor = async (who) => {
  const res = await server.request('GET', '/api/payments/plans', who ? { token: who.token } : {})
  assert.equal(res.status, 200)
  return res.body.data.map((p) => p.code)
}

describe('who sees which plan', () => {
  test('a woman sees the women-only plan and not the men-only one', async () => {
    const codes = await codesFor(woman)
    assert.ok(codes.includes('for_women'))
    assert.ok(codes.includes('for_all'))
    assert.ok(!codes.includes('for_men'))
  })

  test('a man sees the men-only plan and not the women-only one', async () => {
    const codes = await codesFor(man)
    assert.ok(codes.includes('for_men'))
    assert.ok(codes.includes('for_all'))
    assert.ok(!codes.includes('for_women'))
  })

  test('a member with no recorded gender sees only the plans for everyone', async () => {
    const codes = await codesFor(unknown)
    assert.ok(codes.includes('for_all'))
    assert.ok(!codes.includes('for_women'))
    assert.ok(!codes.includes('for_men'))
  })

  test('plans that existed before this change are still offered to everyone', async () => {
    for (const who of [man, woman]) {
      assert.ok((await codesFor(who)).includes('premium'), 'the seeded plan disappeared')
    }
  })

  test('each plan says who it is for', async () => {
    const res = await server.request('GET', '/api/payments/plans', { token: woman.token })
    const women = res.body.data.find((p) => p.code === 'for_women')
    assert.equal(women.audience, 'female')
  })
})

describe('buying a plan meant for the other gender', () => {
  test('creating an order is refused', async () => {
    const res = await server.request('POST', '/api/payments/create-order', {
      token: man.token,
      body: { plan: 'for_women' },
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PLAN_NOT_FOR_MEMBER')
  })

  test('creating a payment link is refused', async () => {
    const res = await server.request('POST', '/api/payments/create-link', {
      token: woman.token,
      body: { plan: 'for_men' },
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PLAN_NOT_FOR_MEMBER')
  })

  test('verifying a payment against it is refused', async () => {
    const res = await server.request('POST', '/api/payments/verify', {
      token: man.token,
      body: { plan: 'for_women', razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' },
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'PLAN_NOT_FOR_MEMBER')
  })

  test('the right gender gets past the check', async () => {
    // Fails later on the fake signature — the point is it is not the 403.
    const res = await server.request('POST', '/api/payments/verify', {
      token: woman.token,
      body: { plan: 'for_women', razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' },
    })
    assert.notEqual(res.status, 403)
    assert.notEqual(res.body.code, 'PLAN_NOT_FOR_MEMBER')
  })
})

describe('setting the audience', () => {
  test('an unknown audience is refused', async () => {
    const res = await server.request('PUT', '/api/admin/plans/bad_audience', {
      token: admin.token,
      body: { name: 'x', durationDays: 30, pricePaise: 100, audience: 'everyone' },
    })
    assert.equal(res.status, 400)
  })

  test('leaving it out keeps what the plan already had', async () => {
    const res = await server.request('PUT', '/api/admin/plans/for_women', {
      token: admin.token,
      body: { name: 'for_women renamed', durationDays: 30, pricePaise: 10000 },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.audience, 'female')
  })

  test('changing it moves the plan between lists straight away', async () => {
    await server.request('PUT', '/api/admin/plans/for_men', {
      token: admin.token,
      body: { name: 'for_men', durationDays: 30, pricePaise: 10000, audience: 'all' },
    })
    assert.ok((await codesFor(woman)).includes('for_men'), 'the plans cache served a stale list')
  })
})

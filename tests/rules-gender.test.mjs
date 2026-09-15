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

const setRule = (gender, body, token) =>
  server.request('PUT', `/api/admin/subscription-rules/${gender}`, { token, body })

describe('subscription rules', () => {
  test('the seeded defaults make women free and men paid', async () => {
    const res = await server.request('GET', '/api/admin/subscription-rules', { token: admin.token })
    assert.equal(res.status, 200)
    const byGender = Object.fromEntries(res.body.data.map((r) => [r.gender, r]))
    assert.equal(byGender.female.is_free, true)
    assert.equal(byGender.male.is_free, false)
  })

  test('only an admin can read or change them', async () => {
    const member = await signUpUser(server)
    assert.equal((await server.request('GET', '/api/admin/subscription-rules')).status, 401)
    assert.equal(
      (await server.request('GET', '/api/admin/subscription-rules', { token: member.token })).status,
      403
    )
    assert.equal((await setRule('male', { isFree: true }, member.token)).status, 403)
  })

  test('an unknown gender is refused', async () => {
    assert.equal((await setRule('other', { isFree: true }, admin.token)).status, 400)
  })

  test('a non-numeric price is refused', async () => {
    assert.equal((await setRule('male', { pricePaise: 'free' }, admin.token)).status, 400)
  })
})

describe('women are free, men are not', () => {
  test('a woman sees every profile without paying', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    for (let i = 0; i < 5; i += 1) await signUpUser(server, { gender: 'male' })

    const res = await server.request('GET', '/api/matrimony/profiles', { token: her.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.access.subscribed, true)
    assert.equal(res.body.access.reason, 'free-for-gender')
    assert.equal(res.body.data.filter((p) => p.isLocked).length, 0)
  })

  test('a man still hits the paywall', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    for (let i = 0; i < 5; i += 1) await signUpUser(server, { gender: 'female' })

    const res = await server.request('GET', '/api/matrimony/profiles', { token: him.token })
    assert.equal(res.body.access.subscribed, false)
    assert.ok(res.body.data.filter((p) => p.isLocked).length > 0)
  })

  test('the subscription route tells the app it is free for her', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    const res = await server.request('GET', '/api/payments/subscription', { token: her.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.entitled, true)
    assert.equal(res.body.data.plan.freeForYou, true)
  })
})

describe('rules can be changed without a deploy', () => {
  test('making women paid takes effect immediately', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    for (let i = 0; i < 5; i += 1) await signUpUser(server, { gender: 'male' })

    const before = await server.request('GET', '/api/matrimony/profiles', { token: her.token })
    assert.equal(before.body.access.subscribed, true)

    const change = await setRule('female', { isFree: false }, admin.token)
    assert.equal(change.status, 200)

    const after = await server.request('GET', '/api/matrimony/profiles', { token: her.token })
    assert.equal(after.body.access.subscribed, false, 'the change must apply on the next request')
    assert.ok(after.body.data.filter((p) => p.isLocked).length > 0)

    await setRule('female', { isFree: true }, admin.token)
  })

  test('the price and free allowance are configurable', async () => {
    await setRule('male', { pricePaise: 49900, freeProfileLimit: 4 }, admin.token)

    const him = await signUpUser(server, { gender: 'male' })
    for (let i = 0; i < 8; i += 1) await signUpUser(server, { gender: 'female' })

    const res = await server.request('GET', '/api/matrimony/profiles', { token: him.token })
    assert.equal(res.body.access.freeLimit, 4)
    assert.equal(res.body.access.pricePaise, 49900)
    assert.equal(res.body.data.filter((p) => !p.isLocked).length, 4)

    await setRule('male', { pricePaise: 20000, freeProfileLimit: 2 }, admin.token)
  })
})

describe('members see only the opposite gender', () => {
  test('a man sees women only', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })
    await signUpUser(server, { gender: 'male' })

    const res = await server.request('GET', '/api/matrimony/profiles', { token: him.token })
    const genders = new Set(res.body.data.filter((p) => !p.isLocked).map((p) => p.gender))
    assert.ok(!genders.has('male'), `a man must not see men, saw: ${[...genders]}`)
  })

  test('a woman sees men only', async () => {
    const her = await signUpUser(server, { gender: 'female' })
    await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })

    const res = await server.request('GET', '/api/matrimony/profiles', { token: her.token })
    const genders = new Set(res.body.data.map((p) => p.gender).filter(Boolean))
    assert.ok(!genders.has('female'), `a woman must not see women, saw: ${[...genders]}`)
  })
})

describe('gender is fixed at signup', () => {
  test('a profile update cannot change it', async () => {
    const him = await signUpUser(server, { gender: 'male' })

    await server.request('PUT', '/api/matrimony/me', {
      token: him.token,
      body: { profile: { gender: 'female' }, matrimony: { gender: 'female' } },
    })

    const rows = await server.sql(
      'SELECT gender FROM matrimony_profiles WHERE user_id = $1', [him.userId]
    )
    assert.equal(String(rows[0]?.gender).toLowerCase(), 'male', 'gender must not be editable')
  })

  test('it cannot be used to grant free access', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    await server.request('PUT', '/api/matrimony/me', {
      token: him.token,
      body: { profile: { gender: 'female' } },
    })

    const res = await server.request('GET', '/api/matrimony/profiles', { token: him.token })
    assert.equal(res.body.access.subscribed, false, 'switching gender must not unlock the app')
  })
})

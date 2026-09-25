import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser, markEmailVerified } from './helpers/harness.mjs'

let server
let viewer

before(async () => {
  server = await startServer()
  viewer = await signUpUser(server, { gender: 'male' })
  // Without this the viewer sees only the free allowance, and a test that adds
  // another profile falls outside it — a paywall, not a mapping fault.
  await server.sql(
    `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
     VALUES ($1, 'premium', 200, 'p_test', 'o_test', 'active', NOW()::text, (NOW() + INTERVAL '30 days')::text)`,
    [viewer.userId]
  )
})
after(async () => { await server?.stop() })

/** Signs up with everything the real signup flow collects. */
async function fullSignup(overrides = {}) {
  const email = `full${Math.random().toString(36).slice(2, 9)}@example.com`
  await markEmailVerified(server, email)
  const res = await server.request('POST', '/api/auth/signup', {
    body: {
      fullName: 'Full Profile',
      email,
      password: 'testpass1234',
      confirmPassword: 'testpass1234',
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      gender: 'female',
      dateOfBirth: '1996-04-12',
      bio: 'I enjoy reading and long walks. Looking for a kind partner.',
      country: 'India',
      state: 'Gujarat',
      location: 'Ahmedabad',
      village: 'Brahmanvada',
      caste: 'Chaudhary',
      subcaste: 'Anjana',
      motherTongue: 'Gujarati',
      profileCreatedFor: 'myself',
      employmentType: 'Private',
      incomeCurrency: '₹ INR - Indian Rupee',
      annualIncome: '5 - 7 Lakh',
      openToAnySubcaste: true,
      ...overrides,
    },
  })
  assert.equal(res.status, 201, `signup failed: ${JSON.stringify(res.body)}`)
  return { email, userId: res.body.data.user.id, token: res.body.data.authToken }
}

/*
 * Two faults, both silent. Eight answers the signup steps collect never made
 * it into the request body, so the server stored its defaults — every profile
 * read "New member. Please update your profile." no matter what someone wrote.
 * And four fields that were stored correctly were never mapped into the
 * profile response, so the Location and Religious sections showed blank rows
 * while the answers sat in the database.
 */
describe('what signup collects reaches the database', () => {
  test('the bio a member writes is stored, not the placeholder', async () => {
    const me = await fullSignup()
    const [row] = await server.sql('SELECT bio FROM matrimony_profiles WHERE user_id = $1', [me.userId])
    assert.match(row.bio, /long walks/)
    assert.doesNotMatch(row.bio, /New member/, 'the default means the answer was dropped')
  })

  test('the other seven dropped fields are stored too', async () => {
    const me = await fullSignup()
    const [row] = await server.sql(
      `SELECT subcaste, mother_tongue, profile_created_for, employment_type,
              income_currency, annual_income, open_to_any_subcaste
       FROM matrimony_profiles WHERE user_id = $1`,
      [me.userId]
    )
    assert.equal(row.subcaste, 'Anjana')
    assert.equal(row.mother_tongue, 'Gujarati')
    assert.equal(row.profile_created_for, 'myself')
    assert.equal(row.employment_type, 'Private')
    assert.equal(row.income_currency, '₹ INR - Indian Rupee')
    assert.equal(row.annual_income, '5 - 7 Lakh')
  })
})

describe('what the database holds reaches the profile screen', () => {
  test('location and community fields are returned, not silently omitted', async () => {
    const her = await fullSignup()
    const [profile] = await server.sql(
      'SELECT id FROM matrimony_profiles WHERE user_id = $1',
      [her.userId]
    )

    const res = await server.request('GET', `/api/matrimony/profiles/${profile.id}`, {
      token: viewer.token,
    })
    assert.equal(res.status, 200)
    const p = res.body.data

    // The four the screen reads and the mapper used to drop.
    assert.equal(p.country, 'India', 'country must reach the app')
    assert.equal(p.state, 'Gujarat', 'state must reach the app')
    assert.equal(p.caste, 'Chaudhary', 'caste must reach the app')
    assert.equal(p.subCaste, 'Anjana', 'gol/subcaste must reach the app')

    // And the bio, which is the same bug seen from the other end.
    assert.match(p.bio, /long walks/)
  })

  test('the city shown comes from location, which is where it is stored', async () => {
    const her = await fullSignup()
    const [profile] = await server.sql(
      'SELECT id FROM matrimony_profiles WHERE user_id = $1',
      [her.userId]
    )
    const res = await server.request('GET', `/api/matrimony/profiles/${profile.id}`, {
      token: viewer.token,
    })
    // There is no city column; the screen reads `location` for it.
    assert.equal(res.body.data.location, 'Ahmedabad')
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
before(async () => {
  server = await startServer()
  const admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  // Everyone free, so the paywall does not get in the way of what is tested.
  for (const g of ['male', 'female']) {
    await server.request('PUT', `/api/admin/subscription-rules/${g}`, { token: admin.token, body: { isFree: true } })
  }
})
after(async () => { await server?.stop() })

const profileIdOf = async (userId) =>
  (await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [userId]))[0].id
const hide = (userId) =>
  server.sql('UPDATE matrimony_profiles SET hidden_from_listing = true WHERE user_id = $1', [userId])
const listIds = async (viewer) =>
  (await server.request('GET', '/api/matrimony/profiles?limit=100', { token: viewer.token })).body.data.map((p) => p.id)
// The listing cache lives for 5 s; a direct SQL change does not clear it.
const pastCache = () => new Promise((r) => setTimeout(r, 5200))

describe('hidden profile', () => {
  test('is left out of the list and its detail is not found for others', async () => {
    const operator = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    const operatorProfile = await profileIdOf(operator.userId)
    await hide(operator.userId)
    await pastCache()

    assert.ok(!(await listIds(her)).includes(operatorProfile))
    const detail = await server.request('GET', `/api/matrimony/profiles/${operatorProfile}`, { token: her.token })
    assert.equal(detail.status, 404)
  })

  test('its owner still browses and opens other profiles', async () => {
    const operator = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    const herProfile = await profileIdOf(her.userId)
    await hide(operator.userId)
    await pastCache()

    assert.ok((await listIds(operator)).includes(herProfile))
    const detail = await server.request('GET', `/api/matrimony/profiles/${herProfile}`, { token: operator.token })
    assert.equal(detail.status, 200)
    // And their own profile still opens for them.
    const own = await server.request('GET', `/api/matrimony/profiles/${await profileIdOf(operator.userId)}`, { token: operator.token })
    assert.equal(own.status, 200)
  })

  test('viewing a member sends them no "someone viewed your profile" notice', async () => {
    const operator = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    await hide(operator.userId)

    await server.request('POST', `/api/matrimony/profiles/${await profileIdOf(her.userId)}/view`, { token: operator.token })
    await new Promise((r) => setTimeout(r, 300))
    const notes = (await server.request('GET', '/api/notifications', { token: her.token })).body.data
    assert.equal(notes.filter((n) => n.type === 'profile_viewed').length, 0)
  })

  test('profiles are visible by default', async () => {
    const him = await signUpUser(server, { gender: 'male' })
    const her = await signUpUser(server, { gender: 'female' })
    await pastCache()
    assert.ok((await listIds(her)).includes(await profileIdOf(him.userId)))
  })
})

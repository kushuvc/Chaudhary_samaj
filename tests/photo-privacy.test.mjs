import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin
before(async () => {
  server = await startServer()
  admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  // Everyone free, so the paywall does not get in the way of what is tested.
  for (const g of ['male', 'female']) {
    await server.request('PUT', `/api/admin/subscription-rules/${g}`, { token: admin.token, body: { isFree: true } })
  }
})
after(async () => { await server?.stop() })

const PHOTO = [{ id: 'p1', uri: 'https://example.com/a.jpg', url: 'https://example.com/a.jpg', status: 'done', isPrimary: true }]
const setPrivacy = (gender, on) =>
  server.request('PUT', `/api/admin/subscription-rules/${gender}`, { token: admin.token, body: { photoPrivacy: on } })

async function womanWithPhoto() {
  const her = await signUpUser(server, { gender: 'female' })
  await server.sql('UPDATE matrimony_profiles SET photos = $2::jsonb WHERE user_id = $1', [her.userId, JSON.stringify(PHOTO)])
  const [row] = await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [her.userId])
  return { ...her, profileId: row.id }
}
const seen = async (viewer, profileId) => {
  const list = await server.request('GET', '/api/matrimony/profiles?limit=50', { token: viewer.token })
  const card = list.body.data.find((p) => p.id === profileId)
  const detail = (await server.request('GET', `/api/matrimony/profiles/${profileId}`, { token: viewer.token })).body.data
  return { card, detail }
}

describe('photo privacy', () => {
  test('off by default: photos are shown', async () => {
    const her = await womanWithPhoto()
    const him = await signUpUser(server, { gender: 'male' })
    const { card, detail } = await seen(him, her.profileId)
    assert.equal(card.photos.length, 1)
    assert.equal(detail.photos.length, 1)
    assert.equal(card.photosHidden, undefined)
  })

  test('on for women: their photos are withheld in the list and the detail', async () => {
    assert.equal((await setPrivacy('female', true)).body.data.photo_privacy, true)
    const her = await womanWithPhoto()
    const him = await signUpUser(server, { gender: 'male' })
    const { card, detail } = await seen(him, her.profileId)
    assert.deepEqual(card.photos, [])
    assert.equal(card.photosHidden, true)
    assert.deepEqual(detail.photos, [])
    assert.equal(detail.photosHidden, true)
    assert.ok(card.name, 'the rest of the card is still shown')
  })

  test('an accepted interest reveals them, either direction', async () => {
    await setPrivacy('female', true)
    const her = await womanWithPhoto()
    const him = await signUpUser(server, { gender: 'male' })
    await server.request('POST', `/api/matrimony/profiles/${her.profileId}/interest`, { token: him.token })
    const [interest] = await server.sql('SELECT id FROM matrimony_interests WHERE sender_id = $1', [him.userId])
    // Pending is not enough.
    assert.equal((await seen(him, her.profileId)).detail.photosHidden, true)
    await server.request('PUT', `/api/matrimony/interests/${interest.id}`, { token: her.token, body: { accept: true } })
    const { card, detail } = await seen(him, her.profileId)
    assert.equal(card.photos.length, 1)
    assert.equal(detail.photos.length, 1)
  })

  test('only the chosen gender is affected, and switching off restores photos', async () => {
    await setPrivacy('female', false)
    const her = await womanWithPhoto()
    const him = await signUpUser(server, { gender: 'male' })
    assert.equal((await seen(him, her.profileId)).card.photos.length, 1)
  })
})

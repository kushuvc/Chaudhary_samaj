import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let member

before(async () => {
  server = await startServer()
  member = await signUpUser(server, { gender: 'male' })
})
after(async () => { await server?.stop() })

const photo = (n) => ({
  id: `p${n}`,
  uri: `https://example.com/${n}.jpg`,
  url: `https://example.com/${n}.jpg`,
  status: 'done',
  isPrimary: n === 1,
})

describe('a profile keeps at most two photos', () => {
  test('two are saved', async () => {
    const res = await server.request('PUT', '/api/matrimony/me', {
      token: member.token,
      body: { profile: { photos: [photo(1), photo(2)] } },
    })
    assert.equal(res.status, 200)

    const me = await server.request('GET', '/api/matrimony/me', { token: member.token })
    assert.equal(me.body.data.profile.photos.length, 2)
  })

  test('more than two are trimmed, not rejected', async () => {
    // An older build still offering six must not be left unable to save at all.
    const res = await server.request('PUT', '/api/matrimony/me', {
      token: member.token,
      body: { profile: { photos: [1, 2, 3, 4, 5, 6].map(photo) } },
    })
    assert.equal(res.status, 200)

    const me = await server.request('GET', '/api/matrimony/me', { token: member.token })
    assert.equal(me.body.data.profile.photos.length, 2, 'the cap is enforced server-side')
    assert.equal(me.body.data.profile.photos[0].id, 'p1', 'the first ones are kept')
  })
})

describe('the app agrees with the server', () => {
  test('both screens offer the same number', () => {
    const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
    assert.match(src('../apps/mobile/src/screens/SignupManagePhotosScreen.tsx'), /const MAX_PHOTOS = 2;/)
    assert.match(src('../apps/mobile/src/components/PhotoManager.tsx'), /maxPhotos = 2 \}/)
    assert.match(src('../server/index.js'), /const MAX_PROFILE_PHOTOS = 2/)
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * The bookmark on every profile card has been writing a shortlist since the
 * screen shipped; nothing read it back, so these guard the round trip the
 * Shortlisted tab now depends on.
 */

let server
let browser
let target

before(async () => {
  server = await startServer()
  browser = await signUpUser(server, { gender: 'male' })
  target = await signUpUser(server, { gender: 'female', fullName: 'Shortlist Target' })
})
after(async () => { await server?.stop() })

async function profileIdOf(userId) {
  const rows = await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [userId])
  return rows[0].id
}

async function listTab(tab) {
  const res = await server.request('GET', `/api/matrimony/profiles?tab=${tab}&limit=50`, { token: browser.token })
  assert.equal(res.status, 200)
  return res.body.data
}

describe('shortlisting a profile', () => {
  test('it starts empty', async () => {
    assert.deepEqual(await listTab('shortlisted'), [])
  })

  test('shortlisting puts the profile on the shortlisted tab', async () => {
    const id = await profileIdOf(target.userId)
    const res = await server.request('POST', `/api/matrimony/profiles/${id}/shortlist`, { token: browser.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.shortlisted, true)

    // The listing is cached per viewer, so this also proves the write
    // invalidates that cache rather than leaving the tab stale.
    const shortlisted = await listTab('shortlisted')
    assert.equal(shortlisted.length, 1)
    assert.equal(shortlisted[0].id, id)
    assert.equal(shortlisted[0].isShortlisted, true)
  })

  test('shortlisting again removes it', async () => {
    const id = await profileIdOf(target.userId)
    const res = await server.request('POST', `/api/matrimony/profiles/${id}/shortlist`, { token: browser.token })
    assert.equal(res.body.data.shortlisted, false)
    assert.deepEqual(await listTab('shortlisted'), [])
  })

  test('one member’s shortlist is not another’s', async () => {
    const other = await signUpUser(server, { gender: 'male' })
    const id = await profileIdOf(target.userId)
    await server.request('POST', `/api/matrimony/profiles/${id}/shortlist`, { token: browser.token })

    const res = await server.request('GET', '/api/matrimony/profiles?tab=shortlisted&limit=50', { token: other.token })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, [], 'another member saw a shortlist that was not theirs')
  })

  test('shortlisting requires a session', async () => {
    const id = await profileIdOf(target.userId)
    const res = await server.request('POST', `/api/matrimony/profiles/${id}/shortlist`)
    assert.equal(res.status, 401)
  })

  test('an unknown profile is a 404, not a 500', async () => {
    const res = await server.request('POST', '/api/matrimony/profiles/profile-does-not-exist/shortlist', { token: browser.token })
    assert.equal(res.status, 404)
  })
})

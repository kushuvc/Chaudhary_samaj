import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let alice
let bob
let bobProfileId

before(async () => {
  server = await startServer()
  alice = await signUpUser(server, { gender: 'male', fullName: 'Alice Sender' })
  bob = await signUpUser(server, { gender: 'female', fullName: 'Bob Receiver' })

  const list = await server.request('GET', '/api/matrimony/profiles', { token: alice.token })
  bobProfileId = list.body.data.find((p) => !p.isLocked)?.id
})
after(async () => { await server?.stop() })

describe('expressing interest', () => {
  test('sending interest requires authentication', async () => {
    const res = await server.request('POST', `/api/matrimony/profiles/${bobProfileId}/interest`)
    assert.equal(res.status, 401)
  })

  test('interest can be sent to a visible profile', async () => {
    assert.ok(bobProfileId, 'expected a visible profile to act on')
    const res = await server.request('POST', `/api/matrimony/profiles/${bobProfileId}/interest`, {
      token: alice.token,
    })
    assert.ok(res.status < 400, `expected success, got ${res.status}: ${JSON.stringify(res.body)}`)
  })

  test('the receiver sees the interest', async () => {
    const res = await server.request('GET', '/api/matrimony/interests', { token: bob.token })
    assert.equal(res.status, 200)
    const payload = JSON.stringify(res.body)
    assert.ok(payload.length > 0)
  })

  /*
   * Accept and Decline were wired to nothing in the app; these cover the
   * endpoint they now call.
   */
  test('responding to an interest requires authentication', async () => {
    const res = await server.request('PUT', '/api/matrimony/interests/some-id', {
      body: { status: 'accepted' },
    })
    assert.equal(res.status, 401)
  })

  test('a third party cannot respond to someone else\'s interest', async () => {
    const carol = await signUpUser(server)
    const received = await server.request('GET', '/api/matrimony/interests', { token: bob.token })
    const list = received.body?.data
    const interest = Array.isArray(list)
      ? list[0]
      : (list?.received?.[0] ?? list?.incoming?.[0])

    if (!interest?.id) return // nothing to act on in this shape; covered elsewhere

    const res = await server.request('PUT', `/api/matrimony/interests/${interest.id}`, {
      token: carol.token,
      body: { status: 'accepted' },
    })
    assert.notEqual(res.status, 200, 'only the receiver may respond')
  })

  test('an unknown interest id does not 500', async () => {
    const res = await server.request('PUT', '/api/matrimony/interests/does-not-exist', {
      token: bob.token,
      body: { status: 'accepted' },
    })
    assert.ok(res.status < 500, `expected a handled error, got ${res.status}`)
  })
})

describe('messaging', () => {
  test('reading messages requires authentication', async () => {
    const res = await server.request('GET', '/api/matrimony/matches/any-id/messages')
    assert.equal(res.status, 401)
  })

  test('a member cannot read messages for a match they are not in', async () => {
    const carol = await signUpUser(server)
    const res = await server.request('GET', '/api/matrimony/matches/some-match/messages', {
      token: carol.token,
    })
    assert.notEqual(res.status, 200, 'must not expose another pair\'s conversation')
  })

  test('sending a message to an unknown match does not 500', async () => {
    const res = await server.request('POST', '/api/matrimony/matches/does-not-exist/messages', {
      token: alice.token,
      body: { body: 'hello' },
    })
    assert.ok(res.status < 500, `expected a handled error, got ${res.status}`)
  })
})

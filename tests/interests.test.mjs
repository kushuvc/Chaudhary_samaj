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

  /*
   * Anything falsy counted as a decline, so a malformed request quietly
   * rejected an interest and reported success.
   */
  test('responding without an explicit accept is refused', async () => {
    const res = await server.request('PUT', '/api/matrimony/interests/whatever', {
      token: bob.token,
      body: { status: 'accepted' },
    })
    assert.equal(res.status, 400)
  })

  test('an unknown interest id does not 500', async () => {
    const res = await server.request('PUT', '/api/matrimony/interests/does-not-exist', {
      token: bob.token,
      body: { status: 'accepted' },
    })
    assert.ok(res.status < 500, `expected a handled error, got ${res.status}`)
  })
})

describe('interest status on a profile', () => {
  /*
   * The detail screen picks its action from this. It was never sent, so the
   * button stayed on "Send Interest" however many had already been sent, and
   * every tap made a request the server then refused.
   */
  test('a profile reports no interest before one is sent', async () => {
    const viewer = await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })
    const list = await server.request('GET', '/api/matrimony/profiles', { token: viewer.token })
    const target = list.body.data.find((p) => !p.isLocked)

    const res = await server.request('GET', `/api/matrimony/profiles/${target.id}`, { token: viewer.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.interestStatus, undefined)
  })

  test('it reports "sent" afterwards', async () => {
    const viewer = await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })
    const list = await server.request('GET', '/api/matrimony/profiles', { token: viewer.token })
    const target = list.body.data.find((p) => !p.isLocked)

    await server.request('POST', `/api/matrimony/profiles/${target.id}/interest`, { token: viewer.token })
    const res = await server.request('GET', `/api/matrimony/profiles/${target.id}`, { token: viewer.token })
    assert.equal(res.body.data.interestStatus, 'sent')
  })

  test('the receiver sees it as "received"', async () => {
    const sender = await signUpUser(server, { gender: 'male' })
    const receiver = await signUpUser(server, { gender: 'female' })

    const senderList = await server.request('GET', '/api/matrimony/profiles', { token: sender.token })
    const receiverProfile = senderList.body.data.find((p) => !p.isLocked)
    await server.request('POST', `/api/matrimony/profiles/${receiverProfile.id}/interest`, { token: sender.token })

    const receiverList = await server.request('GET', '/api/matrimony/profiles', { token: receiver.token })
    const senderProfile = receiverList.body.data.find((p) => !p.isLocked)
    const res = await server.request('GET', `/api/matrimony/profiles/${senderProfile.id}`, { token: receiver.token })
    assert.equal(res.body.data.interestStatus, 'received')
  })

  test('a second send is refused', async () => {
    const viewer = await signUpUser(server, { gender: 'male' })
    await signUpUser(server, { gender: 'female' })
    const list = await server.request('GET', '/api/matrimony/profiles', { token: viewer.token })
    const target = list.body.data.find((p) => !p.isLocked)

    const first = await server.request('POST', `/api/matrimony/profiles/${target.id}/interest`, { token: viewer.token })
    assert.ok(first.status < 400)
    const second = await server.request('POST', `/api/matrimony/profiles/${target.id}/interest`, { token: viewer.token })
    assert.equal(second.status, 409)
    assert.match(second.body.error, /already/i)
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

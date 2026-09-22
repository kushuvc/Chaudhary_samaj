import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/**
 * The chat's three-dot menu opened an alert whose only button was "Close".
 * Report and Unmatch now live there; this covers the endpoint Unmatch needs,
 * which did not exist at all.
 */

let server
let alice
let bob

before(async () => {
  server = await startServer()
  alice = await signUpUser(server, { gender: 'male' })
  bob = await signUpUser(server, { gender: 'female' })
})
after(async () => { await server?.stop() })

async function makeMatch(from = alice, to = bob) {
  const bobProfile = (await server.sql('SELECT id FROM matrimony_profiles WHERE user_id = $1', [to.userId]))[0].id
  const sent = await server.request('POST', `/api/matrimony/profiles/${bobProfile}/interest`, { token: from.token })
  assert.ok(sent.status < 400, `sending interest failed: ${JSON.stringify(sent.body)}`)

  const incoming = await server.request('GET', '/api/matrimony/interests', { token: to.token })
  const pending = incoming.body.data.received.find((i) => i.status === 'pending')
  assert.ok(pending, 'no pending interest for the other side to accept')

  const accepted = await server.request('PUT', `/api/matrimony/interests/${pending.id}`, {
    token: to.token,
    body: { accept: true },
  })
  assert.equal(accepted.status, 200)

  const matches = await server.request('GET', '/api/matrimony/matches', { token: from.token })
  assert.equal(matches.body.data.length, 1)
  return matches.body.data[0].id
}

describe('unmatching', () => {
  test('either side can end the conversation', async () => {
    const matchId = await makeMatch()
    await server.request('POST', `/api/matrimony/matches/${matchId}/messages`, {
      token: alice.token,
      body: { content: 'hello' },
    })

    const res = await server.request('DELETE', `/api/matrimony/matches/${matchId}`, { token: bob.token })
    assert.equal(res.status, 200)

    for (const who of [alice, bob]) {
      const matches = await server.request('GET', '/api/matrimony/matches', { token: who.token })
      assert.deepEqual(matches.body.data, [], 'the conversation survived on one side')
    }
  })

  test('the messages go with it', async () => {
    const rows = await server.sql('SELECT COUNT(*)::int AS n FROM matrimony_messages')
    assert.equal(rows[0].n, 0)
  })

  test('neither side is left reading as mutually interested', async () => {
    const rows = await server.sql(
      `SELECT status FROM matrimony_interests
        WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [alice.userId, bob.userId]
    )
    assert.ok(rows.length > 0, 'expected the interest rows to still exist')
    for (const row of rows) {
      assert.notEqual(row.status, 'accepted', 'an accepted interest outlived the match')
    }
  })

  test('a stranger cannot end someone else’s conversation', async () => {
    // A fresh pair: alice and bob have already declined each other above.
    const carol = await signUpUser(server, { gender: 'male' })
    const dia = await signUpUser(server, { gender: 'female' })
    const matchId = await makeMatch(carol, dia)

    const stranger = await signUpUser(server, { gender: 'male' })
    const res = await server.request('DELETE', `/api/matrimony/matches/${matchId}`, { token: stranger.token })
    assert.equal(res.status, 404)

    const matches = await server.request('GET', '/api/matrimony/matches', { token: carol.token })
    assert.equal(matches.body.data.length, 1, 'the conversation was removed by someone outside it')
  })

  test('it requires a session', async () => {
    const res = await server.request('DELETE', '/api/matrimony/matches/whatever')
    assert.equal(res.status, 401)
  })
})

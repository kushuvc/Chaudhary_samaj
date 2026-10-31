import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/*
 * A block (or a report, which blocks) must hold on every route between the two
 * members, not only in the Matrimony list. Ticket CS-1016: a woman declined and
 * reported a man, who kept sending interests anyway until she deleted her account.
 */
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
const sendInterest = (from, to) =>
  server.request('POST', `/api/matrimony/profiles/${to.profileId}/interest`, { token: from.token })
const interestsOf = async (member) => (await server.request('GET', '/api/matrimony/interests', { token: member.token })).body.data
const respond = (member, interestId, accept) =>
  server.request('PUT', `/api/matrimony/interests/${interestId}`, { token: member.token, body: { accept } })
const pushesOf = async (member, type) =>
  (await server.request('GET', '/api/notifications', { token: member.token })).body.data.filter((n) => n.type === type)
const settle = () => new Promise((r) => setTimeout(r, 300))

async function pair() {
  const him = await signUpUser(server, { gender: 'male' })
  const her = await signUpUser(server, { gender: 'female' })
  him.profileId = await profileIdOf(him.userId)
  her.profileId = await profileIdOf(her.userId)
  return { him, her }
}

async function matched() {
  const { him, her } = await pair()
  await sendInterest(him, her)
  const [received] = (await interestsOf(her)).received
  await respond(her, received.id, true)
  const [match] = (await server.request('GET', '/api/matrimony/matches?fresh=1', { token: her.token })).body.data
  return { him, her, matchId: match.id }
}

describe('a declined interest', () => {
  test('cannot be sent again, and sends her no new push', async () => {
    const { him, her } = await pair()
    assert.equal((await sendInterest(him, her)).status, 200)
    await settle()
    const [received] = (await interestsOf(her)).received
    assert.equal((await respond(her, received.id, false)).status, 200)

    const again = await sendInterest(him, her)
    assert.equal(again.status, 409)
    assert.equal(again.body.code, 'INTEREST_DECLINED')
    await settle()
    assert.equal((await pushesOf(her, 'interest_received')).length, 1, 'only the first interest notified her')
    const [row] = await server.sql('SELECT status FROM matrimony_interests WHERE sender_id = $1', [him.userId])
    assert.equal(row.status, 'declined')
  })

  test('the member who declined can still send her own interest later', async () => {
    const { him, her } = await pair()
    await sendInterest(him, her)
    const [received] = (await interestsOf(her)).received
    await respond(her, received.id, false)
    assert.equal((await sendInterest(her, him)).status, 200)
  })

  test('an interest already pending is not sent twice', async () => {
    const { him, her } = await pair()
    await sendInterest(him, her)
    assert.equal((await sendInterest(him, her)).status, 409)
  })
})

describe('after a report (which blocks)', () => {
  test('the reported member cannot send interests, open the profile, or take the number', async () => {
    const { him, her } = await pair()
    const reported = await server.request('POST', `/api/matrimony/profiles/${him.profileId}/report`, {
      token: her.token,
      body: { reason: 'harassment' },
    })
    assert.equal(reported.status, 201)

    assert.equal((await sendInterest(him, her)).status, 404)
    assert.equal((await server.request('GET', `/api/matrimony/profiles/${her.profileId}`, { token: him.token })).status, 404)
    for (const action of ['view', 'shortlist']) {
      const res = await server.request('POST', `/api/matrimony/profiles/${her.profileId}/${action}`, { token: him.token })
      assert.equal(res.status, 404, action)
    }
    // A free plan is refused the number before the block is even looked at;
    // either way nothing comes back.
    const unlock = await server.request('POST', `/api/matrimony/profiles/${her.profileId}/unlock`, { token: him.token })
    assert.ok([403, 404].includes(unlock.status), `unlock answered ${unlock.status}`)
    assert.equal(unlock.body?.data?.phone, undefined)
    await settle()
    assert.equal((await pushesOf(her, 'interest_received')).length, 0)
    assert.equal((await pushesOf(her, 'profile_viewed')).length, 0)
  })

  test('she cannot reach him either: a block cuts both ways', async () => {
    const { him, her } = await pair()
    await server.request('POST', `/api/matrimony/profiles/${him.profileId}/report`, { token: her.token, body: { reason: 'harassment' } })
    assert.equal((await sendInterest(her, him)).status, 404)
    assert.equal((await server.request('GET', `/api/matrimony/profiles/${him.profileId}`, { token: her.token })).status, 404)
  })

  test("a pending interest from him leaves her list and cannot be accepted", async () => {
    const { him, her } = await pair()
    await sendInterest(him, her)
    const [received] = (await interestsOf(her)).received
    await server.request('POST', `/api/matrimony/profiles/${him.profileId}/block`, { token: her.token })
    assert.equal((await interestsOf(her)).received.length, 0)
    assert.equal((await interestsOf(him)).sent.length, 0)
    assert.equal((await respond(her, received.id, true)).status, 404)
    // Declining is still allowed.
    assert.equal((await respond(her, received.id, false)).status, 200)
  })
})

describe('a block between matched members', () => {
  test('ends the chat for both: no list entry, no reading, no sending', async () => {
    const { him, her, matchId } = await matched()
    await server.request('POST', `/api/matrimony/profiles/${him.profileId}/block`, { token: her.token })

    for (const member of [him, her]) {
      const list = (await server.request('GET', '/api/matrimony/matches?fresh=1', { token: member.token })).body.data
      assert.equal(list.length, 0)
      assert.equal((await server.request('GET', `/api/matrimony/matches/${matchId}/messages`, { token: member.token })).status, 404)
      const sent = await server.request('POST', `/api/matrimony/matches/${matchId}/messages`, { token: member.token, body: { content: 'hello' } })
      assert.equal(sent.status, 404)
    }
    const [{ n }] = await server.sql('SELECT COUNT(*)::int AS n FROM matrimony_messages WHERE match_id = $1', [matchId])
    assert.equal(n, 0)
  })

  test('without a block the chat still works', async () => {
    const { him, matchId } = await matched()
    const sent = await server.request('POST', `/api/matrimony/matches/${matchId}/messages`, { token: him.token, body: { content: 'hello' } })
    assert.equal(sent.status, 200)
  })
})

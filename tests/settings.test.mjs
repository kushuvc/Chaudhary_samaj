import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let user

before(async () => {
  server = await startServer()
  user = await signUpUser(server)
})
after(async () => { await server?.stop() })

describe('settings', () => {
  test('reading settings requires authentication', async () => {
    const res = await server.request('GET', '/api/settings')
    assert.equal(res.status, 401)
  })

  /*
   * The SELECT asked for notifications_json and privacy_json, columns that
   * have never existed in the table migrate.js creates, so every settings load
   * answered 500 in production. The contract test did not catch it because it
   * only asserted the route was not a 404.
   */
  test('a member with no saved settings gets defaults', async () => {
    const res = await server.request('GET', '/api/settings', { token: user.token })
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    assert.equal(res.body.data.language, 'en-IN')
    assert.equal(typeof res.body.data.notifications, 'object')
    assert.equal(typeof res.body.data.privacy, 'object')
  })

  test('settings survive a round trip', async () => {
    const write = await server.request('PUT', '/api/settings', {
      token: user.token,
      body: {
        language: 'gu-IN',
        timezone: 'Asia/Kolkata',
        publicProfile: false,
        notifications: {
          communityAnnouncements: false,
          matrimonyMatches: true,
          eventReminders: false,
          securityAlerts: true,
          marketingUpdates: true,
        },
        privacy: {
          showPhoneToConnections: true,
          showLocationPublicly: false,
          profileSearchable: false,
        },
      },
    })
    assert.ok(write.status < 400, `write failed ${write.status}: ${JSON.stringify(write.body)}`)

    const read = await server.request('GET', '/api/settings', { token: user.token })
    assert.equal(read.status, 200, `read failed: ${JSON.stringify(read.body)}`)

    const data = read.body.data
    assert.equal(data.language, 'gu-IN')
    assert.equal(data.publicProfile, false)
    assert.equal(data.notifications.communityAnnouncements, false)
    assert.equal(data.notifications.marketingUpdates, true)
    assert.equal(data.privacy.showPhoneToConnections, true)
    assert.equal(data.privacy.profileSearchable, false)
  })

  /*
   * The app only ever sends the fields it changed. Every column is NOT NULL,
   * so a partial first save used to violate the constraint and fail with a
   * 500 while the screen looked like it had worked.
   */
  test('a partial save works on a member with no settings row yet', async () => {
    const fresh = await signUpUser(server)

    const res = await server.request('PUT', '/api/settings', {
      token: fresh.token,
      body: { language: 'gu-IN', privacy: { profileSearchable: false } },
    })
    assert.ok(res.status < 400, `partial save failed ${res.status}: ${JSON.stringify(res.body)}`)

    const read = await server.request('GET', '/api/settings', { token: fresh.token })
    assert.equal(read.status, 200)
    assert.equal(read.body.data.language, 'gu-IN')
    assert.equal(read.body.data.privacy.profileSearchable, false)
    // Untouched fields take their defaults rather than becoming null.
    assert.equal(read.body.data.timezone, 'Asia/Kolkata')
    assert.equal(read.body.data.privacy.showLocationPublicly, true)
  })

  test('a second partial save leaves the untouched fields alone', async () => {
    const fresh = await signUpUser(server)
    await server.request('PUT', '/api/settings', {
      token: fresh.token,
      body: { language: 'hi-IN', privacy: { showPhoneToConnections: true } },
    })
    await server.request('PUT', '/api/settings', {
      token: fresh.token,
      body: { privacy: { profileSearchable: false } },
    })

    const read = await server.request('GET', '/api/settings', { token: fresh.token })
    assert.equal(read.body.data.language, 'hi-IN', 'the earlier language must survive')
    assert.equal(read.body.data.privacy.showPhoneToConnections, true)
    assert.equal(read.body.data.privacy.profileSearchable, false)
  })

  test('writing settings requires authentication', async () => {
    const res = await server.request('PUT', '/api/settings', { body: { language: 'en-IN' } })
    assert.equal(res.status, 401)
  })

  test('one member cannot read another member\'s settings', async () => {
    const other = await signUpUser(server)
    await server.request('PUT', '/api/settings', {
      token: other.token,
      body: { language: 'hi-IN' },
    })

    const res = await server.request('GET', '/api/settings', { token: user.token })
    assert.equal(res.status, 200)
    assert.notEqual(res.body.data.language, 'hi-IN', 'must return the caller\'s own settings')
  })
})

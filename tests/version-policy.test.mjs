import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
let admin
before(async () => {
  server = await startServer()
  admin = await signUpUser(server)
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

const put = (body, token = admin.token) => server.request('PUT', '/api/admin/app/version-policy', { token, body })

describe('app update prompt settings', () => {
  test('off by default, readable without signing in', async () => {
    const res = await server.request('GET', '/api/app/version-policy')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, { latestVersionCode: 0, minVersionCode: 0 })
  })

  test('an admin sets it and the app sees it at once', async () => {
    assert.equal((await put({ latestVersionCode: 50, minVersionCode: 48 })).status, 200)
    const res = await server.request('GET', '/api/app/version-policy')
    assert.deepEqual(res.body.data, { latestVersionCode: 50, minVersionCode: 48 })
  })

  test('nonsense is refused', async () => {
    assert.equal((await put({ latestVersionCode: 40, minVersionCode: 50 })).status, 400)
    assert.equal((await put({ latestVersionCode: -1 })).status, 400)
    assert.equal((await put({ latestVersionCode: 'abc' })).status, 400)
  })

  test('only admins can change it', async () => {
    const member = await signUpUser(server)
    assert.equal((await put({ latestVersionCode: 1 }, member.token)).status, 403)
  })

  test('0 switches it off again', async () => {
    await put({ latestVersionCode: 0, minVersionCode: 0 })
    const res = await server.request('GET', '/api/app/version-policy')
    assert.deepEqual(res.body.data, { latestVersionCode: 0, minVersionCode: 0 })
  })
})

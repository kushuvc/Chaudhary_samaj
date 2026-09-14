import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

test('health endpoint responds', async () => {
  const res = await server.request('GET', '/api/health')
  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
})

test('signup creates an account and returns a token', async () => {
  const user = await signUpUser(server)
  assert.ok(user.token, 'expected an auth token')
  assert.ok(user.userId, 'expected a user id')
})

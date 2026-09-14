import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'

/*
 * Every path the mobile app calls, asserted to still exist.
 *
 * The app and the API ship separately: a route renamed on the server reaches
 * users as a screen that silently shows nothing, because the client treats a
 * 404 like an empty result. These assert only that the route is routed — the
 * status may be anything except 404.
 */
const MOBILE_ENDPOINTS = [
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/signup'],
  ['POST', '/api/auth/otp/request'],
  ['POST', '/api/auth/otp/verify'],
  ['POST', '/api/auth/phone/send-otp'],
  ['POST', '/api/auth/phone/verify-otp'],
  ['GET', '/api/business/listings'],
  ['GET', '/api/community/meetings'],
  ['GET', '/api/community/posts'],
  ['GET', '/api/community/stats'],
  ['GET', '/api/events'],
  ['GET', '/api/events/summary'],
  ['GET', '/api/help-requests'],
  ['GET', '/api/matrimony/filter-options'],
  ['GET', '/api/matrimony/interests'],
  ['GET', '/api/matrimony/matches'],
  ['GET', '/api/matrimony/me'],
  ['GET', '/api/matrimony/profiles'],
  ['GET', '/api/payments/subscription'],
  ['POST', '/api/payments/create-order'],
  ['POST', '/api/payments/create-link'],
  ['POST', '/api/payments/play/verify'],
  ['GET', '/api/settings'],
]

let server
let user

before(async () => {
  server = await startServer()
  user = await signUpUser(server)
})
after(async () => { await server?.stop() })

describe('endpoints the mobile app depends on', () => {
  for (const [method, route] of MOBILE_ENDPOINTS) {
    test(`${method} ${route} is routed`, async () => {
      const res = await server.request(method, route, { token: user.token, body: method === 'POST' ? {} : undefined })
      assert.notEqual(res.status, 404, `${method} ${route} is gone — the app still calls it`)
    })
  }
})

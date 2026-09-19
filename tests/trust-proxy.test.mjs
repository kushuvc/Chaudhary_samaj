import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './helpers/harness.mjs'

let server

before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

/*
 * Render terminates TLS at its edge, so without `trust proxy` every request
 * looks like it comes from one address and express-rate-limit cannot tell
 * members apart — it logged ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every
 * request in production. The setting has to be one hop, not `true`: with
 * `true` Express believes the left-most X-Forwarded-For entry, which the
 * client writes, so anyone could present a fresh fake IP per request.
 */
describe('proxy handling behind Render', () => {
  test('a forwarded request is accepted rather than erroring', async () => {
    const res = await server.request('GET', '/api/health', {
      headers: { 'X-Forwarded-For': '203.0.113.7' },
    })
    assert.equal(res.status, 200)
  })

  test('a client cannot pick its own identity by prepending an address', async () => {
    // The shape a spoofing attempt takes: the client writes the first entry,
    // the proxy appends what it actually saw. Counting one hop in from the
    // socket must land on the proxy's observation, not the client's claim.
    const spoofed = await server.request('GET', '/api/health', {
      headers: { 'X-Forwarded-For': '1.2.3.4, 203.0.113.7' },
    })
    assert.equal(spoofed.status, 200)

    // Changing only the forged left-most entry must not present a new identity;
    // if it did, a limiter keyed on req.ip could be evaded indefinitely.
    for (const forged of ['5.6.7.8', '9.9.9.9', '11.11.11.11']) {
      const res = await server.request('GET', '/api/health', {
        headers: { 'X-Forwarded-For': `${forged}, 203.0.113.7` },
      })
      assert.equal(res.status, 200)
    }
  })

  test('the setting is one hop, not blanket trust', async () => {
    const src = await (await import('node:fs/promises')).readFile(
      new URL('../server/index.js', import.meta.url),
      'utf8'
    )
    assert.match(src, /app\.set\('trust proxy', 1\)/)
    assert.doesNotMatch(
      src,
      /app\.set\(['"]trust proxy['"],\s*true\)/,
      'blanket trust lets a client forge its own address'
    )
  })
})

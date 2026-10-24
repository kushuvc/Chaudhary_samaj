import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { sslConfigFor } from '../server/pg-ssl.js'
import { parseFromAddress } from '../server/email.js'
import { keepAliveUrl } from '../server/keep-alive.js'

describe('Postgres TLS selection', () => {
  test('a hosted database keeps TLS', () => {
    const cfg = sslConfigFor('postgresql://u:p@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres')
    assert.deepEqual(cfg, { rejectUnauthorized: false })
  })

  test('localhost does not use TLS', () => {
    assert.equal(sslConfigFor('postgresql://u:p@localhost:5432/db'), false)
    assert.equal(sslConfigFor('postgresql://u:p@127.0.0.1:5432/db'), false)
  })

  test('sslmode=disable is honoured', () => {
    assert.equal(sslConfigFor('postgresql://u:p@db.example.com:5432/db?sslmode=disable'), false)
  })

  test('an unknown host keeps TLS rather than guessing', () => {
    assert.deepEqual(
      sslConfigFor('postgresql://u:p@db.example.com:5432/db'),
      { rejectUnauthorized: false }
    )
  })

  test('an empty connection string yields no TLS config', () => {
    assert.equal(sslConfigFor(''), false)
    assert.equal(sslConfigFor(undefined), false)
  })
})

describe('email sender parsing', () => {
  test('a display name with no space before the bracket splits correctly', () => {
    // This is the exact format configured in production.
    assert.deepEqual(parseFromAddress('chaudhary samaj<support@chaudharysamaj.com>'), {
      name: 'chaudhary samaj',
      email: 'support@chaudharysamaj.com',
    })
  })

  test('a conventional display name splits correctly', () => {
    assert.deepEqual(parseFromAddress('Chaudhary Samaj <hello@example.com>'), {
      name: 'Chaudhary Samaj',
      email: 'hello@example.com',
    })
  })

  test('a bare address has no name', () => {
    assert.deepEqual(parseFromAddress('hello@example.com'), { email: 'hello@example.com' })
  })

  test('surrounding whitespace is trimmed', () => {
    assert.deepEqual(parseFromAddress('  hello@example.com  '), { email: 'hello@example.com' })
  })
})

describe('Render keep-alive URL', () => {
  test('pings our own health check on Render', () => {
    assert.equal(
      keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://chaudhary-samaj-api.onrender.com/' }),
      'https://chaudhary-samaj-api.onrender.com/api/health'
    )
  })

  test('KEEP_ALIVE_URL overrides the Render URL', () => {
    assert.equal(
      keepAliveUrl({ KEEP_ALIVE_URL: 'https://www.chaudharysamaj.com/api/health', RENDER_EXTERNAL_URL: 'https://x.onrender.com' }),
      'https://www.chaudharysamaj.com/api/health'
    )
  })

  test('stays off under test, when switched off, and off Render', () => {
    assert.equal(keepAliveUrl({ NODE_ENV: 'test', RENDER_EXTERNAL_URL: 'https://x.onrender.com' }), null)
    assert.equal(keepAliveUrl({ KEEP_ALIVE: 'off', RENDER_EXTERNAL_URL: 'https://x.onrender.com' }), null)
    assert.equal(keepAliveUrl({}), null)
  })
})

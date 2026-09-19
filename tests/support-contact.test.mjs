import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from './helpers/harness.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SUPPORT = 'support@chaudharysamaj.com'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

/*
 * Every public page carried a personal Gmail address, including the child
 * safety point of contact that Google reviews. A support address on the domain
 * forwards, so where the mail lands can change without reissuing pages an app
 * store has already approved.
 */
describe('published contact address', () => {
  const pages = readdirSync(join(root, 'site')).filter((f) => f.endsWith('.html'))

  test('no personal address is published anywhere', () => {
    const leaks = []
    for (const page of pages) {
      const html = readFileSync(join(root, 'site', page), 'utf8')
      // Any gmail/outlook/yahoo address on a public page is someone's personal
      // inbox, exposed permanently to anyone who reads the policy.
      for (const m of html.matchAll(/[\w.+-]+@(gmail|googlemail|outlook|hotmail|yahoo)\.com/gi)) {
        leaks.push(`${page}: ${m[0]}`)
      }
    }
    assert.deepEqual(leaks, [], 'public pages must not carry a personal inbox')
  })

  test('the pages people are told to write to all carry the support address', () => {
    // These three are the ones with a legal or store obligation behind them.
    for (const page of ['privacy-policy.html', 'child-safety.html', 'delete-account.html']) {
      const html = readFileSync(join(root, 'site', page), 'utf8')
      assert.ok(html.includes(SUPPORT), `${page} must name the support address`)
      assert.match(html, new RegExp(`mailto:${SUPPORT.replace('.', '\\.')}`), `${page} needs a working mailto`)
    }
  })

  test('the app offers the same address', () => {
    const src = readFileSync(join(root, 'apps/mobile/src/screens/SettingsScreen.tsx'), 'utf8')
    assert.ok(src.includes(SUPPORT), 'Settings must offer support contact')
    assert.match(src, /mailto:\$\{SUPPORT_EMAIL\}/, 'it should open a mail client')
    // Version and device travel with the report so a bug can be placed.
    assert.match(src, /App version/)
    assert.match(src, /Device:/)
  })

  test('the served pages carry it too, not just the files', async () => {
    for (const path of ['/privacy-policy', '/child-safety', '/delete-account']) {
      const res = await fetch(`${server.base}${path}`)
      assert.equal(res.status, 200)
      const html = await res.text()
      assert.ok(html.includes(SUPPORT), `${path} served without the support address`)
    }
  })
})

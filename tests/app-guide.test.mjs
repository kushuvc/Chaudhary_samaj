import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, signUpUser } from './helpers/harness.mjs'
import { GUIDE_DEFAULTS } from '../server/guide-defaults.js'

/**
 * The guide lives in the database so a section can be reworded, or added for a
 * feature that ships later, without a new app release. These cover the two
 * ways that quietly stops being true: the seed drifting out of step with the
 * languages the app offers, and a section reaching members half-translated.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let server
let member
let adminToken

before(async () => {
  server = await startServer()
  member = await signUpUser(server, { gender: 'male' })

  const admin = await signUpUser(server, { gender: 'male' })
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
  const login = await server.request('POST', '/api/auth/login', {
    body: { email: admin.email, password: admin.password },
  })
  adminToken = login.body.data.authToken
})
after(async () => { await server?.stop() })

describe('the seeded guide', () => {
  test('every section is written in all three languages', () => {
    for (const section of GUIDE_DEFAULTS) {
      for (const lang of ['en', 'hi', 'gu']) {
        assert.ok(section.title[lang]?.trim(), `${section.key} has no ${lang} title`)
        assert.ok(section.body[lang]?.trim(), `${section.key} has no ${lang} body`)
      }
    }
  })

  test('Hindi and Gujarati are translated, not copies of English', () => {
    for (const section of GUIDE_DEFAULTS) {
      for (const lang of ['hi', 'gu']) {
        assert.notEqual(section.title[lang], section.title.en, `${section.key} title is English under ${lang}`)
        assert.notEqual(section.body[lang], section.body.en, `${section.key} body is English under ${lang}`)
      }
    }
  })

  test('keys are unique', () => {
    const keys = GUIDE_DEFAULTS.map((s) => s.key)
    assert.equal(new Set(keys).size, keys.length)
  })

  test('the languages match the ones the app offers', () => {
    // A fourth language added to the app needs a column here too, or the guide
    // silently serves English to everyone who picks it.
    const languageFile = readFileSync(join(root, 'apps/mobile/src/context/LanguageContext.tsx'), 'utf8')
    for (const tag of ['en-IN', 'hi-IN', 'gu-IN']) {
      assert.ok(languageFile.includes(`'${tag}': {`), `${tag} missing from the app`)
    }
    const offered = [...languageFile.matchAll(/^  '([a-z]{2}-[A-Z]{2})': \{/gm)].map((m) => m[1])
    assert.deepEqual(offered.sort(), ['en-IN', 'gu-IN', 'hi-IN'])
  })
})

describe('reading the guide', () => {
  test('it answers in the language asked for', async () => {
    const seeded = GUIDE_DEFAULTS[0]

    for (const [tag, lang] of [['en-IN', 'en'], ['hi-IN', 'hi'], ['gu-IN', 'gu']]) {
      const res = await server.request('GET', `/api/guide?lang=${tag}`, { token: member.token })
      assert.equal(res.status, 200)
      const section = res.body.data.find((s) => s.key === seeded.key)
      assert.ok(section, `${seeded.key} missing from the ${tag} guide`)
      assert.equal(section.title, seeded.title[lang])
      assert.equal(section.body, seeded.body[lang])
    }
  })

  test('an unknown language falls back to English rather than failing', async () => {
    const res = await server.request('GET', '/api/guide?lang=fr-FR', { token: member.token })
    assert.equal(res.status, 200)
    assert.equal(res.body.data[0].title, GUIDE_DEFAULTS[0].title.en)
  })

  test('sections come back in the order the admin set', async () => {
    const res = await server.request('GET', '/api/guide?lang=en-IN', { token: member.token })
    const keys = res.body.data.map((s) => s.key)
    const expected = [...GUIDE_DEFAULTS].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.key)
    assert.deepEqual(keys, expected)
  })

  test('every section carries an icon the app can draw', async () => {
    const res = await server.request('GET', '/api/guide?lang=en-IN', { token: member.token })
    for (const section of res.body.data) {
      assert.match(section.icon, /^[a-z0-9-]+$/, `${section.key} has an unusable icon`)
    }
  })
})

describe('editing the guide', () => {
  test('a section added today reaches members without an app release', async () => {
    // The whole reason the guide is in the database: a feature ships, someone
    // writes its section in the admin screen, and installed apps show it.
    const put = await server.request('PUT', '/api/admin/guide/events', {
      token: adminToken,
      body: {
        icon: 'calendar-outline',
        sort_order: 80,
        title_en: 'Events', title_hi: 'कार्यक्रम', title_gu: 'કાર્યક્રમો',
        body_en: 'Community events appear here.',
        body_hi: 'समाज के कार्यक्रम यहाँ दिखते हैं।',
        body_gu: 'સમાજના કાર્યક્રમો અહીં દેખાય છે.',
      },
    })
    assert.equal(put.status, 200, JSON.stringify(put.body))

    const guide = await server.request('GET', '/api/guide?lang=hi-IN', { token: member.token })
    const added = guide.body.data.find((s) => s.key === 'events')
    assert.ok(added, 'the new section never reached the app')
    assert.equal(added.title, 'कार्यक्रम')
    assert.equal(added.icon, 'calendar-outline')
    assert.equal(guide.body.data.at(-1).key, 'events', 'sort_order was ignored')
  })

  test('a half-translated section is refused', async () => {
    const res = await server.request('PUT', '/api/admin/guide/broken', {
      token: adminToken,
      body: {
        title_en: 'Only English', title_hi: '', title_gu: '',
        body_en: 'Only English', body_hi: '', body_gu: '',
      },
    })
    assert.equal(res.status, 400)

    const guide = await server.request('GET', '/api/guide?lang=en-IN', { token: member.token })
    assert.ok(!guide.body.data.some((s) => s.key === 'broken'))
  })

  test('hiding a section takes it out of the app', async () => {
    const hide = await server.request('PUT', '/api/admin/guide/events', {
      token: adminToken,
      body: {
        icon: 'calendar-outline', sort_order: 80, is_active: false,
        title_en: 'Events', title_hi: 'कार्यक्रम', title_gu: 'કાર્યક્રમો',
        body_en: 'x', body_hi: 'x', body_gu: 'x',
      },
    })
    assert.equal(hide.status, 200)

    const guide = await server.request('GET', '/api/guide?lang=en-IN', { token: member.token })
    assert.ok(!guide.body.data.some((s) => s.key === 'events'), 'a hidden section still showed')
  })

  test('a member cannot edit it', async () => {
    const res = await server.request('PUT', '/api/admin/guide/profile', {
      token: member.token,
      body: { title_en: 'x', title_hi: 'x', title_gu: 'x', body_en: 'x', body_hi: 'x', body_gu: 'x' },
    })
    assert.ok(res.status === 401 || res.status === 403, `expected a refusal, got ${res.status}`)
  })

  test('a member cannot delete a section', async () => {
    const res = await server.request('DELETE', '/api/admin/guide/profile', { token: member.token })
    assert.ok(res.status === 401 || res.status === 403, `expected a refusal, got ${res.status}`)

    const guide = await server.request('GET', '/api/guide?lang=en-IN', { token: member.token })
    assert.ok(guide.body.data.some((s) => s.key === 'profile'), 'a member deleted a guide section')
  })
})

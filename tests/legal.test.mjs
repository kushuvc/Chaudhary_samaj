import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './helpers/harness.mjs'

let server
before(async () => { server = await startServer() })
after(async () => { await server?.stop() })

describe('landing page', () => {
  /*
   * A payment KYC reviewer fetches this anonymously, and an API origin that
   * answers 404 at the root does not read as a business website.
   */
  test('/ is public and describes the business', async () => {
    const res = await fetch(`${server.base}/`)
    assert.equal(res.status, 200, 'the root must not be a 404')
    assert.match(res.headers.get('content-type') || '', /text\/html/)

    const html = await res.text()
    assert.match(html, /Chaudhary Samaj/)
    assert.match(html, /200/, 'the price must be stated')
    assert.match(html, /aurienlimited@gmail\.com/)
    assert.match(html, /cancel/i, 'subscription cancellation terms must be stated')
    assert.match(html, /privacy-policy/, 'must link to the privacy policy')
  })

  test('the landing page leaks nothing from the environment', async () => {
    const html = await (await fetch(`${server.base}/`)).text()
    assert.ok(!/postgres:\/\/|postgresql:\/\/|xkeysib|sb_secret|JWT_SECRET/i.test(html))
  })
})

describe('privacy policy', () => {
  /*
   * Google Play's reviewer fetches this anonymously, so it must not be caught
   * by the session check that now covers every member-data route.
   */
  for (const route of ['/privacy-policy', '/privacy']) {
    test(`${route} is public and returns the policy`, async () => {
      const res = await fetch(`${server.base}${route}`)
      assert.equal(res.status, 200, `${route} must be reachable without a token`)
      assert.match(res.headers.get('content-type') || '', /text\/html/)

      const html = await res.text()
      assert.match(html, /Privacy Policy/i)
      assert.match(html, /Chaudhary Samaj/i)
      assert.match(html, /aurienlimited@gmail\.com/, 'must carry a working contact address')
      assert.match(html, /Grievance|grievance/, 'Indian law requires a grievance contact')
    })
  }

  test('the policy names where data is stored', async () => {
    const html = await (await fetch(`${server.base}/privacy-policy`)).text()
    assert.match(html, /Japan/, 'cross-border storage must be disclosed')
  })

  test('it does not leak anything from the environment', async () => {
    const html = await (await fetch(`${server.base}/privacy-policy`)).text()
    assert.ok(!/postgres:\/\/|postgresql:\/\/|xkeysib|sb_secret|JWT_SECRET/i.test(html))
  })
})

describe('account deletion page', () => {
  /*
   * Play requires a public URL that names the app, gives the steps, and says
   * what is deleted and what is kept with a retention period.
   */
  test('/delete-account is public and meets the listed requirements', async () => {
    const res = await fetch(`${server.base}/delete-account`)
    assert.equal(res.status, 200)

    const html = await res.text()
    assert.match(html, /Chaudhary Samaj/, 'must name the app')
    assert.match(html, /Settings/, 'must give the in-app steps')
    assert.match(html, /Delete Account/i)
    assert.match(html, /aurienlimited@gmail\.com/, 'must offer a route without the app')
    assert.match(html, /8 years|30 days/, 'must state a retention period')
    assert.match(html, /What is kept/i, 'must say what is retained')
  })
})

describe('admin subscriptions page', () => {
  test('/admin serves the page without a session', async () => {
    const res = await fetch(`${server.base}/admin`)
    assert.equal(res.status, 200, 'the page itself is public, like a login page')
    const html = await res.text()
    assert.match(html, /Subscriptions/)
    assert.match(html, /noindex/, 'an admin screen should not be indexed')
  })

  test('it carries both the rules and the plan editor', async () => {
    const html = await (await fetch(`${server.base}/admin`)).text()
    assert.match(html, /Add a plan/, 'plans must be editable from here')
    assert.match(html, /Play product id/, 'a plan needs its Play Console product id')
    assert.match(html, /Free profiles before the paywall/, 'the per-gender rules stay')
  })

  /*
   * The page is only a form. Everything it can do is behind /api/admin, which
   * the security suite covers — this asserts the page ships no secret of its
   * own and grants nothing by being reachable.
   */
  test('it carries no credentials of its own', async () => {
    const html = await (await fetch(`${server.base}/admin`)).text()
    assert.ok(!/xkeysib|sb_secret|JWT_SECRET|postgres:\/\//i.test(html))
    assert.ok(!/authorization:\s*.Bearer [A-Za-z0-9._-]{20}/i.test(html), 'no baked-in token')
  })
})

describe('child safety standards', () => {
  /*
   * Play requires this to be publicly reachable and not editable by the
   * reader. The page also has to describe controls that actually exist — the
   * age gate and the report flow it names are covered in safety.test.mjs.
   */
  test('/child-safety is public and states the standards', async () => {
    const res = await fetch(`${server.base}/child-safety`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') || '', /text\/html/)

    const html = await res.text()
    assert.match(html, /zero tolerance/i)
    assert.match(html, /18 years old/, 'must state the minimum age')
    assert.match(html, /Report/, 'must explain how to report')
    assert.match(html, /aurienlimited@gmail\.com/, 'must give a point of contact')
    assert.match(html, /POCSO|Prohibition of Child Marriage/, 'must name the applicable law')
  })
})

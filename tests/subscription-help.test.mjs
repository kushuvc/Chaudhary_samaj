import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const screen = readFileSync(join(root, 'apps/mobile/src/screens/SubscriptionsScreen.tsx'), 'utf8')
const languageFile = readFileSync(join(root, 'apps/mobile/src/context/LanguageContext.tsx'), 'utf8')

/**
 * Members asked how to pay, how renewal works, and — the one nobody should
 * have to email support about — how to cancel. The answers live on the plans
 * screen itself, so these tests guard the two ways that quietly breaks:
 * a key that stops being rendered, and the block drifting inside the
 * "not subscribed yet" branch where a paying member would never see it.
 */
const HELP_KEYS = [
  'helpTitle',
  'helpWhatTitle', 'helpWhatBody',
  'helpPayTitle', 'helpPayStep1', 'helpPayStep2', 'helpPayStep3', 'helpPayStep4', 'helpPaySafe',
  'helpRenewTitle', 'helpRenewBody',
  'helpCancelTitle', 'helpCancelBody', 'helpCancelKeep',
  'helpChangeTitle', 'helpChangeBody',
  'helpPhoneTitle', 'helpPhoneBody',
]

describe('subscription help section', () => {
  test('every help string is rendered on the plans screen', () => {
    const missing = HELP_KEYS.filter((key) => !screen.includes(`'${key}'`))
    assert.deepEqual(missing, [], 'help keys defined but never shown to anyone')
  })

  test('every help string is translated into all three languages', () => {
    for (const tag of ['en-IN', 'hi-IN', 'gu-IN']) {
      const start = languageFile.indexOf(`  '${tag}': {`)
      const body = languageFile.slice(start, languageFile.indexOf('\n  },', start))
      for (const key of HELP_KEYS) {
        assert.match(body, new RegExp(`^    ${key}: '.+',$`, 'm'), `${tag} is missing ${key}`)
      }
    }
  })

  test('the help card sits outside the not-yet-subscribed branch', () => {
    // Someone who already pays is exactly who needs the cancel instructions,
    // so the card must render after the entitled/unentitled fork closes and
    // before the billing footnote.
    const card = screen.indexOf('styles.helpCard')
    const footnote = screen.indexOf('styles.footnote')
    assert.ok(card > -1 && footnote > -1, 'help card or footnote missing')
    assert.ok(card < footnote, 'help card should come before the billing footnote')

    const between = screen.slice(card, footnote)
    assert.ok(!between.includes('{entitled'), 'help card is gated on entitlement')
  })
})

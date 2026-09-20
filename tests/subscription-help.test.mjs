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
  'helpOpenTitle', 'helpOpenSub', 'helpClose',
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

  test('anyone can open it, subscribed or not', () => {
    // A paying member is exactly who needs the cancel steps, so the row that
    // opens the sheet must not sit inside the not-yet-subscribed branch.
    const trigger = screen.indexOf('styles.helpTrigger')
    const footnote = screen.indexOf('styles.footnote')
    assert.ok(trigger > -1, 'no row opens the help sheet')
    assert.ok(trigger < footnote, 'help row should come before the billing footnote')
    assert.ok(!screen.slice(trigger, footnote).includes('{entitled'), 'help row is gated on entitlement')
  })

  test('the sheet can be dismissed', () => {
    // A modal with no way out traps whoever opened it.
    assert.match(screen, /onRequestClose=\{\(\) => setHelpOpen\(false\)\}/, 'Android back button does not close the sheet')
    assert.ok(screen.includes('sheetDismissArea'), 'tapping outside the sheet does not close it')
  })

})

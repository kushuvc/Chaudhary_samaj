import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mobileSrc = join(root, 'apps/mobile/src')
const languageFile = readFileSync(join(mobileSrc, 'context/LanguageContext.tsx'), 'utf8')

/** Split the translations object into one block of `key: 'value',` lines per language. */
function translationBlocks() {
  const blocks = {}
  for (const tag of ['en-IN', 'hi-IN', 'gu-IN']) {
    const start = languageFile.indexOf(`  '${tag}': {`)
    assert.ok(start > -1, `${tag} block is missing`)
    const end = languageFile.indexOf('\n  },', start)
    const body = languageFile.slice(start, end)
    const entries = new Map()
    for (const m of body.matchAll(/^    ([A-Za-z0-9_]+): '((?:[^'\\]|\\.)*)',$/gm)) {
      entries.set(m[1], m[2])
    }
    blocks[tag] = entries
  }
  return blocks
}

describe('app translations', () => {
  const blocks = translationBlocks()

  test('every language defines the same keys', () => {
    const en = [...blocks['en-IN'].keys()].sort()
    assert.ok(en.length > 400, `expected a full key set, got ${en.length}`)
    for (const tag of ['hi-IN', 'gu-IN']) {
      const missing = en.filter((k) => !blocks[tag].has(k))
      const extra = [...blocks[tag].keys()].filter((k) => !blocks['en-IN'].has(k))
      assert.deepEqual(missing, [], `${tag} is missing keys`)
      assert.deepEqual(extra, [], `${tag} has keys English does not`)
    }
  })

  test('no translation is left blank', () => {
    for (const [tag, entries] of Object.entries(blocks)) {
      for (const [key, value] of entries) {
        assert.ok(value.trim().length > 0, `${tag}.${key} is empty`)
      }
    }
  })

  test('Hindi and Gujarati are actually translated, not copies of English', () => {
    // A handful legitimately match (brand names, codes like MBA). Anything more
    // than a small tail means a language block was pasted rather than written.
    for (const tag of ['hi-IN', 'gu-IN']) {
      const same = [...blocks['en-IN']].filter(
        ([k, v]) => blocks[tag].get(k) === v && v.length > 3 && /[A-Za-z]/.test(v),
      )
      assert.ok(same.length < 20, `${tag} repeats English for ${same.length} keys: ${same.slice(0, 8).map(([k]) => k)}`)
    }
  })
})

describe('signup option labels', () => {
  const options = readFileSync(join(mobileSrc, 'constants/signupOptions.ts'), 'utf8')
  const translations = readFileSync(join(mobileSrc, 'constants/optionTranslations.ts'), 'utf8')
  const registered = new Set(
    [...translations.matchAll(/^  '((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1].replace(/\\'/g, "'")),
  )

  test('every word a member reads in a dropdown has a translation', () => {
    const labels = new Set()
    for (const m of options.matchAll(/label: '((?:[^'\\]|\\.)*)'/g)) labels.add(m[1].replace(/\\'/g, "'"))
    const missing = [...labels].filter(
      (l) =>
        !registered.has(l) &&
        !/^su[A-Z]/.test(l) && // already a translation key
        !/^[\d\s,.\-&]+$/.test(l) && // pure numbers read the same everywhere
        !/^\d+ ft /.test(l), // generated height labels
    )
    assert.deepEqual(missing, [], 'untranslated option labels')
  })

  test('each translation gives both Hindi and Gujarati', () => {
    for (const m of translations.matchAll(/^  '(?:[^'\\]|\\.)*': \[([^\]]*)\],$/gm)) {
      const parts = m[1].split("', '")
      assert.equal(parts.length, 2, `expected [hi, gu] but got ${m[1]}`)
    }
  })
})

describe('no hardcoded English left in the UI', () => {
  function screenFiles(dir) {
    const out = []
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) out.push(...screenFiles(full))
      else if (name.endsWith('.tsx')) out.push(full)
    }
    return out
  }

  // Brand names, input formats and example addresses stay as they are.
  const ALLOWED = new Set([
    'Chaudhary Samaj',
    'DD/MM/YYYY',
    'you@example.com',
    'you@gmail.com',
    '98xxxxxxxx',
  ])

  const textNode = />\s*([A-Z][A-Za-z0-9 ,'’.!?…&\-/()%]{2,})\s*</g
  const stringProp =
    /\b(?:label|placeholder|title|message|caption|subtitle|emptyText|headerTitle)=(?:"([^"]{3,})"|\{'((?:[^'\\]|\\.){3,})'\}|'((?:[^'\\]|\\.){3,})')/g

  test('screens and components render translated text only', () => {
    const offenders = []
    for (const file of screenFiles(mobileSrc)) {
      const src = readFileSync(file, 'utf8')
      const rel = file.slice(root.length + 1)
      for (const m of src.matchAll(textNode)) {
        const value = m[1].trim()
        // `Promise<void>` and friends look like text nodes to a regex.
        if (value === 'Promise' || ALLOWED.has(value)) continue
        offenders.push(`${rel}: ${value}`)
      }
      for (const m of src.matchAll(stringProp)) {
        const value = m[1] || m[2] || m[3]
        if (ALLOWED.has(value) || !/[A-Za-z]{2}/.test(value)) continue
        offenders.push(`${rel}: ${value}`)
      }
    }
    // Template-literal titles ("Where ${x} based?") slipped through the
    // checks above and stayed English in Hindi and Gujarati (Oct 2026).
    const templateProp = /\b(?:title|subtitle|label|placeholder|caption|text)=\{`([^`]*)`\}/g
    for (const file of screenFiles(mobileSrc)) {
      const src = readFileSync(file, 'utf8')
      const rel = file.slice(root.length + 1)
      for (const m of src.matchAll(templateProp)) {
        const words = m[1].replace(/\$\{[^}]*\}/g, ' ')
        if (/[A-Za-z]{3}/.test(words)) offenders.push(`${rel}: \`${m[1]}\``)
      }
    }
    assert.deepEqual(offenders, [], 'these strings never change with the language')
  })
})

describe('option lists defined inside screens', () => {
  const translations = readFileSync(join(mobileSrc, 'constants/optionTranslations.ts'), 'utf8')
  const registered = new Set(
    [...translations.matchAll(/^  '((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1].replace(/\\'/g, "'")),
  )

  // Screens keep a few short option arrays of their own. They render through the
  // same chips as the shared lists, so they need translations just the same.
  const LOCAL_LISTS = [
    ['screens/ProfileScreen.tsx', 'MARITAL_STATUS_OPTIONS'],
    ['screens/ProfileScreen.tsx', 'COMMUNITY_OPTIONS'],
    ['screens/ProfileScreen.tsx', 'LANGUAGE_OPTIONS'],
    ['screens/ProfileScreen.tsx', 'EDUCATION_OPTIONS'],
    ['screens/ProfileScreen.tsx', 'OCCUPATION_OPTIONS'],
    ['screens/BusinessScreen.tsx', 'CATEGORY_OPTIONS'],
    ['screens/EventsScreen.tsx', 'PAYMENT_MODE_OPTIONS'],
    ['screens/HelpNeedScreen.tsx', 'CATEGORY_OPTIONS'],
    ['screens/HelpNeedScreen.tsx', 'URGENCY_OPTIONS'],
    ['screens/HelpNeedScreen.tsx', 'STATUS_OPTIONS'],
    ['screens/HelpNeedScreen.tsx', 'CONTACT_MODE_OPTIONS'],
  ]

  test('every locally defined option has a translation', () => {
    const missing = []
    for (const [file, name] of LOCAL_LISTS) {
      const src = readFileSync(join(mobileSrc, file), 'utf8')
      const match = src.match(new RegExp(`const ${name}\\s*(?::[^=]+)?=\\s*\\[([^\\]]*)\\]`))
      assert.ok(match, `${file} no longer defines ${name}`)
      for (const m of match[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
        const value = m[1].replace(/\\'/g, "'")
        if (!registered.has(value) && !/^[\d\s,.\-&]+$/.test(value)) {
          missing.push(`${file}:${name}: ${value}`)
        }
      }
    }
    assert.deepEqual(missing, [], 'untranslated option values')
  })
})

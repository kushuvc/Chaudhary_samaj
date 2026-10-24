/*
 * Catches misspelt mail providers at signup ("gamil.com", "gmail.con",
 * "yaho.com"). Such an address is well formed, so the format check let it
 * through, and the code went to a domain nobody reads; the member was stuck
 * at the code step. Keep in step with apps/mobile/src/utils/emailTypo.ts
 * (tests/email-typo.test.mjs compares the two).
 */

// Providers members actually use; a domain close to one of these is a typo.
export const PROVIDERS = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'icloud.com']

// Real domains that happen to sit close to a provider; never "corrected".
export const KNOWN_DOMAINS = new Set([
  ...PROVIDERS,
  'googlemail.com', 'ymail.com', 'yahoo.in', 'yahoo.co.uk', 'live.com', 'live.in', 'msn.com', 'me.com', 'mac.com',
  'mail.com', 'email.com', 'gmx.com', 'gmx.net', 'aol.com', 'zoho.com', 'zohomail.in', 'proton.me', 'protonmail.com',
  'rediff.com', 'outlook.in', 'hotmail.co.uk', 'chaudharysamaj.com',
])

/** Optimal string alignment distance: a swap ("gamil") counts as one edit. */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** The corrected address when the domain looks like a misspelt provider, else null. */
export function suggestEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 1) return null
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!domain || KNOWN_DOMAINS.has(domain)) return null
  let best = null
  for (const provider of PROVIDERS) {
    const dist = distance(domain, provider)
    if (dist <= 2 && (!best || dist < best.dist)) best = { provider, dist }
  }
  // "gmail" with no ".com", or "gmail.com.com"
  if (!best) {
    const name = domain.split('.')[0]
    const match = PROVIDERS.find((p) => p.split('.')[0] === name)
    if (match) best = { provider: match }
  }
  return best ? `${local}@${best.provider}` : null
}

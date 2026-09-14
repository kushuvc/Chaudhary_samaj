/**
 * Decides whether a Postgres connection should use TLS.
 *
 * This lived in three places with two different answers: fast-queries.js keyed
 * off the string "supabase", while db.js and migrate.js forced TLS on
 * unconditionally. The forced version makes a local Postgres unusable — it
 * fails with "The server does not support SSL connections" — even though
 * .env.example documents a local instance as supported.
 *
 * Hosted Postgres keeps TLS (rejectUnauthorized stays false because Supabase's
 * pooler presents a certificate for a different host than the one dialled).
 */
export function sslConfigFor(connectionString = '') {
  const url = String(connectionString || '')
  if (!url) return false

  if (/[?&]sslmode=disable\b/i.test(url)) return false

  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    // An unparseable URL is not something to guess about; keep TLS on, which
    // is the safe direction for anything that is not clearly local.
    return { rejectUnauthorized: false }
  }

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '') {
    return false
  }

  return { rejectUnauthorized: false }
}

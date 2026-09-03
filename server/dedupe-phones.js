/**
 * Make phone numbers unique per account, ahead of the unique index added by
 * the migration.
 *
 * Non-destructive: no account is deleted. For each group of accounts sharing a
 * phone number, one keeper is chosen and the others have `phone` set to NULL.
 * They keep their data and can still sign in by email, and can re-add a phone
 * later. Postgres unique indexes ignore NULLs, so this is enough to satisfy the
 * constraint.
 *
 * Keeper rule: an account with a matrimony profile wins, then the oldest.
 *
 * Dry run (default):  node server/dedupe-phones.js
 * Apply:              node server/dedupe-phones.js --apply
 */
import 'dotenv/config'
import pg from 'pg'

const apply = process.argv.includes('--apply')
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = new pg.Client({
  connectionString,
  ...(/localhost|127\.0\.0\.1/.test(connectionString) ? {} : { ssl: { rejectUnauthorized: false } }),
  connectionTimeoutMillis: 20000,
})

const NORM = `right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10)`

await client.connect()

const { rows: groups } = await client.query(
  `SELECT ${NORM} AS phone, COUNT(*) AS n
   FROM users
   WHERE coalesce(phone, '') <> ''
   GROUP BY 1
   HAVING COUNT(*) > 1
   ORDER BY n DESC`
)

if (groups.length === 0) {
  console.log('No duplicate phone numbers. Nothing to do.')
  await client.end()
  process.exit(0)
}

console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${groups.length} duplicate phone group(s)\n`)

let cleared = 0

for (const group of groups) {
  const { rows: members } = await client.query(
    `SELECT u.id, u.email, u.created_at,
            (SELECT COUNT(*) FROM matrimony_profiles p WHERE p.user_id = u.id) AS profiles
     FROM users u
     WHERE ${NORM} = $1
     ORDER BY (SELECT COUNT(*) FROM matrimony_profiles p WHERE p.user_id = u.id) DESC,
              u.created_at ASC`,
    [group.phone]
  )

  const [keeper, ...losers] = members
  console.log(`${group.phone}  (${members.length} accounts)`)
  console.log(`  KEEP  ${keeper.email}  (profiles: ${keeper.profiles}, created ${String(keeper.created_at).slice(0, 10)})`)

  for (const loser of losers) {
    console.log(`  clear ${loser.email}  (profiles: ${loser.profiles})`)
    if (apply) {
      await client.query('UPDATE users SET phone = NULL, updated_at = $2 WHERE id = $1', [
        loser.id,
        new Date().toISOString(),
      ])
    }
    cleared += 1
  }
  console.log()
}

console.log(
  apply
    ? `Done. Cleared the phone number on ${cleared} account(s); no accounts deleted.`
    : `Dry run only. ${cleared} account(s) would have their phone cleared. Re-run with --apply.`
)

await client.end()

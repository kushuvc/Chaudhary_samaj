/**
 * One-shot copy of every public table from one Postgres to another.
 *
 * Intended for moving local development data into Supabase. Run the schema
 * migration against the target first (`npm run migrate` with DATABASE_URL
 * pointing at the target), then:
 *
 *   SOURCE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/chaudhary_samaj \
 *   TARGET_DATABASE_URL=<supabase-uri> \
 *   node server/copy-db.js
 *
 * Rows are inserted with ON CONFLICT DO NOTHING, so re-running is safe and
 * will not clobber rows already present in the target.
 */
import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

const sourceUrl = process.env.SOURCE_DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL

if (!sourceUrl || !targetUrl) {
  console.error('Set both SOURCE_DATABASE_URL and TARGET_DATABASE_URL')
  process.exit(1)
}

if (sourceUrl === targetUrl) {
  console.error('Source and target are the same database; refusing to run')
  process.exit(1)
}

const needsSsl = (url) => !/localhost|127\.0\.0\.1/.test(url)

const source = new Client({ connectionString: sourceUrl, ...(needsSsl(sourceUrl) ? { ssl: { rejectUnauthorized: false } } : {}) })
const target = new Client({ connectionString: targetUrl, ...(needsSsl(targetUrl) ? { ssl: { rejectUnauthorized: false } } : {}) })

// Parents before children, so foreign keys resolve. Tables not listed here are
// copied afterwards in alphabetical order.
const ORDER = [
  'users',
  'auth_accounts',
  'matrimony_profiles',
  'matrimony_preferences',
  'matrimony_profile_states',
  'matrimony_saved_filters',
  'matrimony_profile_actions',
  'matrimony_interests',
  'matrimony_matches',
  'matrimony_messages',
  'community_events',
  'community_event_guests',
  'community_event_contributions',
  'business_listings',
  'community_posts',
  'community_meetings',
  'help_requests',
  'help_support_offers',
  'user_subscriptions',
]

await source.connect()
await target.connect()
console.log('Connected to source and target\n')

const { rows: sourceTables } = await source.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
)
const { rows: targetTables } = await target.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
)
const targetSet = new Set(targetTables.map((r) => r.tablename))

const names = sourceTables.map((r) => r.tablename)
const ordered = [...ORDER.filter((t) => names.includes(t)), ...names.filter((t) => !ORDER.includes(t))]

let copiedTotal = 0
let skippedTables = []

for (const table of ordered) {
  if (!targetSet.has(table)) {
    skippedTables.push(`${table} (missing in target — run the migration first)`)
    continue
  }

  const { rows } = await source.query(`SELECT * FROM "${table}"`)
  if (rows.length === 0) {
    console.log(`${table.padEnd(34)} 0 rows`)
    continue
  }

  // Only copy columns the target actually has, so a schema drift does not abort.
  const { rows: targetCols } = await target.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  )
  const allowed = new Set(targetCols.map((c) => c.column_name))
  const columns = Object.keys(rows[0]).filter((c) => allowed.has(c))
  const dropped = Object.keys(rows[0]).filter((c) => !allowed.has(c))

  const quoted = columns.map((c) => `"${c}"`).join(', ')
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`

  let copied = 0
  await target.query('BEGIN')
  try {
    for (const row of rows) {
      const result = await target.query(sql, columns.map((c) => row[c]))
      copied += result.rowCount
    }
    await target.query('COMMIT')
  } catch (err) {
    await target.query('ROLLBACK')
    console.error(`${table.padEnd(34)} FAILED: ${err.message}`)
    continue
  }

  copiedTotal += copied
  const note = dropped.length ? `  (skipped columns: ${dropped.join(', ')})` : ''
  console.log(`${table.padEnd(34)} ${copied}/${rows.length} copied${note}`)
}

if (skippedTables.length) {
  console.log('\nSkipped tables:')
  skippedTables.forEach((t) => console.log('  ' + t))
}

console.log(`\nDone. ${copiedTotal} rows copied.`)

await source.end()
await target.end()

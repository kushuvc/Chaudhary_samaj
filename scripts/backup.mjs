/*
 * Daily backup of the live database and photos to this Mac, while the
 * Supabase free plan has no backups of its own (see CLAUDE.md). Run by
 * launchd every day; also by hand: `node scripts/backup.mjs`.
 *
 * Writes ~/Documents/chaudhary-samaj-backups/<date>/:
 *   tables/<table>.json   every row of every public table
 *   photos/<path>         every file in the profile-photos bucket
 *   manifest.json         row and file counts, for a quick sanity check
 * and keeps the newest KEEP_DAYS folders. Only reads from production.
 *
 * Restore: rebuild the schema with `npm run server` (migrate.js) against an
 * empty database, then load the tables (see scripts/RESTORE.md).
 */
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env') })

const KEEP_DAYS = 14
const BUCKET = 'profile-photos'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gvcefstsjakuwkxsuwkl.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BASE = process.env.BACKUP_DIR || path.join(os.homedir(), 'Documents', 'chaudhary-samaj-backups')

const stamp = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10) // India date
const dir = path.join(BASE, stamp)
mkdirSync(path.join(dir, 'tables'), { recursive: true })

const headers = { apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) }
const manifest = { takenAt: new Date().toISOString(), tables: {}, photos: 0, photoBytes: 0, errors: [] }

async function backupTables() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  /*
   * One read-only transaction for the whole export: a backup must never
   * change anything. NOT `SET SESSION ... READ ONLY`: DATABASE_URL goes
   * through Supabase's transaction pooler, which hands the same server
   * connection to the live API next, so a session setting stays behind and
   * the API's writes fail (26 Oct 2026: 4 minutes of refused saves and a
   * failed deploy). A transaction's read-only flag ends with the transaction.
   */
  await client.query('BEGIN TRANSACTION READ ONLY')
  const { rows: tables } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  )
  for (const { tablename } of tables) {
    try {
      const { rows } = await client.query(`SELECT * FROM public."${tablename}"`)
      writeFileSync(path.join(dir, 'tables', `${tablename}.json`), JSON.stringify(rows))
      manifest.tables[tablename] = rows.length
    } catch (err) {
      manifest.errors.push(`table ${tablename}: ${err.message}`)
    }
  }
  await client.query('COMMIT')
  await client.end()
}

async function listFolder(prefix) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  })
  if (!res.ok) throw new Error(`list ${prefix || '/'}: ${res.status}`)
  return res.json()
}

async function backupPhotos() {
  if (!KEY) {
    manifest.errors.push('SUPABASE_SERVICE_ROLE_KEY missing in .env: photos skipped')
    return
  }
  // Photos live in <userId>/<file>; folders come back without an id.
  const top = await listFolder('')
  for (const entry of top) {
    const items = entry.id ? [{ ...entry, full: entry.name }] : (await listFolder(`${entry.name}/`)).map((f) => ({ ...f, full: `${entry.name}/${f.name}` }))
    for (const file of items) {
      if (!file.id) continue
      const target = path.join(dir, 'photos', file.full)
      try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file.full}`, { headers })
        if (!res.ok) throw new Error(String(res.status))
        const buf = Buffer.from(await res.arrayBuffer())
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(target, buf)
        manifest.photos += 1
        manifest.photoBytes += buf.length
      } catch (err) {
        manifest.errors.push(`photo ${file.full}: ${err.message}`)
      }
    }
  }
}

function pruneOld() {
  if (!existsSync(BASE)) return
  const days = readdirSync(BASE).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) {
    rmSync(path.join(BASE, old), { recursive: true, force: true })
  }
}

try {
  await backupTables()
  await backupPhotos()
} catch (err) {
  manifest.errors.push(err.message)
}
writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
pruneOld()
const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0)
console.log(`[backup] ${stamp}: ${Object.keys(manifest.tables).length} tables, ${rows} rows, ${manifest.photos} photos (${(manifest.photoBytes / 1048576).toFixed(1)} MB), ${manifest.errors.length} errors -> ${dir}`)
if (manifest.errors.length) {
  console.error(manifest.errors.join('\n'))
  process.exit(1)
}

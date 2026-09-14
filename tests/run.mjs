/**
 * Test entry point.
 *
 * Boots one throwaway Postgres cluster for the whole run and hands its
 * connection string to the test files. Production runs on Postgres and the
 * async routes use Postgres placeholders directly, so testing against SQLite
 * would exercise a code path the real app never takes.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

const dataDir = mkdtempSync(path.join(tmpdir(), 'cs-pg-'))
const port = 25000 + Math.floor(Math.random() * 10000)
const user = 'postgres'
const password = 'testpassword'

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: false,
  onLog: () => {},
  onError: () => {},
})

let exitCode = 1
try {
  process.stdout.write(`starting postgres on :${port} ... `)
  await pg.initialise()
  await pg.start()
  process.stdout.write('ready\n\n')

  const adminUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/postgres`
  const explicit = process.argv.slice(2)
  const discovered = readdirSync('tests')
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => path.join('tests', name))
    .sort()
  const files = explicit.length ? explicit : discovered
  const args = ['--test', '--test-concurrency=1', ...files]

  exitCode = await new Promise((resolve) => {
    const child = spawn('node', args, {
      stdio: 'inherit',
      env: { ...process.env, TEST_PG_ADMIN_URL: adminUrl },
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
} finally {
  try {
    await pg.stop()
  } catch {
    // the cluster is disposable; a failed stop must not mask a test failure
  }
  rmSync(dataDir, { recursive: true, force: true })
}

process.exit(exitCode)

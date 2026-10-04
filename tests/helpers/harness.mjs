import { spawn } from 'node:child_process'
import path from 'node:path'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

const ROOT = path.resolve(import.meta.dirname, '..', '..')

/**
 * Boots a real server against a throwaway SQLite file.
 *
 * These are integration tests on purpose: the bugs this suite exists to catch
 * (auth bypass, the decorative paywall, OTP leaks) all lived in the seam
 * between route, middleware and database, which unit tests on any one of those
 * would have missed.
 */
export async function startServer({ env = {}, nodeEnv = 'test' } = {}) {
  const adminUrl = process.env.TEST_PG_ADMIN_URL
  if (!adminUrl) {
    throw new Error('TEST_PG_ADMIN_URL is unset — run the suite with `npm test`, which boots Postgres first.')
  }

  // A database per server instance, so one test's writes can never be read by
  // another and a failure cannot cascade through the rest of the run.
  const dbName = `test_${randomUUID().replace(/-/g, '')}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${dbName}`)
  await admin.end()

  const databaseUrl = adminUrl.replace(/\/postgres$/, `/${dbName}`)
  const port = 20000 + Math.floor(Math.random() * 20000)

  const childEnv = {
    ...process.env,
    NODE_ENV: nodeEnv,
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: 'test-secret-that-is-definitely-long-enough-32',
    // No test may send a real email or reach a real payment provider.
    BREVO_API_KEY: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_HOST: '',
    SMTP_SERVICE: '',
    MSG91_AUTHKEY: '',
    // Nor reach Expo's push service.
    PUSH_DELIVERY: 'off',
    // The suite signs up far more accounts than a person would; the limiter
    // itself is covered by its own test rather than by throttling every other.
    AUTH_RATE_LIMIT_MAX: '100000',
    ...env,
  }

  // migrate.js builds the schema, exactly as `npm run server` does — so the
  // suite also proves the migration runs clean against an empty database.
  await run('node', ['server/migrate.js'], childEnv)

  const child = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const logs = []
  child.stdout.on('data', (d) => logs.push(String(d)))
  child.stderr.on('data', (d) => logs.push(String(d)))

  const base = `http://127.0.0.1:${port}`
  const ready = await waitForHealth(base, child)
  if (!ready) {
    child.kill('SIGKILL')
    throw new Error(`server did not start on ${port}:\n${logs.join('')}`)
  }

  return {
    base,
    databaseUrl,
    logs: () => logs.join(''),
    /** Runs SQL against this instance's database, for arranging test state. */
    async sql(text, values = []) {
      const client = new pg.Client({ connectionString: databaseUrl })
      await client.connect()
      try {
        const result = await client.query(text, values)
        return result.rows
      } finally {
        await client.end()
      }
    },
    async request(method, pathname, { body, token, headers = {} } = {}) {
      const res = await fetch(`${base}${pathname}`, {
        method,
        headers: {
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        json = { _raw: text }
      }
      return { status: res.status, body: json }
    },
    async stop() {
      child.kill('SIGKILL')
      await new Promise((r) => child.once('exit', r))
    },
  }
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    c.stderr.on('data', (d) => (err += d))
    c.stdout.on('data', () => {})
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed: ${err}`))))
  })
}

async function waitForHealth(base, child) {
  for (let i = 0; i < 100; i += 1) {
    if (child.exitCode !== null) return false
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return true
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

/** Creates an account and returns { token, userId, email, phone, password }. */
export async function signUpUser(server, overrides = {}) {
  const email = overrides.email || `user${Math.random().toString(36).slice(2, 10)}@example.com`
  const phone = overrides.phone || `9${Math.floor(100000000 + Math.random() * 899999999)}`
  const password = overrides.password || 'testpass123'

  // Signup refuses an address whose code was never entered. Recorded straight
  // into the database rather than through the code endpoints: going through
  // them would spend the per-address cooldown and hourly cap that other tests
  // are measuring, and a production-mode server never hands a code back.
  // tests/signup-verification.test.mjs covers the real two-step flow.
  if (!overrides.skipEmailVerification) await markEmailVerified(server, email)
  delete overrides.skipEmailVerification

  const res = await server.request('POST', '/api/auth/signup', {
    body: {
      fullName: 'Test User',
      email,
      password,
      confirmPassword: password,
      phone,
      gender: 'male',
      dateOfBirth: '1995-01-01',
      ...overrides,
    },
  })

  if (res.status !== 201) {
    const err = new Error(`signup failed ${res.status}: ${JSON.stringify(res.body)}`)
    err.response = res
    throw err
  }

  return {
    token: res.body.data.authToken,
    userId: res.body.data.user?.id,
    email,
    phone,
    password,
    response: res,
  }
}

/** Requests an OTP and returns the debug code (non-production only). */
/** Record a correctly entered signup code for an address, as a test fixture. */
export async function markEmailVerified(server, email) {
  await server.sql(
    `INSERT INTO auth_email_otps (id, email, purpose, otp_code, expires_at, created_at, consumed_at, verified_at)
     VALUES (gen_random_uuid()::text, $1, 'signup', '000000', NOW()::text, NOW()::text, NOW()::text, NOW()::text)`,
    [email],
  )
}

/** Request and enter a signup code for an address, as the app does before signup. */
export async function verifySignupEmail(server, email) {
  const { res, code } = await getOtp(server, email, 'signup')
  if (!code) throw new Error(`no signup code for ${email}: ${JSON.stringify(res.body)}`)
  const verified = await server.request('POST', '/api/auth/otp/verify', {
    body: { email, purpose: 'signup', otp: code },
  })
  if (verified.status !== 200) throw new Error(`signup code rejected: ${JSON.stringify(verified.body)}`)
}

export async function getOtp(server, email, purpose, extra = {}) {
  const res = await server.request('POST', '/api/auth/otp/request', {
    body: { email, purpose, ...extra },
  })
  return { res, code: res.body?.data?.debugOtp }
}

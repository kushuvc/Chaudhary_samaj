import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import Database from 'better-sqlite3'
import pg from 'pg'
const { Pool } = pg

const serverDir = path.resolve('server')
const dataDir = path.join(serverDir, 'data')
const dbPath = path.join(dataDir, 'chaudhary-samaj.sqlite')
const schemaPath = path.join(serverDir, 'schema.sql')
const preferPostgres = Boolean(process.env.DATABASE_URL)

let database
let databaseEngine = 'sqlite'
let currentTransaction = null

// Persistent async pool for fast direct queries (used in async Express routes)
let _pgPool = null
export function getPgPool() {
  if (!_pgPool && process.env.DATABASE_URL) {
    _pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      min: 2,
      idleTimeoutMillis: 600000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    })
    _pgPool.on('error', () => {})
  }
  return _pgPool
}

// Warm up pool on module load - establishes persistent connections immediately
export function warmUpPool() {
  const pool = getPgPool()
  if (!pool) return
  pool.query('SELECT 1').catch(() => {})
}

// Convenience async query helper
export async function pgQuery(text, values = []) {
  const pool = getPgPool()
  if (!pool) throw new Error('No Postgres pool available')
  const result = await pool.query(text, values)
  return result.rows
}

function normalizePostgresSql(sql) {
  let normalized = String(sql || '').trim()

  if (/^INSERT\s+OR\s+IGNORE\s+INTO/i.test(normalized)) {
    normalized = normalized.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO')
    if (!/ON\s+CONFLICT/i.test(normalized)) {
      normalized = normalized.replace(/;\s*$/, '') + ' ON CONFLICT DO NOTHING'
    }
  }

  normalized = normalized.replace(/datetime\(created_at\)/gi, 'created_at::timestamptz')
  normalized = normalized.replace(/datetime\(meeting_date\)/gi, 'meeting_date::timestamptz')
  normalized = normalized.replace(/datetime\('now',\s*'-24 hours'\)/gi, "NOW() - INTERVAL '24 hours'")
  normalized = normalized.replace(/datetime\('now',\s*'-1 hour'\)/gi, "NOW() - INTERVAL '1 hour'")
  normalized = normalized.replace(/datetime\('now',\s*'-1 day'\)/gi, "NOW() - INTERVAL '1 day'")
  normalized = normalized.replace(/datetime\('now'\)/gi, 'NOW()')

  return normalized
}

function bindPostgresParams(sql, rawParams) {
  const params = rawParams.length === 1 && rawParams[0] && typeof rawParams[0] === 'object' && !Array.isArray(rawParams[0])
    ? rawParams[0]
    : rawParams
  const values = []

  if (Array.isArray(params)) {
    let index = 0
    const text = normalizePostgresSql(sql).replace(/\?/g, () => {
      values.push(params[index++])
      return `$${values.length}`
    })

    return { text, values }
  }

  const text = normalizePostgresSql(sql).replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key) => {
    values.push(params[key])
    return `$${values.length}`
  })

  return { text, values }
}

function executePostgresStatementsSync(queries, useTransaction = false) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Postgres mode')
  }

  const payload = { queries, transaction: useTransaction }
  const script = `
    import { Client } from 'pg'
    const payload = JSON.parse(process.argv[1])
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      if (payload.transaction) await client.query('BEGIN')
      let result = { rows: [], rowCount: 0 }
      for (const query of payload.queries) { result = await client.query(query.text, query.values) }
      if (payload.transaction) await client.query('COMMIT')
      process.stdout.write(JSON.stringify({ rows: result.rows, rowCount: result.rowCount }))
    } catch (e) {
      if (payload.transaction) { try { await client.query('ROLLBACK') } catch {} }
      process.stderr.write(JSON.stringify({ message: e.message, code: e.code }))
      process.exit(1)
    } finally { await client.end() }
  `

  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script, JSON.stringify(payload)], {
    env: process.env,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    let msg = 'Postgres query failed'
    if (result.stderr) { try { msg = JSON.parse(result.stderr).message || msg } catch { msg = result.stderr.trim() || msg } }
    throw new Error(msg)
  }

  try { return JSON.parse(result.stdout || '{"rows":[],"rowCount":0}') } catch { return { rows: [], rowCount: 0 } }
}

function createPostgresLikeDatabase() {
  const makeStatement = (sql) => ({
    all: (...params) => {
      const query = bindPostgresParams(sql, params)
      const response = executePostgresStatementsSync([query], false)
      return response.rows || []
    },
    get: (...params) => {
      const rows = makeStatement(sql).all(...params)
      return rows[0] || null
    },
    run: (...params) => {
      const query = bindPostgresParams(sql, params)

      if (currentTransaction) {
        currentTransaction.queries.push(query)
        return { changes: 0, lastInsertRowid: null }
      }

      const response = executePostgresStatementsSync([query], false)
      return { changes: response.rowCount || 0, lastInsertRowid: null }
    },
  })

  return {
    prepare: (sql) => makeStatement(sql),
    transaction: (fn) =>
      (...args) => {
        const previousTransaction = currentTransaction
        currentTransaction = { queries: [] }

        try {
          const result = fn(...args)

          if (currentTransaction.queries.length > 0) {
            executePostgresStatementsSync(currentTransaction.queries, true)
          }

          return result
        } finally {
          currentTransaction = previousTransaction
        }
      },
    exec: () => undefined,
    pragma: () => undefined,
  }
}

function initializeSqliteDatabase() {
  fs.mkdirSync(dataDir, { recursive: true })

  database = new Database(dbPath)
  database.pragma('foreign_keys = ON')
  database.exec(fs.readFileSync(schemaPath, 'utf8'))
  databaseEngine = 'sqlite'

  const profileColumns = database.prepare('PRAGMA table_info(matrimony_profiles)').all()
  if (!profileColumns.some((column) => column.name === 'sub_community')) {
    database.exec('ALTER TABLE matrimony_profiles ADD COLUMN sub_community TEXT')
  }
}

if (preferPostgres) {
  try {
    database = createPostgresLikeDatabase()
    database.prepare('SELECT 1 AS ok').get()
    databaseEngine = 'postgres'
    // Tables already exist in Supabase via migrate.js - skip schema execution on startup
  } catch (error) {
    console.warn(`Postgres initialization failed, falling back to SQLite: ${error instanceof Error ? error.message : String(error)}`)
    initializeSqliteDatabase()
  }
} else {
  initializeSqliteDatabase()
}

const now = () => new Date().toISOString()

const timestamp = now()

const insertUser = database.prepare(`
  INSERT OR IGNORE INTO users (id, full_name, email, phone, avatar_url, created_at, updated_at)
  VALUES (@id, @full_name, @email, @phone, @avatar_url, @created_at, @updated_at)
`)

const insertAuthAccount = database.prepare(`
  INSERT OR IGNORE INTO auth_accounts (user_id, password_hash, created_at, updated_at)
  VALUES (@user_id, @password_hash, @created_at, @updated_at)
`)

const insertEmailOtpStatement = database.prepare(`
  INSERT INTO auth_email_otps (
    id, email, purpose, otp_code, expires_at, attempts, max_attempts, consumed_at, created_at
  ) VALUES (
    @id, @email, @purpose, @otp_code, @expires_at, @attempts, @max_attempts, @consumed_at, @created_at
  )
`)

const insertProfile = database.prepare(`
  INSERT OR IGNORE INTO matrimony_profiles (
    id, user_id, date_of_birth, age, gender, location, community, education, occupation,
    sub_community, bio, marital_status, height, income, language, compatibility_score,
    is_unlocked, is_shortlisted, is_viewed, created_at, updated_at
  ) VALUES (
    @id, @user_id, @date_of_birth, @age, @gender, @location, @community, @education, @occupation,
    @sub_community, @bio, @marital_status, @height, @income, @language, @compatibility_score,
    @is_unlocked, @is_shortlisted, @is_viewed, @created_at, @updated_at
  )
`)

const insertPreferences = database.prepare(`
  INSERT OR IGNORE INTO matrimony_preferences (
    id, profile_id, preferred_location, preferred_education, preferred_occupation,
    age_min, age_max, marital_status, income_range, languages, notes, created_at, updated_at
  ) VALUES (
    @id, @profile_id, @preferred_location, @preferred_education, @preferred_occupation,
    @age_min, @age_max, @marital_status, @income_range, @languages, @notes, @created_at, @updated_at
  )
`)

const insertSavedFilter = database.prepare(`
  INSERT OR IGNORE INTO matrimony_saved_filters (
    id, user_id, name, filters_json, created_at, updated_at
  ) VALUES (
    @id, @user_id, @name, @filters_json, @created_at, @updated_at
  )
`)

const insertActionStatement = database.prepare(`
  INSERT INTO matrimony_profile_actions (id, profile_id, actor_user_id, action_type, metadata_json, created_at)
  VALUES (@id, @profile_id, @actor_user_id, @action_type, @metadata_json, @created_at)
`)

const insertEventStatement = database.prepare(`
  INSERT INTO community_events (
    id, creator_user_id, title, event_date, location, organizer_name, guest_count,
    money_expected, money_collected, status, description, image_url, created_at, updated_at
  ) VALUES (
    @id, @creator_user_id, @title, @event_date, @location, @organizer_name, @guest_count,
    @money_expected, @money_collected, @status, @description, @image_url, @created_at, @updated_at
  )
`)

const insertEventGuestStatement = database.prepare(`
  INSERT INTO community_event_guests (
    id, event_id, name, rsvp_status, amount_promised, amount_received, payment_mode,
    notes, created_at, updated_at
  ) VALUES (
    @id, @event_id, @name, @rsvp_status, @amount_promised, @amount_received, @payment_mode,
    @notes, @created_at, @updated_at
  )
`)

const insertEventContributionStatement = database.prepare(`
  INSERT INTO community_event_contributions (
    id, event_id, guest_id, amount, payment_mode, notes, contribution_date, created_at
  ) VALUES (
    @id, @event_id, @guest_id, @amount, @payment_mode, @notes, @contribution_date, @created_at
  )
`)

const insertBusinessListingStatement = database.prepare(`
  INSERT INTO business_listings (
    id, creator_user_id, name, category, owner_name, description, contact_phone,
    contact_email, location, service_tags_json, verified, trending, promoted, featured,
    banner_image, gallery_json, services_json, rating, review_count, created_at, updated_at
  ) VALUES (
    @id, @creator_user_id, @name, @category, @owner_name, @description, @contact_phone,
    @contact_email, @location, @service_tags_json, @verified, @trending, @promoted, @featured,
    @banner_image, @gallery_json, @services_json, @rating, @review_count, @created_at, @updated_at
  )
`)

const insertCommunityPostStatement = database.prepare(`
  INSERT INTO community_posts (
    id, creator_user_id, title, content, author_name, category,
    pinned, likes_count, comments_count, created_at, updated_at
  ) VALUES (
    @id, @creator_user_id, @title, @content, @author_name, @category,
    @pinned, @likes_count, @comments_count, @created_at, @updated_at
  )
`)

const insertCommunityMeetingStatement = database.prepare(`
  INSERT INTO community_meetings (
    id, creator_user_id, title, meeting_date, location, host_name, agenda,
    created_at, updated_at
  ) VALUES (
    @id, @creator_user_id, @title, @meeting_date, @location, @host_name, @agenda,
    @created_at, @updated_at
  )
`)

const insertHelpRequestStatement = database.prepare(`
  INSERT INTO help_requests (
    id, creator_user_id, title, category, sub_type, amount_needed, amount_collected,
    status, urgency, location, contact_preference, description, reason,
    medical_category, expense_type, verification_status, risk_score, flags_json,
    created_at, updated_at
  ) VALUES (
    @id, @creator_user_id, @title, @category, @sub_type, @amount_needed, @amount_collected,
    @status, @urgency, @location, @contact_preference, @description, @reason,
    @medical_category, @expense_type, @verification_status, @risk_score, @flags_json,
    @created_at, @updated_at
  )
`)

const insertHelpSupportOfferStatement = database.prepare(`
  INSERT INTO help_support_offers (
    id, request_id, supporter_user_id, amount, offer_message, contact_mode, is_anonymous, created_at
  ) VALUES (
    @id, @request_id, @supporter_user_id, @amount, @offer_message, @contact_mode, @is_anonymous, @created_at
  )
`)

const upsertProfileStateStatement = database.prepare(`
  INSERT INTO matrimony_profile_states (
    profile_id, viewer_user_id, is_shortlisted, is_viewed, is_unlocked, updated_at
  ) VALUES (
    @profile_id, @viewer_user_id, @is_shortlisted, @is_viewed, @is_unlocked, @updated_at
  )
  ON CONFLICT(profile_id, viewer_user_id) DO UPDATE SET
    is_shortlisted = excluded.is_shortlisted,
    is_viewed = excluded.is_viewed,
    is_unlocked = excluded.is_unlocked,
    updated_at = excluded.updated_at
`)

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${digest}`
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function requestEmailOtp(email, purpose) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  if (!normalizedEmail || !['signup', 'login'].includes(normalizedPurpose)) {
    return { ok: false, statusCode: 400, error: 'Invalid email OTP request' }
  }

  const latest = database
    .prepare(
      `
        SELECT *
        FROM auth_email_otps
        WHERE lower(email) = lower(?)
          AND purpose = ?
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(normalizedEmail, normalizedPurpose)

  if (latest) {
    const elapsedMs = Date.now() - new Date(latest.created_at).getTime()
    if (Number.isFinite(elapsedMs) && elapsedMs < 60_000) {
      const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - elapsedMs) / 1000))
      return {
        ok: false,
        statusCode: 429,
        error: `Please wait ${retryAfterSeconds}s before requesting a new OTP`,
      }
    }
  }

  const otpInLastHour =
    database
      .prepare(
        `
          SELECT COUNT(*) AS total
          FROM auth_email_otps
          WHERE lower(email) = lower(?)
            AND purpose = ?
            AND datetime(created_at) >= datetime('now', '-1 hour')
        `
      )
      .get(normalizedEmail, normalizedPurpose)?.total || 0

  if (Number(otpInLastHour) >= 10) {
    return {
      ok: false,
      statusCode: 429,
      error: 'Too many OTP requests. Please try again after some time.',
    }
  }

  const otpCode = generateOtpCode()
  const createdAt = now()
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()

  insertEmailOtpStatement.run({
    id: `otp-${randomUUID()}`,
    email: normalizedEmail,
    purpose: normalizedPurpose,
    otp_code: otpCode,
    expires_at: expiresAt,
    attempts: 0,
    max_attempts: 5,
    consumed_at: null,
    created_at: createdAt,
  })

  return {
    ok: true,
    data: {
      email: normalizedEmail,
      purpose: normalizedPurpose,
      otpCode,
      expiresAt,
    },
  }
}

function verifyEmailOtp(email, purpose, otpCode) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  const normalizedCode = String(otpCode || '').trim()

  if (!normalizedEmail || !normalizedCode || !['signup', 'login'].includes(normalizedPurpose)) {
    return { ok: false, statusCode: 400, error: 'Invalid OTP verification request' }
  }

  const row = database
    .prepare(
      `
        SELECT *
        FROM auth_email_otps
        WHERE lower(email) = lower(?)
          AND purpose = ?
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(normalizedEmail, normalizedPurpose)

  if (!row) {
    return { ok: false, statusCode: 400, error: 'No active OTP found. Please request OTP again.' }
  }

  if (row.attempts >= row.max_attempts) {
    return { ok: false, statusCode: 429, error: 'Too many incorrect attempts. Please request a new OTP.' }
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, statusCode: 400, error: 'OTP has expired. Please request a new OTP.' }
  }

  if (String(row.otp_code) !== normalizedCode) {
    database.prepare('UPDATE auth_email_otps SET attempts = attempts + 1 WHERE id = ?').run(row.id)
    return { ok: false, statusCode: 400, error: 'Invalid OTP code' }
  }

  database.prepare('UPDATE auth_email_otps SET consumed_at = ? WHERE id = ?').run(now(), row.id)

  return { ok: true }
}

function invalidateActiveEmailOtps(email, purpose) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()

  if (!normalizedEmail || !['signup', 'login'].includes(normalizedPurpose)) {
    return
  }

  database
    .prepare(
      `
        UPDATE auth_email_otps
        SET consumed_at = ?
        WHERE lower(email) = lower(?)
          AND purpose = ?
          AND consumed_at IS NULL
      `
    )
    .run(now(), normalizedEmail, normalizedPurpose)
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(':')) {
    return false
  }

  const [salt, digest] = passwordHash.split(':')
  const candidate = scryptSync(password, salt, 64)
  const stored = Buffer.from(digest, 'hex')

  if (candidate.length !== stored.length) {
    return false
  }

  return timingSafeEqual(candidate, stored)
}

function avatarFromName(name) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
}

function mapPublicProfile(row) {
  return {
    id: row.id,
    name: row.full_name,
    age: row.age,
    location: row.location,
    community: row.community,
    subCommunity: row.sub_community,
    education: row.education,
    occupation: row.occupation,
    bio: row.bio,
    maritalStatus: row.marital_status,
    height: row.height,
    income: row.income,
    language: row.language,
    image: row.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.id}`,
    compatibilityScore: row.compatibility_score,
    isUnlocked: Boolean(row.is_unlocked),
    isShortlisted: Boolean(row.is_shortlisted),
    isViewed: Boolean(row.is_viewed),
    createdAt: row.created_at,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
  }
}

function getEventStatusFromDate(eventDate, storedStatus = 'upcoming') {
  if (storedStatus === 'cancelled') {
    return 'cancelled'
  }

  if (!eventDate) {
    return storedStatus
  }

  const eventTime = new Date(eventDate).getTime()
  if (Number.isNaN(eventTime)) {
    return storedStatus
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return eventTime < today.getTime() ? 'completed' : storedStatus
}

function mapEventRow(row) {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    title: row.title,
    date: row.event_date,
    location: row.location,
    organizer: row.organizer_name,
    guestCount: row.guest_count,
    moneyExpected: row.money_expected,
    moneyCollected: row.money_collected,
    status: getEventStatusFromDate(row.event_date, row.status),
    description: row.description || '',
    image: row.image_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBusinessRow(row) {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    name: row.name,
    category: row.category,
    ownerName: row.owner_name,
    description: row.description,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email || undefined,
    location: row.location,
    serviceTags: JSON.parse(row.service_tags_json || '[]'),
    verified: Boolean(row.verified),
    trending: Boolean(row.trending),
    promoted: Boolean(row.promoted),
    featured: Boolean(row.featured),
    bannerImage: row.banner_image || undefined,
    gallery: JSON.parse(row.gallery_json || '[]'),
    services: JSON.parse(row.services_json || '[]'),
    rating: row.rating ?? undefined,
    reviewCount: row.review_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCommunityPostRow(row) {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    title: row.title,
    content: row.content,
    author: row.author_name,
    createdAt: row.created_at,
    category: row.category,
    pinned: Boolean(row.pinned),
    likes: row.likes_count || 0,
    comments: row.comments_count || 0,
  }
}

function mapCommunityMeetingRow(row) {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    title: row.title,
    meetingDate: row.meeting_date,
    location: row.location,
    agenda: row.agenda,
    host: row.host_name,
    createdAt: row.created_at,
  }
}

function mapHelpRequestRow(row) {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    title: row.title,
    category: row.category,
    subType: row.sub_type || undefined,
    amount: row.amount_needed ?? undefined,
    collected: row.amount_collected ?? 0,
    status: row.status,
    urgency: row.urgency,
    location: row.location,
    contact: row.contact_preference,
    description: row.description,
    reason: row.reason || undefined,
    medicalCategory: row.medical_category || undefined,
    expenseType: row.expense_type || undefined,
    verificationStatus: row.verification_status,
    riskScore: row.risk_score || 0,
    postedAt: row.created_at,
    updatedAt: row.updated_at,
    postedBy: row.full_name,
    verified: row.verification_status === 'verified',
    supporterCount: Number(row.supporter_count || 0),
  }
}

function calculateHelpRiskSignals(payload) {
  const title = String(payload?.title || '')
  const description = String(payload?.description || '')
  const reason = String(payload?.reason || '')
  const combined = `${title} ${description} ${reason}`.toLowerCase()

  const scamKeywords = [
    'otp',
    'gift card',
    'bitcoin',
    'crypto',
    'western union',
    'urgent transfer',
    'transfer immediately',
    'lottery',
    'double money',
  ]

  let riskScore = 0
  const flags = []

  scamKeywords.forEach((keyword) => {
    if (combined.includes(keyword)) {
      riskScore += 20
      flags.push(`keyword:${keyword}`)
    }
  })

  const amountNeeded = Number(payload?.amount || payload?.amountNeeded || 0)
  if (Number.isFinite(amountNeeded) && amountNeeded > 500000) {
    riskScore += 15
    flags.push('high_amount')
  }

  if (String(payload?.urgency || '').toLowerCase() === 'critical') {
    riskScore += 8
    flags.push('critical_urgency')
  }

  if (description.trim().length < 40) {
    riskScore += 10
    flags.push('low_context_description')
  }

  const exclamations = (title.match(/!/g) || []).length + (description.match(/!/g) || []).length
  if (exclamations > 5) {
    riskScore += 8
    flags.push('aggressive_punctuation')
  }

  const alphaChars = combined.replace(/[^a-z]/g, '')
  const uppercaseChars = `${title} ${description} ${reason}`.replace(/[^A-Z]/g, '')
  if (alphaChars.length > 0 && uppercaseChars.length / alphaChars.length > 0.35) {
    riskScore += 8
    flags.push('excessive_caps')
  }

  return {
    riskScore,
    flags,
    initialStatus: riskScore >= 30 ? 'under_review' : 'open',
  }
}

function getHelpRequests({ category, urgency, status, search } = {}) {
  const query = `
    SELECT r.*, u.full_name,
      COALESCE((
        SELECT COUNT(*) FROM help_support_offers s WHERE s.request_id = r.id
      ), 0) AS supporter_count
    FROM help_requests r
    JOIN users u ON u.id = r.creator_user_id
    WHERE (@category::text IS NULL OR r.category = @category::text)
      AND (@urgency::text IS NULL OR r.urgency = @urgency::text)
      AND (@status::text IS NULL OR r.status = @status::text)
      AND (
        @search::text IS NULL OR
        LOWER(r.title) LIKE LOWER(@search_like::text) OR
        LOWER(r.description) LIKE LOWER(@search_like::text) OR
        LOWER(r.location) LIKE LOWER(@search_like::text) OR
        LOWER(u.full_name) LIKE LOWER(@search_like::text)
      )
    ORDER BY
      CASE r.status
        WHEN 'under_review' THEN 0
        WHEN 'open' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'resolved' THEN 3
        ELSE 4
      END,
      CASE r.urgency
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      r.created_at DESC
  `

  const cleanedSearch = search ? String(search).trim() : null

  return database
    .prepare(query)
    .all({
      category: category ? String(category).trim() : null,
      urgency: urgency ? String(urgency).trim() : null,
      status: status ? String(status).trim() : null,
      search: cleanedSearch,
      search_like: cleanedSearch ? `%${cleanedSearch}%` : null,
    })
    .map(mapHelpRequestRow)
}

function getHelpRequestById(requestId) {
  if (!requestId) {
    return null
  }

  const row = database
    .prepare(
      `
        SELECT r.*, u.full_name,
          COALESCE((
            SELECT COUNT(*) FROM help_support_offers s WHERE s.request_id = r.id
          ), 0) AS supporter_count
        FROM help_requests r
        JOIN users u ON u.id = r.creator_user_id
        WHERE r.id = ?
        LIMIT 1
      `
    )
    .get(requestId)

  return row ? mapHelpRequestRow(row) : null
}

function createHelpRequest(userId, payload) {
  if (!userId) {
    return { ok: false, error: 'Authentication required' }
  }

  const allowedCategories = new Set(['financial', 'medical', 'jobs', 'business', 'general'])
  const allowedUrgency = new Set(['low', 'medium', 'high', 'critical'])

  const title = String(payload?.title || '').trim()
  const category = String(payload?.category || '').trim().toLowerCase()
  const urgency = String(payload?.urgency || 'medium').trim().toLowerCase()
  const location = String(payload?.location || '').trim()
  const contact = String(payload?.contact || payload?.contactPreference || '').trim()
  const description = String(payload?.description || '').trim()
  const reason = String(payload?.reason || '').trim()
  const medicalCategory = String(payload?.medicalCategory || '').trim()
  const expenseType = String(payload?.expenseType || '').trim()

  if (title.length < 8 || title.length > 120) {
    return { ok: false, error: 'Title must be between 8 and 120 characters' }
  }

  if (!allowedCategories.has(category)) {
    return { ok: false, error: 'Invalid category' }
  }

  if (!allowedUrgency.has(urgency)) {
    return { ok: false, error: 'Invalid urgency' }
  }

  if (description.length < 20) {
    return { ok: false, error: 'Please provide at least 20 characters in request details' }
  }

  if (!location || !contact) {
    return { ok: false, error: 'Location and contact preference are required' }
  }

  const requestsToday = database
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM help_requests
        WHERE creator_user_id = ?
          AND datetime(created_at) >= datetime('now', '-24 hours')
      `
    )
    .get(userId)?.total || 0

  if (Number(requestsToday) >= 3) {
    return {
      ok: false,
      statusCode: 429,
      error: 'For safety, you can create up to 3 requests in 24 hours. Please try again later.',
    }
  }

  const amountNeededRaw = payload?.amount ?? payload?.amountNeeded
  const amountNeeded = amountNeededRaw === undefined || amountNeededRaw === null || amountNeededRaw === ''
    ? null
    : Number(amountNeededRaw)

  const needsAmount = category === 'financial' || category === 'medical'
  if (needsAmount && (!Number.isFinite(amountNeeded) || Number(amountNeeded) <= 0)) {
    return { ok: false, error: 'Amount needed must be a positive value for financial and medical requests' }
  }

  if (Number.isFinite(amountNeeded) && Number(amountNeeded) > 5000000) {
    return { ok: false, error: 'Amount seems too high. Please contact admin for manual review.' }
  }

  const risk = calculateHelpRiskSignals({
    title,
    description,
    reason,
    urgency,
    amount: amountNeeded,
  })

  const requestId = `help-${randomUUID()}`
  const createdAt = now()

  insertHelpRequestStatement.run({
    id: requestId,
    creator_user_id: userId,
    title,
    category,
    sub_type: payload?.subType ? String(payload.subType).trim() : null,
    amount_needed: Number.isFinite(amountNeeded) ? Number(amountNeeded) : null,
    amount_collected: 0,
    status: risk.initialStatus,
    urgency,
    location,
    contact_preference: contact,
    description,
    reason: reason || null,
    medical_category: medicalCategory || null,
    expense_type: expenseType || null,
    verification_status: 'pending',
    risk_score: risk.riskScore,
    flags_json: risk.flags.length > 0 ? JSON.stringify(risk.flags) : null,
    created_at: createdAt,
    updated_at: createdAt,
  })

  return {
    ok: true,
    data: getHelpRequestById(requestId),
  }
}

function offerHelpOnRequest(userId, requestId, payload) {
  if (!userId) {
    return { ok: false, error: 'Authentication required' }
  }

  const requestRecord = database
    .prepare('SELECT * FROM help_requests WHERE id = ? LIMIT 1')
    .get(requestId)

  if (!requestRecord) {
    return { ok: false, statusCode: 404, error: 'Help request not found' }
  }

  if (requestRecord.creator_user_id === userId) {
    return { ok: false, statusCode: 400, error: 'You cannot support your own request' }
  }

  if (['closed', 'rejected'].includes(requestRecord.status)) {
    return { ok: false, statusCode: 400, error: 'This request is no longer accepting support' }
  }

  if (requestRecord.status === 'under_review') {
    return { ok: false, statusCode: 400, error: 'This request is under review and cannot receive support yet' }
  }

  const amountRaw = payload?.amount
  const amount = amountRaw === undefined || amountRaw === null || amountRaw === '' ? 0 : Number(amountRaw)
  const offerMessage = String(payload?.offerMessage || payload?.message || '').trim()
  const contactMode = String(payload?.contactMode || '').trim()
  const isAnonymous = payload?.isAnonymous ? 1 : 0

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, statusCode: 400, error: 'Amount must be zero or a positive value' }
  }

  if (amount === 0 && offerMessage.length < 5) {
    return { ok: false, statusCode: 400, error: 'Please add a short support message when no amount is provided' }
  }

  const offerId = `help-offer-${randomUUID()}`
  const createdAt = now()

  insertHelpSupportOfferStatement.run({
    id: offerId,
    request_id: requestId,
    supporter_user_id: userId,
    amount,
    offer_message: offerMessage || null,
    contact_mode: contactMode || null,
    is_anonymous: isAnonymous,
    created_at: createdAt,
  })

  if (amount > 0) {
    database
      .prepare(
        `
          UPDATE help_requests
          SET amount_collected = amount_collected + ?,
              status = CASE
                WHEN amount_needed IS NOT NULL AND (amount_collected + ?) >= amount_needed THEN 'resolved'
                WHEN status IN ('open', 'in_progress') THEN 'in_progress'
                ELSE status
              END,
              updated_at = ?
          WHERE id = ?
        `
      )
      .run(amount, amount, createdAt, requestId)
  }

  return {
    ok: true,
    data: {
      id: offerId,
      requestId,
      amount,
      offerMessage,
      contactMode: contactMode || undefined,
      isAnonymous: Boolean(isAnonymous),
    },
  }
}

function getBusinessListings() {
  return database
    .prepare(
      `
        SELECT *
        FROM business_listings
        ORDER BY promoted DESC, featured DESC, trending DESC, created_at DESC
      `
    )
    .all()
    .map(mapBusinessRow)
}

function getBusinessListingById(listingId) {
  if (!listingId) {
    return null
  }

  const row = database
    .prepare(
      `
        SELECT *
        FROM business_listings
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(listingId)

  return row ? mapBusinessRow(row) : null
}

function createBusinessListing(userId, payload) {
  if (!userId) {
    return null
  }

  const name = String(payload?.name || '').trim()
  const category = String(payload?.category || '').trim()
  const ownerName = String(payload?.ownerName || '').trim()
  const description = String(payload?.description || '').trim()
  const contactPhone = String(payload?.contactPhone || '').trim()
  const location = String(payload?.location || '').trim()

  if (!name || !category || !ownerName || !description || !contactPhone || !location) {
    return null
  }

  const listingId = `biz-${randomUUID()}`
  const createdAt = now()
  const serviceTags = Array.isArray(payload?.serviceTags)
    ? payload.serviceTags.map((item) => String(item).trim()).filter(Boolean)
    : []
  const services = Array.isArray(payload?.services)
    ? payload.services.map((item) => String(item).trim()).filter(Boolean)
    : []
  const gallery = Array.isArray(payload?.gallery)
    ? payload.gallery.map((item) => String(item).trim()).filter(Boolean)
    : []

  insertBusinessListingStatement.run({
    id: listingId,
    creator_user_id: userId,
    name,
    category,
    owner_name: ownerName,
    description,
    contact_phone: contactPhone,
    contact_email: payload?.contactEmail ? String(payload.contactEmail).trim() : null,
    location,
    service_tags_json: JSON.stringify(serviceTags),
    verified: 0,
    trending: 0,
    promoted: 0,
    featured: 0,
    banner_image: payload?.bannerImage ? String(payload.bannerImage).trim() : null,
    gallery_json: JSON.stringify(gallery),
    services_json: JSON.stringify(services),
    rating: null,
    review_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
  })

  return getBusinessListingById(listingId)
}

function getCommunityPosts({ category, search, pinnedOnly } = {}) {
  const query = `
    SELECT *
    FROM community_posts
    WHERE (@category::text IS NULL OR category = @category::text)
      AND (@pinned_only::int = 0 OR pinned = 1)
      AND (
        @search::text IS NULL OR
        LOWER(title) LIKE LOWER(@search_like::text) OR
        LOWER(content) LIKE LOWER(@search_like::text) OR
        LOWER(author_name) LIKE LOWER(@search_like::text)
      )
    ORDER BY pinned DESC, created_at DESC
  `

  const cleanedCategory = category ? String(category).trim() : null
  const cleanedSearch = search ? String(search).trim() : null

  return database
    .prepare(query)
    .all({
      category: cleanedCategory || null,
      pinned_only: pinnedOnly ? 1 : 0,
      search: cleanedSearch || null,
      search_like: cleanedSearch ? `%${cleanedSearch}%` : null,
    })
    .map(mapCommunityPostRow)
}

function createCommunityPost(userId, payload) {
  if (!userId) {
    return null
  }

  const title = String(payload?.title || '').trim()
  const content = String(payload?.content || '').trim()
  const author = String(payload?.author || '').trim()
  const category = String(payload?.category || '').trim().toLowerCase()
  const pinned = payload?.pinned ? 1 : 0

  const allowedCategories = new Set([
    'meeting',
    'news',
    'celebration',
    'update',
    'achievement',
    'lost_found',
    'announcement',
  ])

  if (!title || !content || !author || !allowedCategories.has(category)) {
    return null
  }

  const postId = `post-${randomUUID()}`
  const createdAt = now()

  insertCommunityPostStatement.run({
    id: postId,
    creator_user_id: userId,
    title,
    content,
    author_name: author,
    category,
    pinned,
    likes_count: 0,
    comments_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
  })

  const row = database
    .prepare('SELECT * FROM community_posts WHERE id = ? LIMIT 1')
    .get(postId)

  return row ? mapCommunityPostRow(row) : null
}

function getUpcomingCommunityMeetings() {
  return database
    .prepare(
      `
        SELECT *
        FROM community_meetings
        WHERE datetime(meeting_date) >= datetime('now')
        ORDER BY meeting_date ASC, created_at DESC
      `
    )
    .all()
    .map(mapCommunityMeetingRow)
}

function createCommunityMeeting(userId, payload) {
  if (!userId) {
    return null
  }

  const title = String(payload?.title || '').trim()
  const meetingDate = String(payload?.meetingDate || payload?.date || '').trim()
  const location = String(payload?.location || '').trim()
  const host = String(payload?.host || '').trim()
  const agenda = String(payload?.agenda || '').trim()

  if (!title || !meetingDate || !location || !host || !agenda) {
    return null
  }

  const meetingId = `meeting-${randomUUID()}`
  const createdAt = now()

  insertCommunityMeetingStatement.run({
    id: meetingId,
    creator_user_id: userId,
    title,
    meeting_date: meetingDate,
    location,
    host_name: host,
    agenda,
    created_at: createdAt,
    updated_at: createdAt,
  })

  const row = database
    .prepare('SELECT * FROM community_meetings WHERE id = ? LIMIT 1')
    .get(meetingId)

  return row ? mapCommunityMeetingRow(row) : null
}

function getCommunityFeedStats() {
  const postCounts = database
    .prepare(
      `
        SELECT category, COUNT(*) AS total
        FROM community_posts
        GROUP BY category
      `
    )
    .all()

  const totalPosts = postCounts.reduce((sum, row) => sum + Number(row.total || 0), 0)
  const pinnedPosts = database
    .prepare('SELECT COUNT(*) AS total FROM community_posts WHERE pinned = 1')
    .get()?.total || 0
  const upcomingMeetings = database
    .prepare("SELECT COUNT(*) AS total FROM community_meetings WHERE datetime(meeting_date) >= datetime('now')")
    .get()?.total || 0

  return {
    totalPosts,
    pinnedPosts: Number(pinnedPosts),
    upcomingMeetings: Number(upcomingMeetings),
    byCategory: postCounts.reduce((acc, row) => ({ ...acc, [row.category]: Number(row.total) }), {}),
  }
}

function getOwnedEvents(userId) {
  if (!userId) {
    return []
  }

  return database
    .prepare(
      `
        SELECT *
        FROM community_events
        WHERE creator_user_id = ?
        ORDER BY event_date DESC, created_at DESC
      `
    )
    .all(userId)
    .map(mapEventRow)
}

function getOwnedEventById(userId, eventId) {
  if (!userId || !eventId) {
    return null
  }

  const row = database
    .prepare(
      `
        SELECT *
        FROM community_events
        WHERE creator_user_id = ? AND id = ?
        LIMIT 1
      `
    )
    .get(userId, eventId)

  return row ? mapEventRow(row) : null
}

function getOwnedEventGuests(userId, eventId) {
  const event = getOwnedEventById(userId, eventId)
  if (!event) {
    return null
  }

  return database
    .prepare(
      `
        SELECT *
        FROM community_event_guests
        WHERE event_id = ?
        ORDER BY created_at DESC
      `
    )
    .all(eventId)
    .map((row) => ({
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      rsvpStatus: row.rsvp_status,
      amountPromised: row.amount_promised,
      amountReceived: row.amount_received,
      paymentMode: row.payment_mode || undefined,
      notes: row.notes || '',
    }))
}

function getOwnedEventSummary(userId) {
  const events = getOwnedEvents(userId)
  return {
    totalCreated: events.length,
    upcomingCount: events.filter((event) => event.status === 'upcoming' || event.status === 'ongoing').length,
    pastCount: events.filter((event) => event.status === 'completed' || event.status === 'cancelled').length,
    pendingCount: events.filter((event) => event.moneyCollected < event.moneyExpected).length,
    fullyCollectedCount: events.filter((event) => event.moneyCollected >= event.moneyExpected && event.moneyExpected > 0).length,
  }
}

function getPublicProfiles(currentUserId = 'user-1') {
  if (!currentUserId) {
    return []
  }

  return database
    .prepare(`
      SELECT
        u.full_name,
        u.avatar_url,
        p.*,
        COALESCE(s.is_shortlisted, 0) AS is_shortlisted,
        COALESCE(s.is_viewed, 0) AS is_viewed,
        COALESCE(s.is_unlocked, 0) AS is_unlocked
      FROM matrimony_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN matrimony_profile_states s
        ON s.profile_id = p.id AND s.viewer_user_id = ?
      WHERE p.user_id != ?
      ORDER BY p.compatibility_score DESC, p.created_at DESC
    `)
    .all(currentUserId, currentUserId)
    .map(mapPublicProfile)
}

function getSavedFiltersByUserId(userId) {
  return database
    .prepare('SELECT * FROM matrimony_saved_filters WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      filters: JSON.parse(row.filters_json),
    }))
}

function getCurrentMemberPayload(userId = 'user-1') {
  if (!userId) {
    return null
  }

  const record = database
    .prepare(`
      SELECT u.id AS user_id, u.full_name, u.email, u.phone, u.avatar_url,
             p.id AS profile_id, p.date_of_birth, p.age, p.gender, p.location, p.community,
              p.sub_community, p.education, p.occupation, p.bio, p.marital_status, p.height, p.income, p.language,
             p.compatibility_score, p.is_unlocked, p.is_shortlisted, p.is_viewed,
             p.created_at, p.updated_at
      FROM users u
      JOIN matrimony_profiles p ON p.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `)
    .get(userId)

  if (!record) {
    return null
  }

  const preference = database
    .prepare('SELECT * FROM matrimony_preferences WHERE profile_id = ? LIMIT 1')
    .get(record.profile_id)

  return {
    user: {
      id: record.user_id,
      fullName: record.full_name,
      email: record.email,
      phone: record.phone,
      avatar: record.avatar_url,
    },
    profile: {
      fullName: record.full_name,
      email: record.email,
      phone: record.phone,
      location: record.location,
      occupation: record.occupation,
      education: record.education,
      bio: record.bio,
    },
    matrimony: {
      age: String(record.age),
      maritalStatus: record.marital_status,
      height: record.height,
      income: record.income,
      community: record.community,
      language: record.language,
      profileBio: record.bio,
      preferredLocation: preference?.preferred_location || '',
      preferredEducation: preference?.preferred_education || '',
      preferredOccupation: preference?.preferred_occupation || '',
      subCommunity: record.sub_community || '',
    },
    preferences: preference
      ? {
          id: preference.id,
          preferredLocation: preference.preferred_location || '',
          preferredEducation: preference.preferred_education || '',
          preferredOccupation: preference.preferred_occupation || '',
          ageMin: preference.age_min,
          ageMax: preference.age_max,
          maritalStatus: preference.marital_status || '',
          incomeRange: preference.income_range || '',
          languages: preference.languages || '',
          notes: preference.notes || '',
        }
      : null,
  }
}

function applyProfileUpdate(userId, payload) {
  if (!userId) {
    return null
  }

  const record = database
    .prepare(`
      SELECT p.id AS profile_id
      FROM users u
      JOIN matrimony_profiles p ON p.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `)
    .get(userId)

  if (!record) {
    return null
  }

  const updatedAt = now()
  const nextUser = payload.user || {}
  const nextProfile = {
    ...(payload.profile || {}),
    ...(payload.matrimony || {}),
  }
  const nextPreferences = payload.preferences || {
    preferredLocation: payload.matrimony?.preferredLocation,
    preferredEducation: payload.matrimony?.preferredEducation,
    preferredOccupation: payload.matrimony?.preferredOccupation,
  }

  database.prepare(`
    UPDATE users
    SET full_name = COALESCE(@full_name, full_name),
        email = COALESCE(@email, email),
        phone = COALESCE(@phone, phone),
        avatar_url = COALESCE(@avatar_url, avatar_url),
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: userId,
    full_name: nextUser.fullName ?? null,
    email: nextUser.email ?? null,
    phone: nextUser.phone ?? null,
    avatar_url: nextUser.avatar ?? null,
    updated_at: updatedAt,
  })

  database.prepare(`
    UPDATE matrimony_profiles
    SET age = COALESCE(@age, age),
        location = COALESCE(@location, location),
        community = COALESCE(@community, community),
      sub_community = COALESCE(@sub_community, sub_community),
        education = COALESCE(@education, education),
        occupation = COALESCE(@occupation, occupation),
        bio = COALESCE(@bio, bio),
        marital_status = COALESCE(@marital_status, marital_status),
        height = COALESCE(@height, height),
        income = COALESCE(@income, income),
        language = COALESCE(@language, language),
        updated_at = @updated_at
    WHERE user_id = @user_id
  `).run({
    user_id: userId,
    age: nextProfile.age ? Number(nextProfile.age) : null,
    location: nextProfile.location ?? null,
    community: nextProfile.community ?? null,
    sub_community: nextProfile.subCommunity ?? null,
    education: nextProfile.education ?? null,
    occupation: nextProfile.occupation ?? null,
    bio: nextProfile.bio ?? null,
    marital_status: nextProfile.maritalStatus ?? null,
    height: nextProfile.height ?? null,
    income: nextProfile.income ?? null,
    language: nextProfile.language ?? null,
    updated_at: updatedAt,
  })

  if (nextPreferences && Object.keys(nextPreferences).length > 0) {
    database.prepare(`
      INSERT INTO matrimony_preferences (
        id, profile_id, preferred_location, preferred_education, preferred_occupation,
        age_min, age_max, marital_status, income_range, languages, notes, created_at, updated_at
      ) VALUES (
        @id, @profile_id, @preferred_location, @preferred_education, @preferred_occupation,
        @age_min, @age_max, @marital_status, @income_range, @languages, @notes, @created_at, @updated_at
      )
      ON CONFLICT(profile_id) DO UPDATE SET
        preferred_location = excluded.preferred_location,
        preferred_education = excluded.preferred_education,
        preferred_occupation = excluded.preferred_occupation,
        age_min = excluded.age_min,
        age_max = excluded.age_max,
        marital_status = excluded.marital_status,
        income_range = excluded.income_range,
        languages = excluded.languages,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run({
      id: nextPreferences.id || `pref-${record.profile_id}`,
      profile_id: record.profile_id,
      preferred_location: nextPreferences.preferredLocation ?? null,
      preferred_education: nextPreferences.preferredEducation ?? null,
      preferred_occupation: nextPreferences.preferredOccupation ?? null,
      age_min: nextPreferences.ageMin ? Number(nextPreferences.ageMin) : null,
      age_max: nextPreferences.ageMax ? Number(nextPreferences.ageMax) : null,
      marital_status: nextPreferences.maritalStatus ?? null,
      income_range: nextPreferences.incomeRange ?? null,
      languages: nextPreferences.languages ?? null,
      notes: nextPreferences.notes ?? null,
      created_at: updatedAt,
      updated_at: updatedAt,
    })
  }

  return getCurrentMemberPayload(userId)
}

function getProfileState(profileId, viewerUserId) {
  return database
    .prepare(
      'SELECT profile_id, viewer_user_id, is_shortlisted, is_viewed, is_unlocked FROM matrimony_profile_states WHERE profile_id = ? AND viewer_user_id = ? LIMIT 1'
    )
    .get(profileId, viewerUserId)
}

function updateProfileState(profileId, viewerUserId, nextState) {
  const current = getProfileState(profileId, viewerUserId) || {
    is_shortlisted: 0,
    is_viewed: 0,
    is_unlocked: 0,
  }

  upsertProfileStateStatement.run({
    profile_id: profileId,
    viewer_user_id: viewerUserId,
    is_shortlisted: nextState.is_shortlisted ?? current.is_shortlisted,
    is_viewed: nextState.is_viewed ?? current.is_viewed,
    is_unlocked: nextState.is_unlocked ?? current.is_unlocked,
    updated_at: now(),
  })
}

function recordProfileAction({ profileId, actorUserId, actionType, metadata }) {
  insertActionStatement.run({
    id: `action-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    profile_id: profileId,
    actor_user_id: actorUserId,
    action_type: actionType,
    metadata_json: metadata ? JSON.stringify(metadata) : null,
    created_at: now(),
  })
}

function createCommunityEvent(userId, eventData) {
  if (!userId) {
    return null
  }

  const createdAt = now()
  const eventDate = eventData.date || eventData.eventDate || ''
  const storedStatus = eventDate && new Date(eventDate).getTime() < new Date().setHours(0, 0, 0, 0) ? 'completed' : 'upcoming'
  const eventId = `event-${randomUUID()}`

  insertEventStatement.run({
    id: eventId,
    creator_user_id: userId,
    title: eventData.title || '',
    event_date: eventDate,
    location: eventData.location || '',
    organizer_name: eventData.organizer || eventData.organizerName || '',
    guest_count: Number(eventData.guestCount || 0),
    money_expected: Number(eventData.moneyExpected || 0),
    money_collected: Number(eventData.moneyCollected || 0),
    status: eventData.status || storedStatus,
    description: eventData.description || '',
    image_url: eventData.image || '',
    created_at: createdAt,
    updated_at: createdAt,
  })

  return getOwnedEventById(userId, eventId)
}

function addCommunityEventGuest(userId, eventId, guestData) {
  const event = getOwnedEventById(userId, eventId)
  if (!event) {
    return null
  }

  const createdAt = now()
  const guestId = `guest-${randomUUID()}`
  insertEventGuestStatement.run({
    id: guestId,
    event_id: eventId,
    name: guestData.name || '',
    rsvp_status: guestData.rsvpStatus || 'not_responded',
    amount_promised: Number(guestData.amountPromised || 0),
    amount_received: Number(guestData.amountReceived || 0),
    payment_mode: guestData.paymentMode || null,
    notes: guestData.notes || null,
    created_at: createdAt,
    updated_at: createdAt,
  })

  database.prepare(`
    UPDATE community_events
    SET guest_count = guest_count + 1,
        updated_at = ?
    WHERE id = ?
  `).run(createdAt, eventId)

  return getOwnedEventGuests(userId, eventId)?.find((guest) => guest.id === guestId) || null
}

function recordCommunityEventContribution(userId, eventId, guestId, amount, date, paymentMode, notes) {
  const event = getOwnedEventById(userId, eventId)
  if (!event) {
    return null
  }

  const guestLookup = String(guestId || '').trim()
  const guest = database
    .prepare('SELECT * FROM community_event_guests WHERE event_id = ? AND LOWER(name) = LOWER(?) LIMIT 1')
    .get(eventId, guestLookup)

  const resolvedGuest = guest || (() => {
    const createdAt = now()
    const newGuestId = `guest-${randomUUID()}`
    insertEventGuestStatement.run({
      id: newGuestId,
      event_id: eventId,
      name: guestLookup,
      rsvp_status: 'not_responded',
      amount_promised: 0,
      amount_received: 0,
      payment_mode: null,
      notes: null,
      created_at: createdAt,
      updated_at: createdAt,
    })

    database.prepare(`
      UPDATE community_events
      SET guest_count = guest_count + 1,
          updated_at = ?
      WHERE id = ?
    `).run(createdAt, eventId)

    return database
      .prepare('SELECT * FROM community_event_guests WHERE id = ? LIMIT 1')
      .get(newGuestId)
  })()

  if (!resolvedGuest) {
    return null
  }

  const createdAt = now()
  const contributionId = `contrib-${randomUUID()}`

  insertEventContributionStatement.run({
    id: contributionId,
    event_id: eventId,
    guest_id: resolvedGuest.id,
    amount: Number(amount),
    payment_mode: paymentMode,
    notes: notes || null,
    contribution_date: date,
    created_at: createdAt,
  })

  database.prepare(`
    UPDATE community_event_guests
    SET amount_received = amount_received + ?,
        payment_mode = ?,
        notes = COALESCE(?, notes),
        updated_at = ?
    WHERE id = ?
  `).run(Number(amount), paymentMode, notes || null, createdAt, resolvedGuest.id)

  database.prepare(`
    UPDATE community_events
    SET money_collected = money_collected + ?,
        updated_at = ?
    WHERE id = ?
  `).run(Number(amount), createdAt, eventId)

  return {
    id: contributionId,
    eventId,
    guestId: resolvedGuest.id,
    amount: Number(amount),
    date,
    paymentMode,
    notes: notes || '',
  }
}

function updateOwnedEventGuestRSVP(userId, guestId, rsvpStatus) {
  if (!userId || !guestId) {
    return null
  }

  const guest = database
    .prepare(
      `
        SELECT g.*
        FROM community_event_guests g
        JOIN community_events e ON e.id = g.event_id
        WHERE g.id = ? AND e.creator_user_id = ?
        LIMIT 1
      `
    )
    .get(guestId, userId)

  if (!guest) {
    return null
  }

  const updatedAt = now()
  database.prepare(`
    UPDATE community_event_guests
    SET rsvp_status = ?, updated_at = ?
    WHERE id = ?
  `).run(rsvpStatus, updatedAt, guestId)

  return {
    id: guest.id,
    eventId: guest.event_id,
    name: guest.name,
    rsvpStatus,
    amountPromised: guest.amount_promised,
    amountReceived: guest.amount_received,
    paymentMode: guest.payment_mode || undefined,
    notes: guest.notes || '',
  }
}

function userExists(userId) {
  const row = database.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(userId)
  return Boolean(row)
}

function authAccountExistsByEmail(email) {
  if (!email) {
    return false
  }

  const row = database
    .prepare(
      `
        SELECT u.id
        FROM users u
        JOIN auth_accounts a ON a.user_id = u.id
        WHERE lower(u.email) = lower(?)
        LIMIT 1
      `
    )
    .get(String(email).trim())

  return Boolean(row)
}

function toAuthUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar_url,
  }
}

function authenticateUser(email, password) {
  const row = database
    .prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, a.password_hash
      FROM users u
      JOIN auth_accounts a ON a.user_id = u.id
      WHERE lower(u.email) = lower(?)
      LIMIT 1
    `)
    .get(email)

  if (!row || !verifyPassword(password, row.password_hash)) {
    return null
  }

  return toAuthUser(row)
}

const createAuthUserTx = database.transaction(({
  fullName,
  email,
  password,
  gender,
  dateOfBirth,
  phone,
  age,
  location,
  community,
  subCommunity,
  education,
  occupation,
  maritalStatus,
  language,
}) => {
  const existing = database.prepare('SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1').get(email)
  if (existing) {
    return { ok: false, error: 'Email already registered' }
  }

  const userId = randomUUID()
  const profileId = `profile-${randomUUID()}`
  const preferenceId = `pref-${randomUUID()}`
  const createdAt = now()
  const numericAge = Number(age)
  const calculatedAge = Number.isFinite(numericAge) && numericAge >= 18 && numericAge <= 100
    ? Math.round(numericAge)
    : dateOfBirth
      ? Math.max(18, Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
      : 25

  const safeValue = (value, fallback = '') => {
    if (value === null || value === undefined) {
      return fallback
    }
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : fallback
  }

  insertUser.run({
    id: userId,
    full_name: fullName,
    email: email.toLowerCase(),
    phone: phone || null,
    avatar_url: avatarFromName(fullName),
    created_at: createdAt,
    updated_at: createdAt,
  })

  insertAuthAccount.run({
    user_id: userId,
    password_hash: hashPassword(password),
    created_at: createdAt,
    updated_at: createdAt,
  })

  insertProfile.run({
    id: profileId,
    user_id: userId,
    date_of_birth: dateOfBirth || null,
    age: calculatedAge,
    gender: safeValue(gender, 'unspecified'),
    location: safeValue(location, ''),
    community: safeValue(community, 'Chaudhary'),
    sub_community: safeValue(subCommunity, ''),
    education: safeValue(education, ''),
    occupation: safeValue(occupation, ''),
    bio: 'New member profile. Please update details in Profile section.',
    marital_status: safeValue(maritalStatus, 'Never Married'),
    height: '',
    income: '',
    language: safeValue(language, 'Hindi'),
    compatibility_score: 0,
    is_unlocked: 1,
    is_shortlisted: 0,
    is_viewed: 0,
    created_at: createdAt,
    updated_at: createdAt,
  })

  insertPreferences.run({
    id: preferenceId,
    profile_id: profileId,
    preferred_location: '',
    preferred_education: '',
    preferred_occupation: '',
    age_min: null,
    age_max: null,
    marital_status: '',
    income_range: '',
    languages: '',
    notes: '',
    created_at: createdAt,
    updated_at: createdAt,
  })

  return {
    ok: true,
    user: {
      id: userId,
      fullName,
      email: email.toLowerCase(),
      phone: phone || null,
      avatar: avatarFromName(fullName),
    },
  }
})

function createAuthUser(payload) {
  return createAuthUserTx(payload)
}

function getMatrimonyFilterOptions(userId) {
  const rows = getPublicProfiles(userId)
  const keepValue = (value) => {
    if (!value) return false
    const normalized = String(value).trim().toLowerCase()
    return normalized.length > 0 && normalized !== 'not set'
  }
  const byString = (items, key) =>
    Array.from(new Set(items.map((item) => item[key]).filter(keepValue))).sort((a, b) =>
      String(a).localeCompare(String(b))
    )

  const ages = rows.map((item) => item.age).filter((value) => Number.isFinite(value))

  return {
    locations: byString(rows, 'location'),
    genders: byString(rows, 'gender'),
    communities: byString(rows, 'community'),
    subCommunities: byString(rows, 'subCommunity'),
    educations: byString(rows, 'education'),
    occupations: byString(rows, 'occupation'),
    maritalStatuses: byString(rows, 'maritalStatus'),
    languages: byString(rows, 'language'),
    ageBounds: {
      min: ages.length > 0 ? Math.min(...ages) : 18,
      max: ages.length > 0 ? Math.max(...ages) : 60,
    },
  }
}

export {
  database,
  databaseEngine,
  getPublicProfiles,
  getSavedFiltersByUserId,
  getCurrentMemberPayload,
  applyProfileUpdate,
  updateProfileState,
  recordProfileAction,
  authenticateUser,
  createAuthUser,
  requestEmailOtp,
  verifyEmailOtp,
  invalidateActiveEmailOtps,
  authAccountExistsByEmail,
  getMatrimonyFilterOptions,
  userExists,
  getOwnedEvents,
  getOwnedEventById,
  getOwnedEventGuests,
  getOwnedEventSummary,
  createCommunityEvent,
  addCommunityEventGuest,
  recordCommunityEventContribution,
  updateOwnedEventGuestRSVP,
  getBusinessListings,
  getBusinessListingById,
  createBusinessListing,
  getCommunityPosts,
  createCommunityPost,
  getUpcomingCommunityMeetings,
  createCommunityMeeting,
  getCommunityFeedStats,
  getHelpRequests,
  getHelpRequestById,
  createHelpRequest,
  offerHelpOnRequest,
}
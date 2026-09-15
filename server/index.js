import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import Razorpay from 'razorpay'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { isSmsConfigured, sendOtpSms } from './sms.js'
import { PostgresRateLimitStore } from './rate-limit-store.js'
import {
  acknowledgeSubscription,
  getSubscriptionFromPlay,
  isPlayBillingConfigured,
  isValidRtdnToken,
} from './play-billing.js'
import { LRUCache } from 'lru-cache'
import {
  applyProfileUpdate,
  authAccountExistsByEmail,
  authenticateUser,
  addCommunityEventGuest,
  createBusinessListing,
  createCommunityMeeting,
  createCommunityPost,
  createAuthUser,
  createCommunityEvent,
  createHelpRequest,
  databaseEngine,
  database,
  getHelpRequestById,
  getHelpRequests,
  getCommunityFeedStats,
  getCommunityPosts,
  getUpcomingCommunityMeetings,
  getBusinessListingById,
  getBusinessListings,
  getCurrentMemberPayload,
  getOwnedEventById,
  getOwnedEventGuests,
  getOwnedEventSummary,
  getOwnedEvents,
  getMatrimonyFilterOptions,
  getPublicProfiles,
  getSavedFiltersByUserId,
  invalidateActiveEmailOtps,
  recordCommunityEventContribution,
  requestEmailOtp,
  updateOwnedEventGuestRSVP,
  offerHelpOnRequest,
  updateProfileState,
  recordProfileAction,
  verifyEmailOtp,
  userExists,
  pgQuery,
  warmUpPool,
} from './db.js'
import { sendEmailOtp } from './email.js'
import {
  authAccountExistsByEmailFast,
  getBusinessListingsFast,
  getCurrentMemberPayloadFast,
  getCommunityFeedStatsFast,
  getCommunityPostsFast,
  getHelpRequestsFast,
  getMatrimonyFilterOptionsFast,
  getMatrimonyProfileByIdFast,
  getOwnedEventByIdFast,
  getOwnedEventGuestsFast,
  getOwnedEventsFast,
  getOwnedEventSummaryFast,
  getPublicProfilesFast,
  getSavedFiltersByUserIdFast,
  invalidateActiveEmailOtpsFast,
  mapPublicProfile,
  requestEmailOtpFast,
} from './fast-queries.js'

// Bounded LRU cache — max 2000 entries, per-item TTL, no unbounded growth
const _cache = new LRUCache({ max: 2000, ttl: 5000, ttlAutopurge: false })
function cacheGet(key) {
  return _cache.get(key) ?? null
}
function cacheSet(key, value, ttlMs = 5000) {
  _cache.set(key, value, { ttl: ttlMs })
}
function cacheInvalidate(prefix) {
  for (const key of _cache.keys()) { if (key.startsWith(prefix)) _cache.delete(key) }
}

async function pgHashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const digest = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, buf) => err ? reject(err) : resolve(buf.toString('hex')))
  )
  return `${salt}:${digest}`
}
async function pgVerifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, digest] = storedHash.split(':')
  const candidate = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, buf) => err ? reject(err) : resolve(buf))
  )
  const stored = Buffer.from(digest, 'hex')
  if (candidate.length !== stored.length) return false
  return crypto.timingSafeEqual(candidate, stored)
}

const app = express()
const port = process.env.PORT || 3000
const OTP_SEND_TIMEOUT_MS = Number(process.env.OTP_SEND_TIMEOUT_MS || 25000)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // managed by frontend
}))
/*
 * CORS was `origin: true` with credentials, which reflects back whatever Origin
 * the caller sends — every site was an allowed origin. Auth travels in a header
 * rather than a cookie, so a browser will not attach it automatically today,
 * but the setting removes the browser's own protection the moment a cookie is
 * introduced.
 *
 * Requests with no Origin are still allowed: the React Native app, curl and
 * server-to-server callers (Razorpay webhooks) send none, and CORS is not the
 * control protecting those — authentication is.
 */
const allowedOrigins = new Set(
  [
    ...String(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    // Vite dev servers for the web app and the admin dashboard.
    ...(process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173']),
  ]
)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      // Refuse by omitting the header rather than throwing, which would turn a
      // disallowed origin into a 500 instead of a clean browser-side block.
      callback(null, false)
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))

// Rate limiters
// Deliberately left on the in-memory store: this is a coarse traffic brake, and
// a database round-trip on every request would cost more than the precision is
// worth. Per-worker counters mean the real ceiling is this times the worker count.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
})
/*
 * Auth is the one limiter where the number is a security control rather than a
 * traffic brake, so it gets a shared store: in-memory counters are per-worker,
 * which multiplied the real cap by the worker count. The previous limit of 1000
 * per 15 minutes (left over from testing) was no brake on credential stuffing
 * or on guessing a six-digit code.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore({ prefix: 'auth' }),
  message: { success: false, error: 'Too many auth attempts, try again later.' },
})
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many uploads, slow down.' },
})
app.use(globalLimiter)
app.use('/api/auth', authLimiter)

/**
 * Accept any deliverable-looking address.
 *
 * Signup, login and the OTP request all used to require @gmail.com, which
 * locked out anyone on Outlook, Yahoo, or a work domain. Since email is now
 * the primary way members sign in, that restriction excludes real users for
 * no security benefit — the OTP is what proves the address, not its domain.
 */
function isValidEmail(email) {
  const value = String(email || '').trim()
  // Deliberately permissive: reject the obviously malformed, and let the OTP
  // decide the rest. A stricter pattern rejects valid addresses.
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}

/**
 * True if some account is already using this phone number. Numbers are
 * stored inconsistently across signup paths (raw 10-digit vs +91-prefixed),
 * so this compares on the last 10 digits rather than an exact string —
 * matching the unique index on users (users_phone_normalized_key) and the
 * lookup in phone/verify-otp.
 */
async function phoneAlreadyRegistered(rawPhone) {
  const normalizedPhone = String(rawPhone || '').replace(/\D/g, '').slice(-10)
  if (normalizedPhone.length !== 10) return false
  const rows = await pgQuery(
    `SELECT id FROM users WHERE right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1 LIMIT 1`,
    [normalizedPhone]
  )
  return rows.length > 0
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

/**
 * Express middleware for the /api/admin routes.
 *
 * These were previously unauthenticated: a single request returned every
 * user's name, email, phone and id. Admin is an explicit flag on the user
 * row, never inferred from anything the caller controls.
 */
async function requireAdmin(request, response, next) {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const rows = await pgQuery('SELECT is_admin FROM users WHERE id = $1 LIMIT 1', [activeUserId])
    if (!rows[0]?.is_admin) {
      // Deliberately the same shape as any other denial: do not tell a caller
      // whether they merely lack the flag, which confirms a valid session.
      response.status(403).json({ success: false, error: 'Admin access required' })
      return
    }
    next()
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
}

const JWT_TTL = '30d'

/**
 * Signing key for session tokens. There is deliberately no hardcoded
 * fallback: a predictable secret would let anyone mint a valid token for any
 * account, which is the exact flaw this replaces. Production refuses to boot
 * without it; development gets an ephemeral key, so restarting the server
 * invalidates existing sessions.
 */
const JWT_SECRET = (() => {
  const configured = process.env.JWT_SECRET
  if (configured && configured.length >= 32) return configured

  if (process.env.NODE_ENV === 'production') {
    console.error('[auth] FATAL: JWT_SECRET must be set (min 32 chars) in production')
    process.exit(1)
  }

  console.warn('[auth] JWT_SECRET not set — using an ephemeral development key. Sessions end on restart.')
  return crypto.randomBytes(48).toString('hex')
})()

/** Mint a session token. `sub` is the user id; nothing secret goes in the payload. */
function issueAuthToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: JWT_TTL })
}

/**
 * Identify the caller from their signed bearer token.
 *
 * Only the signature establishes identity. The `x-user-id` header is still
 * sent by older clients but is never trusted — before this, it *was* the
 * whole authentication check, so knowing any user's id was equivalent to
 * holding their password.
 */
function resolveUserId(request) {
  const header = request.header('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (!/^Bearer$/i.test(scheme || '') || !token) return null

  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }

  const userId = payload?.sub
  if (!userId) return null

  const ck = `user:${userId}`
  let exists = cacheGet(ck)
  if (exists === null) {
    exists = userExists(userId) ? true : false
    cacheSet(ck, exists, 300000) // 5 min TTL
  }
  return exists ? userId : null
}

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body || {}

  if (!email || !password) {
    response.status(400).json({ success: false, error: 'Email and password are required' })
    return
  }

  if (!isValidEmail(email)) {
    response.status(400).json({ success: false, error: 'Please enter a valid email address' })
    return
  }

  try {
    const rows = await pgQuery(
      `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, a.password_hash
       FROM users u
       JOIN auth_accounts a ON a.user_id = u.id
       WHERE lower(u.email) = lower($1)
       LIMIT 1`,
      [String(email).trim()]
    )
    const row = rows[0]
    if (!row || !await pgVerifyPassword(String(password), row.password_hash)) {
      response.status(401).json({ success: false, error: 'Account not found or incorrect password. Please check your credentials and try again.' })
      return
    }
    const user = { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row.full_name || row.email)}` }
    cacheSet(`user:${row.id}`, true, 300000)
    response.json({ success: true, data: { user, authToken: issueAuthToken(user.id) } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/auth/signup', async (request, response) => {
  const {
    fullName,
    email,
    password,
    confirmPassword,
    gender,
    dateOfBirth,
    phone,
    age,
    height,
    physicalStatus,
    location,
    country,
    state,
    city,
    village,
    nativeCity,
    nativeVillage,
    community,
    subCommunity,
    religion,
    caste,
    dosh,
    education,
    occupation,
    maritalStatus,
    language,
    eatingHabit,
    horoscopeTime,
    horoscopePlace,
    familyStatus,
    familyType,
    familyWealth,
    fatherName,
    motherName,
    fatherOccupation,
    motherOccupation,
    siblings,
    hobbies,
    music,
    sports,
    cuisine,
    motherTongue,
    profileCreatedFor,
    subcaste,
    openToAnySubcaste,
    employmentType,
    incomeCurrency,
    annualIncome,
    nakshatra,
    raasi,
    bio,
    createAccount = true, // Default to true for backward compatibility
  } = request.body || {}

  if (!fullName || !email || !password) {
    response.status(400).json({ success: false, error: 'Name, email and password are required' })
    return
  }

  if (!isValidEmail(email)) {
    response.status(400).json({ success: false, error: 'Please enter a valid email address' })
    return
  }

  if (String(password).length < 6) {
    response.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    return
  }

  if (confirmPassword && password !== confirmPassword) {
    response.status(400).json({ success: false, error: 'Passwords do not match' })
    return
  }

  try {
    // Only check for existing email when actually creating the account
    if (createAccount) {
      const existing = await pgQuery('SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1', [String(email).trim()])
      if (existing.length > 0) {
        response.status(409).json({ success: false, error: 'Email already registered' })
        return
      }

      // Belt-and-suspenders: the signup screen already blocks this at the
      // phone-entry step, but re-check here in case that step was bypassed —
      // e.g. an older app build, or the number being claimed by someone else
      // in the gap between that check and this request.
      if (phone && (await phoneAlreadyRegistered(phone))) {
        response.status(409).json({
          success: false,
          error: 'This phone number is already registered. Please log in instead.',
          code: 'PHONE_ALREADY_REGISTERED',
        })
        return
      }
    }

    const userId = crypto.randomUUID()
    const profileId = `profile-${crypto.randomUUID()}`
    const createdAt = new Date().toISOString()
    const safeStr = (v, fb = '') => v ? String(v).trim() || fb : fb
    const numericAge = Number(age)
    const calcAge = Number.isFinite(numericAge) && numericAge >= 18 && numericAge <= 100
      ? Math.round(numericAge)
      : dateOfBirth
        ? Math.max(18, Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
        : 25
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(fullName).trim())}`

    // Only create account when createAccount flag is true
    if (createAccount) {
      try {
        await pgQuery(
          `INSERT INTO users (id, email, full_name, phone, avatar_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [userId, String(email).trim().toLowerCase(), String(fullName).trim(), phone || null, avatarUrl, createdAt]
        )
        console.log('[signup-debug] Users table insert successful')
      } catch (err) {
        console.log('[signup-debug] Users table insert error:', err.message)
        throw err
      }
      
      try {
        await pgQuery(
          'INSERT INTO auth_accounts (user_id, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $3)',
          [userId, await pgHashPassword(String(password)), createdAt]
        )
        console.log('[signup-debug] Auth accounts table insert successful')
      } catch (err) {
        console.log('[signup-debug] Auth accounts table insert error:', err.message)
        throw err
      }
    }
    
    // Only create matrimony profile when createAccount flag is true
    if (createAccount) {
      // 21 columns exactly matching public.matrimony_profiles schema
      await pgQuery(
        `INSERT INTO matrimony_profiles
          (id, user_id, date_of_birth, age, gender, location, community, sub_community,
           education, occupation, bio, marital_status, height, income, language,
           compatibility_score, is_unlocked, is_shortlisted, is_viewed, created_at, updated_at,
           physical_status, religion, caste, dosh, country, state, village, native_city,
           native_village, family_status, family_type, family_wealth, father_name, mother_name,
           father_occupation, mother_occupation, siblings, eating_habit, horoscope_time,
           horoscope_place, hobbies, music, sports,
           cuisine, mother_tongue, profile_created_for, subcaste, open_to_any_subcaste,
           employment_type, income_currency, annual_income, nakshatra, raasi)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
           $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,
           $42::jsonb,$43::jsonb,$44::jsonb,
           $45::jsonb,$46,$47,$48,$49,$50,$51,$52,$53,$54)`,
        [
          profileId,                                    // $1  id
          userId,                                       // $2  user_id
          dateOfBirth || null,                          // $3  date_of_birth
          calcAge,                                      // $4  age
          safeStr(gender, 'unspecified'),               // $5  gender
          safeStr(city || location),                    // $6  location
          safeStr(community || caste, 'Chaudhary'),     // $7  community
          safeStr(subCommunity),                        // $8  sub_community
          safeStr(education),                           // $9  education
          safeStr(occupation),                          // $10 occupation
          safeStr(bio, 'New member. Please update your profile.'), // $11 bio
          safeStr(maritalStatus, 'Never Married'),      // $12 marital_status
          safeStr(height),                              // $13 height
          safeStr(annualIncome),                        // $14 income
          safeStr(language, 'Hindi'),                   // $15 language
          0,                                            // $16 compatibility_score
          0,                                            // $17 is_unlocked
          0,                                            // $18 is_shortlisted
          0,                                            // $19 is_viewed
          createdAt,                                    // $20 created_at
          createdAt,                                    // $21 updated_at
          safeStr(physicalStatus),                      // $22 physical_status
          safeStr(religion),                            // $23 religion
          safeStr(caste),                               // $24 caste
          safeStr(dosh),                                // $25 dosh
          safeStr(country),                             // $26 country
          safeStr(state),                               // $27 state
          safeStr(village),                             // $28 village
          safeStr(nativeCity),                          // $29 native_city
          safeStr(nativeVillage),                       // $30 native_village
          safeStr(familyStatus),                        // $31 family_status
          safeStr(familyType),                          // $32 family_type
          safeStr(familyWealth),                        // $33 family_wealth
          safeStr(fatherName),                          // $34 father_name
          safeStr(motherName),                          // $35 mother_name
          safeStr(fatherOccupation),                    // $36 father_occupation
          safeStr(motherOccupation),                    // $37 mother_occupation
          safeStr(siblings),                            // $38 siblings
          safeStr(eatingHabit),                         // $39 eating_habit
          safeStr(horoscopeTime),                       // $40 horoscope_time
          safeStr(horoscopePlace),                      // $41 horoscope_place
          hobbies ? JSON.stringify(hobbies) : null,     // $42 hobbies (jsonb)
          music ? JSON.stringify(music) : null,          // $43 music (jsonb)
          sports ? JSON.stringify(sports) : null,        // $44 sports (jsonb)
          cuisine ? JSON.stringify(cuisine) : null,      // $45 cuisine (jsonb)
          safeStr(motherTongue),                        // $46 mother_tongue
          safeStr(profileCreatedFor),                   // $47 profile_created_for
          safeStr(subcaste || subCommunity),            // $48 subcaste
          Boolean(openToAnySubcaste),                   // $49 open_to_any_subcaste
          safeStr(employmentType),                      // $50 employment_type
          safeStr(incomeCurrency),                      // $51 income_currency
          safeStr(annualIncome),                        // $52 annual_income
          safeStr(nakshatra),                           // $53 nakshatra
          safeStr(raasi),                               // $54 raasi
        ]
      )
    }

    if (createAccount) {
      const user = { id: userId, fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(), phone: phone || null, avatar: avatarUrl }
      cacheSet(`user:${userId}`, true, 300000)
      response.status(201).json({ success: true, data: { user, authToken: issueAuthToken(userId) } })
    } else {
      // Validation mode - just return success without creating account
      response.json({ success: true, data: { validated: true, message: 'Data validated successfully' } })
    }
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

/**
 * Verify an email OTP against Postgres.
 *
 * An async twin of verifyEmailOtp() in db.js, which runs through spawnSync and
 * blocks the worker. Same rules: newest unconsumed code for the address and
 * purpose, capped attempts, expiry, and single use.
 */
async function verifyEmailOtpAsync(email, purpose, otpCode) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  const normalizedCode = String(otpCode || '').trim()

  if (!normalizedEmail || !normalizedCode || !['signup', 'login'].includes(normalizedPurpose)) {
    return { ok: false, statusCode: 400, error: 'Invalid OTP verification request' }
  }

  const rows = await pgQuery(
    `SELECT id, otp_code, expires_at, attempts, max_attempts
     FROM auth_email_otps
     WHERE lower(email) = lower($1) AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail, normalizedPurpose]
  )

  const row = rows[0]
  if (!row) {
    return { ok: false, statusCode: 400, error: 'No active code found. Please request a new one.' }
  }

  if (row.attempts >= row.max_attempts) {
    return { ok: false, statusCode: 429, error: 'Too many incorrect attempts. Please request a new code.' }
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, statusCode: 400, error: 'This code has expired. Please request a new one.' }
  }

  const submitted = Buffer.from(normalizedCode)
  const expected = Buffer.from(String(row.otp_code))
  const matches = submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected)

  if (!matches) {
    await pgQuery('UPDATE auth_email_otps SET attempts = attempts + 1 WHERE id = $1', [row.id])
    return { ok: false, statusCode: 400, error: 'That code is not correct.' }
  }

  // Single use: consuming it here means a replay cannot verify twice.
  await pgQuery('UPDATE auth_email_otps SET consumed_at = $1 WHERE id = $2', [
    new Date().toISOString(),
    row.id,
  ])

  return { ok: true }
}

/*
 * Google Play review account.
 *
 * The app signs in with an emailed one-time code, which a Play reviewer cannot
 * receive — the code goes to a mailbox they do not control — so without this
 * they cannot get past the login screen and the submission is rejected.
 *
 * This is a deliberate, deliberately narrow bypass: it applies to exactly one
 * address, only when both environment variables are set, and only to an
 * account that already exists. It grants no privilege beyond a normal session
 * for that one account, which must hold no real member data. Clearing
 * REVIEW_ACCOUNT_EMAIL removes it entirely.
 */
const reviewAccountEmail = String(process.env.REVIEW_ACCOUNT_EMAIL || '').trim().toLowerCase()
const reviewAccountOtp = String(process.env.REVIEW_ACCOUNT_OTP || '').trim()
const reviewAccountEnabled = Boolean(reviewAccountEmail && reviewAccountOtp.length >= 6)

if (reviewAccountEmail && !reviewAccountEnabled) {
  console.warn('[review] REVIEW_ACCOUNT_EMAIL is set but REVIEW_ACCOUNT_OTP is missing or shorter than 6 characters; the review account is disabled')
}

// The app's code field is maxLength 6, so a longer value is silently truncated
// as it is typed and can never match. Warn rather than fail: the bypass still
// works over the API, it just cannot be used through the app.
if (reviewAccountEnabled && reviewAccountOtp.length !== 6) {
  console.warn(
    `[review] REVIEW_ACCOUNT_OTP is ${reviewAccountOtp.length} characters; the app's code field accepts exactly 6, so it cannot be entered there`
  )
}

function isReviewAccountEmail(email) {
  if (!reviewAccountEnabled) return false
  return String(email || '').trim().toLowerCase() === reviewAccountEmail
}

/** Constant-time check, so the fixed code cannot be recovered by timing. */
function matchesReviewOtp(candidate) {
  if (!reviewAccountEnabled) return false
  const given = Buffer.from(String(candidate || ''))
  const expected = Buffer.from(reviewAccountOtp)
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(given, expected)
}

app.post('/api/auth/otp/verify', async (request, response) => {
  const { email, purpose, otp } = request.body || {}

  try {
    // The review account skips the stored-code check; everything after this
    // (the account must exist, the session it gets) is the normal path.
    const usingReviewAccount = isReviewAccountEmail(email) && matchesReviewOtp(otp)
    if (usingReviewAccount) {
      console.warn(`[review] review account sign-in for ${reviewAccountEmail}`)
    }

    const result = usingReviewAccount ? { ok: true } : await verifyEmailOtpAsync(email, purpose, otp)
    if (!result.ok) {
      response.status(result.statusCode || 400).json({ success: false, error: result.error })
      return
    }

    // Signup verifies the address before the account exists, so there is no
    // session to hand back here — /auth/signup issues the token. For login the
    // account already exists, so this is the point a session is created.
    if (String(purpose).toLowerCase() === 'login') {
      const normalizedEmail = String(email).trim().toLowerCase()
      const rows = await pgQuery(
        'SELECT id, full_name, email, phone, avatar_url FROM users WHERE lower(email) = lower($1) LIMIT 1',
        [normalizedEmail]
      )
      const user = rows[0]
      if (!user) {
        response.status(404).json({ success: false, error: 'Account not found for this email' })
        return
      }

      cacheSet(`user:${user.id}`, true, 300000)
      response.json({
        success: true,
        data: {
          user: {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar_url,
          },
          authToken: issueAuthToken(user.id),
        },
      })
      return
    }

    response.json({ success: true, data: { verified: true } })
  } catch (err) {
    console.error('[OTP] verify error:', err.message)
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/auth/otp/request', async (request, response) => {
  // `phone` is optional and only used for signup: the screen collects the email
  // and phone together, so checking both here keeps a duplicate number caught
  // at the first step rather than after six screens of profile questions.
  const { email, purpose, phone } = request.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  const routeStart = Date.now()
  if (!normalizedEmail || !normalizedPurpose) {
    response.status(400).json({ success: false, error: 'Email and purpose are required' })
    return
  }

  if (!isValidEmail(normalizedEmail)) {
    response.status(400).json({ success: false, error: 'Please enter a valid email address' })
    return
  }

  if (!['signup', 'login'].includes(normalizedPurpose)) {
    response.status(400).json({ success: false, error: 'Invalid OTP purpose' })
    return
  }

  let accountExists = null
  try {
    accountExists = await authAccountExistsByEmailFast(normalizedEmail)
  } catch {
    accountExists = null
  }
  const doesAccountExist = accountExists === null ? await authAccountExistsByEmail(normalizedEmail) : accountExists

  if (normalizedPurpose === 'login' && !doesAccountExist) {
    response.status(404).json({ success: false, error: 'Account not found for this email' })
    return
  }

  if (normalizedPurpose === 'signup' && doesAccountExist) {
    response.status(409).json({ success: false, error: 'Email already registered' })
    return
  }

  if (normalizedPurpose === 'signup' && phone) {
    try {
      if (await phoneAlreadyRegistered(phone)) {
        response.status(409).json({
          success: false,
          error: 'This phone number is already registered. Please log in instead.',
          code: 'PHONE_ALREADY_REGISTERED',
        })
        return
      }
    } catch (err) {
      response.status(500).json({ success: false, error: err.message })
      return
    }
  }

  // Retire any code still outstanding for this address and purpose before
  // issuing another. Each row carries its own attempt counter, so leaving old
  // codes live multiplies the number of guesses an attacker gets, and lets a
  // stale row shadow the newest one when verifying.
  // The review account's code is fixed, so there is nothing to generate or
  // send. Answering normally keeps the app's two-step screen working.
  if (isReviewAccountEmail(normalizedEmail)) {
    console.warn(`[review] code request for the review account (${normalizedPurpose})`)
    response.json({
      success: true,
      data: {
        email: normalizedEmail,
        purpose: normalizedPurpose,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        sentViaFallback: false,
      },
    })
    return
  }

  try {
    await (databaseEngine === 'postgres'
      ? invalidateActiveEmailOtpsFast(normalizedEmail, normalizedPurpose)
      : invalidateActiveEmailOtps(normalizedEmail, normalizedPurpose))
  } catch (err) {
    console.warn('[OTP] could not retire previous codes:', err.message)
  }

  const otpRequest = databaseEngine === 'postgres'
    ? await requestEmailOtpFast(normalizedEmail, normalizedPurpose)
    : requestEmailOtp(normalizedEmail, normalizedPurpose)
  const otpCreatedAt = Date.now()
  console.log(`[OTP] created in ${otpCreatedAt - routeStart}ms for=${normalizedEmail} purpose=${normalizedPurpose}`)

  if (!otpRequest.ok || !otpRequest.data) {
    response
      .status(otpRequest.statusCode || 400)
      .json({ success: false, error: otpRequest.error || 'Unable to create OTP' })
    return
  }

  try {
    const sendStart = Date.now()
    
    // Guard OTP send from hanging forever while still allowing SMTP retry attempts.
    const sendResultPromise = sendEmailOtp({
      to: normalizedEmail,
      otpCode: otpRequest.data.otpCode,
      purpose: normalizedPurpose,
      expiresInMinutes: 5,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Email send timeout after ${OTP_SEND_TIMEOUT_MS}ms`)), OTP_SEND_TIMEOUT_MS)
    )

    const sendResult = await Promise.race([sendResultPromise, timeoutPromise])
    const sendEnd = Date.now()

    console.log(
      `[OTP] send completed to=${normalizedEmail} purpose=${normalizedPurpose} sendMs=${sendEnd - sendStart} totalMs=${sendEnd - routeStart} fallback=${Boolean(sendResult.fallback)}`,
    )

    // `fallback` means the mailer could not actually deliver (typically no SMTP
    // configured) and only logged the code. In production that must fail closed:
    // the previous condition OR'd it in, so an unconfigured mailer handed the
    // real code to the caller and any account could be taken over by email
    // address alone.
    if (sendResult.fallback && process.env.NODE_ENV === 'production') {
      console.error('[OTP] mailer is not configured; refusing to issue a code')
      await (databaseEngine === 'postgres'
        ? invalidateActiveEmailOtpsFast(normalizedEmail, normalizedPurpose)
        : invalidateActiveEmailOtps(normalizedEmail, normalizedPurpose))
      response.status(503).json({ success: false, error: 'Email sign-in is temporarily unavailable.' })
      return
    }

    response.json({
      success: true,
      data: {
        email: normalizedEmail,
        purpose: normalizedPurpose,
        expiresAt: otpRequest.data.expiresAt,
        sentViaFallback: Boolean(sendResult.fallback),
        ...(process.env.NODE_ENV !== 'production' ? { debugOtp: otpRequest.data.otpCode } : {}),
      },
    })
  } catch (error) {
    const errAt = Date.now()
    console.error(`[OTP] send error to=${normalizedEmail} purpose=${normalizedPurpose} afterMs=${errAt - routeStart}`, error)
    if (databaseEngine === 'postgres') {
      await invalidateActiveEmailOtpsFast(normalizedEmail, normalizedPurpose)
    } else {
      invalidateActiveEmailOtps(normalizedEmail, normalizedPurpose)
    }

    if (error?.code === 'RECIPIENT_NOT_FOUND') {
      response.status(400).json({
        success: false,
        error: 'This Gmail address could not receive OTP. Please check and try again.',
      })
      return
    }

    // Outside production, hand the code back so local development works without
    // SMTP. The timeout case used to be OR'd in here, which meant a production
    // send that timed out returned the real code to the caller.
    if (process.env.NODE_ENV !== 'production') {
      response.json({
        success: true,
        data: {
          email: normalizedEmail,
          purpose: normalizedPurpose,
          expiresAt: otpRequest.data.expiresAt,
          sentViaFallback: true,
          debugOtp: otpRequest.data.otpCode,
        },
      })
      return
    }

    response.status(500).json({
      success: false,
      error: 'Failed to send OTP email. Please try again.',
      ...(process.env.NODE_ENV !== 'production' ? { debugOtp: otpRequest.data.otpCode } : {}),
    })
  }
})


app.get('/api/health', (_request, response) => {
  response.json({
    success: true,
    service: 'chaudhary-samaj-api',
    database: databaseEngine,
    status: 'ok',
  })
})

// Phone OTP Authentication

/*
 * Phone OTP storage.
 *
 * These used to live in a per-process Map. `npm run server:prod` runs
 * cluster.js, which forks a worker per core, so a code issued by one worker
 * was invisible to the one that handled the verify request — phone login failed
 * roughly three times in four at four workers. Keeping them in Postgres makes
 * the state shared, and gives expiry that survives a restart.
 */
const PHONE_OTP_MAX_ATTEMPTS = 3

async function savePhoneOtp(phone, otpCode, expiresAt) {
  await pgQuery(
    `INSERT INTO auth_phone_otps (phone, otp_code, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       otp_code = EXCLUDED.otp_code,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       created_at = NOW()`,
    [phone, otpCode, new Date(expiresAt).toISOString()]
  )
}

async function getPhoneOtp(phone) {
  const rows = await pgQuery(
    'SELECT otp_code, expires_at, attempts FROM auth_phone_otps WHERE phone = $1 LIMIT 1',
    [phone]
  )
  return rows[0] || null
}

async function clearPhoneOtp(phone) {
  await pgQuery('DELETE FROM auth_phone_otps WHERE phone = $1', [phone])
}

/** Returns the attempt count after incrementing, so the caller can lock out. */
async function recordPhoneOtpFailure(phone) {
  const rows = await pgQuery(
    'UPDATE auth_phone_otps SET attempts = attempts + 1 WHERE phone = $1 RETURNING attempts',
    [phone]
  )
  return rows[0]?.attempts ?? PHONE_OTP_MAX_ATTEMPTS
}

app.post('/api/auth/phone/send-otp', async (request, response) => {
  const { phone, purpose } = request.body || {}
  const normalizedPhone = String(phone || '').trim().replace(/\D/g, '')

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    response.status(400).json({ success: false, error: 'Please provide a valid 10-digit phone number' })
    return
  }

  // Only the signup flow blocks here — phone login is expected to match an
  // existing account (or create one), so it must not be gated the same way.
  if (purpose === 'signup') {
    try {
      if (await phoneAlreadyRegistered(normalizedPhone)) {
        response.status(409).json({
          success: false,
          error: 'This phone number is already registered. Please log in instead.',
          code: 'PHONE_ALREADY_REGISTERED',
        })
        return
      }
    } catch (err) {
      response.status(500).json({ success: false, error: err.message })
      return
    }
  }

  // Use a CSPRNG: Math.random is predictable enough that an attacker who sees
  // a few codes can narrow the next one.
  const otpCode = String(crypto.randomInt(100000, 1000000))
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  const isProduction = process.env.NODE_ENV === 'production'

  await savePhoneOtp(normalizedPhone, otpCode, expiresAt)

  if (isSmsConfigured()) {
    try {
      await sendOtpSms(normalizedPhone, otpCode)
    } catch (err) {
      console.error('[phone-otp] SMS send failed:', err.message)
      await clearPhoneOtp(normalizedPhone)
      response.status(502).json({ success: false, error: 'Could not send the code. Please try again.' })
      return
    }

    response.json({ success: true, message: 'OTP sent successfully' })
    return
  }

  // No SMS provider. In production that must fail closed — returning the code
  // to the caller would let anyone log in as any account from its phone number
  // alone, which is exactly what this route used to do unconditionally.
  if (isProduction) {
    console.error('[phone-otp] MSG91 is not configured; refusing to issue a code')
    await clearPhoneOtp(normalizedPhone)
    response.status(503).json({ success: false, error: 'Phone sign-in is temporarily unavailable.' })
    return
  }

  console.log(`[phone-otp] (dev) +91${normalizedPhone} -> ${otpCode}`)
  response.json({
    success: true,
    message: 'OTP sent successfully (test mode)',
    mockOtp: otpCode,
  })
})

app.post('/api/auth/phone/verify-otp', async (request, response) => {
  const { phone, otp, verifyOnly } = request.body || {}
  const normalizedPhone = String(phone || '').trim().replace(/\D/g, '')
  const normalizedOtp = String(otp || '').trim()

  if (!normalizedPhone || !normalizedOtp) {
    response.status(400).json({ success: false, error: 'Phone and OTP are required' })
    return
  }

  const stored = await getPhoneOtp(normalizedPhone)

  if (!stored) {
    response.status(400).json({ success: false, error: 'OTP not found or expired. Please request new OTP.' })
    return
  }

  if (Date.now() > new Date(stored.expires_at).getTime()) {
    await clearPhoneOtp(normalizedPhone)
    response.status(400).json({ success: false, error: 'OTP expired. Please request new OTP.' })
    return
  }

  // Constant-time compare so a timing signal cannot narrow the code.
  const submitted = Buffer.from(normalizedOtp)
  const expected = Buffer.from(String(stored.otp_code))
  const otpMatches =
    submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected)

  if (!otpMatches) {
    const attempts = await recordPhoneOtpFailure(normalizedPhone)
    if (attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await clearPhoneOtp(normalizedPhone)
      response.status(400).json({ success: false, error: 'Too many failed attempts. Please request new OTP.' })
      return
    }
    response.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' })
    return
  }

  // verifyOnly mode: just confirm OTP is valid (used in signup flow before account creation)
  if (verifyOnly) {
    await clearPhoneOtp(normalizedPhone)
    response.json({ success: true, verified: true, message: 'OTP verified successfully' })
    return
  }

  // OTP verified - create/find user
  const fullPhone = `+91${normalizedPhone}`
  let userId = null
  let isNewUser = false

  try {
    // Numbers are stored inconsistently across signup paths (some raw 10-digit,
    // some E.164), so match on the last 10 digits rather than an exact string.
    const existingUser = await pgQuery(
      `SELECT id FROM users
       WHERE right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1
       LIMIT 1`,
      [normalizedPhone]
    )

    if (existingUser.length > 0) {
      userId = existingUser[0].id
    } else {
      // Create new user
      isNewUser = true
      userId = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const profileId = crypto.randomUUID()

      // users.email is NOT NULL, so phone-only accounts get a deterministic
      // placeholder. It is not a routable address and cannot be used to log in
      // via the email path, which requires a Gmail address.
      const placeholderEmail = `phone-${normalizedPhone}@phone.local`

      // Create user
      await pgQuery(
        `INSERT INTO users (id, email, full_name, phone, avatar_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [userId, placeholderEmail, `User_${normalizedPhone.slice(-4)}`, fullPhone, null, createdAt]
      )

      // Create auth account (no password for phone auth)
      await pgQuery(
        'INSERT INTO auth_accounts (user_id, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $3)',
        [userId, 'PHONE_AUTH_NO_PASSWORD', createdAt]
      )

      // Create matrimony profile
      await pgQuery(
        `INSERT INTO matrimony_profiles
          (id, user_id, date_of_birth, age, gender, location, community, education, occupation, bio,
           marital_status, height, income, language, compatibility_score, is_unlocked, is_shortlisted, is_viewed,
           created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)`,
        [
          profileId, userId, null, null, 'unspecified', null, 'Chaudhary', null, null,
          'New member. Please update your profile.',
          'Never Married', null, null, 'Hindi',
          0, 1, 0, 0,
          createdAt
        ]
      )
    }

    const token = issueAuthToken(userId)

    // Clear OTP
    await clearPhoneOtp(normalizedPhone)

    response.json({
      success: true,
      token,
      userId,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
    })
  } catch (err) {
    console.error('[phone-otp] Verification error:', err)
    response.status(500).json({ success: false, error: 'Failed to process login. Please try again.' })
  }
})

app.get('/api/community/posts', async (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { category, search, pinned } = request.query
  const pinnedOnly = String(pinned || '').toLowerCase() === 'true'

  const payload = {
    category: category ? String(category) : null,
    search: search ? String(search) : null,
    pinnedOnly,
  }

  try {
    const fastData = await getCommunityPostsFast(payload)
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({
    success: true,
    data: getCommunityPosts(payload),
  })
})

app.post('/api/community/posts', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const post = createCommunityPost(activeUserId, request.body || {})
  if (!post) {
    response.status(400).json({
      success: false,
      error: 'Required fields: title, content, author, category',
    })
    return
  }

  response.status(201).json({ success: true, data: post })
})

app.get('/api/community/meetings', (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  response.json({ success: true, data: getUpcomingCommunityMeetings() })
})

app.post('/api/community/meetings', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const meeting = createCommunityMeeting(activeUserId, request.body || {})
  if (!meeting) {
    response.status(400).json({
      success: false,
      error: 'Required fields: title, meetingDate, location, host, agenda',
    })
    return
  }

  response.status(201).json({ success: true, data: meeting })
})

app.get('/api/community/stats', async (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const fastData = await getCommunityFeedStatsFast()
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({ success: true, data: getCommunityFeedStats() })
})

app.get('/api/business/listings', async (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const fastData = await getBusinessListingsFast()
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({ success: true, data: getBusinessListings() })
})

app.get('/api/business/listings/:id', (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const listing = getBusinessListingById(request.params.id)
  if (!listing) {
    response.status(404).json({ success: false, error: 'Business listing not found' })
    return
  }

  response.json({ success: true, data: listing })
})

app.post('/api/business/listings', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const listing = createBusinessListing(activeUserId, request.body || {})
  if (!listing) {
    response.status(400).json({
      success: false,
      error: 'Required fields: name, category, owner name, description, contact phone, location',
    })
    return
  }

  response.status(201).json({ success: true, data: listing })
})

app.get('/api/help-requests', async (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { category, urgency, status, search } = request.query

  const payload = {
    category: category ? String(category) : null,
    urgency: urgency ? String(urgency) : null,
    status: status ? String(status) : null,
    search: search ? String(search) : null,
  }

  try {
    const fastData = await getHelpRequestsFast(payload)
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({
    success: true,
    data: getHelpRequests(payload),
  })
})

app.get('/api/help-requests/:id', (request, response) => {
  if (!resolveUserId(request)) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const item = getHelpRequestById(request.params.id)
  if (!item) {
    response.status(404).json({ success: false, error: 'Help request not found' })
    return
  }

  response.json({ success: true, data: item })
})

app.post('/api/help-requests', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const result = createHelpRequest(activeUserId, request.body || {})
  if (!result.ok) {
    response.status(result.statusCode || 400).json({ success: false, error: result.error || 'Unable to create help request' })
    return
  }

  response.status(201).json({ success: true, data: result.data })
})

app.post('/api/help-requests/:id/support', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const result = offerHelpOnRequest(activeUserId, request.params.id, request.body || {})
  if (!result.ok) {
    response.status(result.statusCode || 400).json({ success: false, error: result.error || 'Unable to submit support offer' })
    return
  }

  response.status(201).json({ success: true, data: result.data })
})

app.get('/api/matrimony/profiles', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    // Answering an unauthenticated caller with an empty list made a missing or
    // expired session look like "no matches found", so the app showed an empty
    // Matrimony tab instead of sending the member back to sign in. Every other
    // protected route answers 401, and the client already handles it.
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const {
    search,
    location,
    community,
    subCommunity,
    gender,
    education,
    occupation,
    maritalStatus,
    language,
    minAge,
    maxAge,
    tab,
  } = request.query

  let baseProfiles = null
  try {
    baseProfiles = await getPublicProfilesFast(activeUserId)
  } catch {
    baseProfiles = null
  }

  const profiles = (baseProfiles || getPublicProfiles(activeUserId)).filter((profile) => {
    const searchText = String(search || '').trim().toLowerCase()
    const matchesSearch =
      !searchText ||
      profile.name.toLowerCase().includes(searchText) ||
      profile.bio.toLowerCase().includes(searchText) ||
      profile.location.toLowerCase().includes(searchText)

    const matchesLocation = !location || profile.location === location
    const matchesCommunity = !community || profile.community === community
    const matchesSubCommunity = !subCommunity || profile.subCommunity === subCommunity
    const matchesGender = !gender || (profile.gender || '').toLowerCase() === String(gender).toLowerCase()
    const matchesEducation = !education || profile.education.includes(String(education))
    const matchesOccupation = !occupation || profile.occupation === occupation
    const matchesMaritalStatus = !maritalStatus || profile.maritalStatus === maritalStatus
    const matchesLanguage = !language || profile.language === language
    const matchesAgeMin = !minAge || profile.age >= Number(minAge)
    const matchesAgeMax = !maxAge || profile.age <= Number(maxAge)
    const matchesTab =
      !tab ||
      tab === 'all' ||
      (tab === 'shortlisted' && profile.isShortlisted) ||
      (tab === 'viewed' && profile.isViewed) ||
      (tab === 'locked' && !profile.isUnlocked) ||
      (tab === 'new' && profile.isNew)

    return (
      matchesSearch &&
      matchesLocation &&
      matchesCommunity &&
      matchesSubCommunity &&
      matchesGender &&
      matchesEducation &&
      matchesOccupation &&
      matchesMaritalStatus &&
      matchesLanguage &&
      matchesAgeMin &&
      matchesAgeMax &&
      matchesTab
    )
  })

  /*
   * Pagination.
   *
   * This endpoint returned every matching profile. Each row carries the full
   * detail payload — family, horoscope, interests — none of which the list
   * card renders, so the response ran about 1 KB per profile. At a few dozen
   * profiles that is invisible; at ten thousand it is a ~10 MB response on
   * mobile data every time the Matrimony tab opens.
   *
   * Note the filtering above still happens in memory over the full set, so
   * this bounds the response, not the database read. Pushing the filters into
   * SQL would also mean giving up the per-user cache of the whole list, so it
   * is left as a separate change.
   */
  const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 50)
  const offset = Math.max(Number(request.query.offset) || 0, 0)
  const page = profiles.slice(offset, offset + limit)

  // Redact anything past the free allowance for members without a subscription.
  // The ordering is deterministic (compatibility score, then age of profile), so
  // "the first N" is the same set on every request and matches what the detail
  // endpoint allows.
  let subscribed = false
  try {
    subscribed = await hasActiveSubscription(activeUserId)
  } catch (err) {
    // Fail closed: if we cannot confirm a subscription, do not hand over data.
    console.error('[paywall] subscription check failed:', err.message)
    response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
    return
  }

  const visible = subscribed
    ? page
    : page.map((profile, index) =>
        offset + index < FREE_PROFILE_LIMIT ? profile : lockedProfile(profile)
      )

  response.json({
    success: true,
    data: visible,
    pagination: {
      total: profiles.length,
      limit,
      offset,
      hasMore: offset + page.length < profiles.length,
    },
    access: {
      subscribed,
      freeLimit: FREE_PROFILE_LIMIT,
    },
  })
})

app.get('/api/matrimony/filter-options', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const fastData = await getMatrimonyFilterOptionsFast(activeUserId)
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({ success: true, data: getMatrimonyFilterOptions(activeUserId) })
})

app.get('/api/matrimony/profiles/:id', async (request, response) => {
  const activeUserId = resolveUserId(request)
  // This route resolved the caller but never checked the result, so it served
  // any member's full profile to an unauthenticated request.
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  let profile = null

  try {
    const raw = await getMatrimonyProfileByIdFast(activeUserId, request.params.id)
    if (raw) profile = mapPublicProfile(raw)
  } catch {
    profile = null
  }

  if (!profile) {
    const raw = database
      .prepare(`
        SELECT
          u.full_name,
          u.email,
          u.phone,
          u.avatar_url,
          p.*,
          COALESCE(s.is_shortlisted, 0) AS is_shortlisted,
          COALESCE(s.is_viewed, 0) AS is_viewed,
          COALESCE(s.is_unlocked, 0) AS is_unlocked
        FROM matrimony_profiles p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN matrimony_profile_states s
          ON s.profile_id = p.id AND s.viewer_user_id = ?
        WHERE p.id = ?
        LIMIT 1
      `)
      .get(activeUserId, request.params.id)
    if (raw) profile = mapPublicProfile(raw)
  }

  if (!profile) {
    response.status(404).json({ success: false, error: 'Profile not found' })
    return
  }

  // Same paywall as the list: without a subscription, only the first
  // FREE_PROFILE_LIMIT profiles of this member's ordering are readable.
  // Otherwise the list could be locked while the detail route handed over
  // everything to anyone who knew an id.
  let subscribed = false
  try {
    subscribed = await hasActiveSubscription(activeUserId)
  } catch (err) {
    console.error('[paywall] subscription check failed:', err.message)
    response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
    return
  }

  if (!subscribed) {
    let allowedIds = []
    try {
      const all = (await getPublicProfilesFast(activeUserId)) || []
      allowedIds = all.slice(0, FREE_PROFILE_LIMIT).map((entry) => entry.id)
    } catch (err) {
      console.error('[paywall] could not resolve the free allowance:', err.message)
      response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
      return
    }

    if (!allowedIds.includes(profile.id)) {
      response.status(403).json({
        success: false,
        error: 'Subscribe to ₹200/month to view this profile.',
        code: 'SUBSCRIPTION_REQUIRED',
      })
      return
    }
  }

  response.json({ success: true, data: profile })
})

/* ------------------------------------------------------------------ */
/* Paywall                                                             */
/* ------------------------------------------------------------------ */

/**
 * How many profiles a member can read in full before subscribing.
 *
 * The server is the authority. This limit used to live only in the mobile
 * client, which decided whether to draw a lock over a card whose data it had
 * already been sent — so the whole member directory was readable by anyone
 * with an account, subscribed or not.
 */
const FREE_PROFILE_LIMIT = 2

async function hasActiveSubscription(userId) {
  if (!userId) return false
  const rows = await pgQuery(
    `SELECT id FROM user_subscriptions
     WHERE user_id = $1 AND status = 'active' AND expires_at::timestamp > NOW()
     LIMIT 1`,
    [userId]
  )
  return rows.length > 0
}

/**
 * What a locked profile looks like on the wire.
 *
 * Only the id and the flag — the client needs to know a card belongs here and
 * how many there are, and nothing else. No name, age, location, bio, photo or
 * contact detail leaves the server for a profile the caller has not paid for.
 */
function lockedProfile(profile) {
  return { id: profile.id, isLocked: true }
}

/* ------------------------------------------------------------------ */
/* Matrimony interactions — async equivalents of the db.js helpers      */
/* ------------------------------------------------------------------ */

/*
 * These routes previously called the synchronous helpers in db.js. In Postgres
 * mode those run each statement through spawnSync — a whole Node process and a
 * fresh TLS connection to the database region, with the event loop blocked
 * throughout. On hot paths like viewing a profile that stalls every other
 * request on the worker.
 */

/** True if the profile exists; selects nothing else so it stays cheap. */
async function profileExists(profileId) {
  const rows = await pgQuery('SELECT id FROM matrimony_profiles WHERE id = $1 LIMIT 1', [profileId])
  return rows.length > 0
}

/**
 * Upsert one viewer's state for a profile. Null fields keep their current
 * value, which lets a single statement do what the sync helper needed a
 * read-then-write for — and removes the race between the two.
 */
async function updateProfileStateAsync(profileId, viewerUserId, next = {}) {
  const { is_shortlisted = null, is_viewed = null, is_unlocked = null } = next
  await pgQuery(
    `INSERT INTO matrimony_profile_states
       (profile_id, viewer_user_id, is_shortlisted, is_viewed, is_unlocked, updated_at)
     VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), COALESCE($5, 0), $6)
     ON CONFLICT (profile_id, viewer_user_id) DO UPDATE SET
       is_shortlisted = COALESCE($3, matrimony_profile_states.is_shortlisted),
       is_viewed      = COALESCE($4, matrimony_profile_states.is_viewed),
       is_unlocked    = COALESCE($5, matrimony_profile_states.is_unlocked),
       updated_at     = $6`,
    [profileId, viewerUserId, is_shortlisted, is_viewed, is_unlocked, new Date().toISOString()]
  )
}

async function recordProfileActionAsync({ profileId, actorUserId, actionType, metadata }) {
  await pgQuery(
    `INSERT INTO matrimony_profile_actions
       (id, profile_id, actor_user_id, action_type, metadata_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      `action-${crypto.randomUUID()}`,
      profileId,
      actorUserId,
      actionType,
      metadata ? JSON.stringify(metadata) : null,
      new Date().toISOString(),
    ]
  )
}

app.post('/api/matrimony/profiles/:id/shortlist', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    if (!(await profileExists(request.params.id))) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }

    const state = await pgQuery(
      'SELECT is_shortlisted FROM matrimony_profile_states WHERE profile_id = $1 AND viewer_user_id = $2 LIMIT 1',
      [request.params.id, activeUserId]
    )
    const nextValue = state[0]?.is_shortlisted ? 0 : 1

    await Promise.all([
      updateProfileStateAsync(request.params.id, activeUserId, { is_shortlisted: nextValue }),
      recordProfileActionAsync({
        profileId: request.params.id,
        actorUserId: activeUserId,
        actionType: 'shortlist',
        metadata: { shortlisted: Boolean(nextValue) },
      }),
    ])

    response.json({ success: true, data: { shortlisted: Boolean(nextValue) } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/matrimony/profiles/:id/view', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    if (!(await profileExists(request.params.id))) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }

    // Independent writes, so pay one round trip rather than two. Against a
    // pooler in another region each one costs real latency.
    await Promise.all([
      updateProfileStateAsync(request.params.id, activeUserId, { is_viewed: 1 }),
      recordProfileActionAsync({
        profileId: request.params.id,
        actorUserId: activeUserId,
        actionType: 'view',
      }),
    ])

    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/matrimony/profiles/:id/unlock', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  // Require active subscription to unlock (view phone number)
  try {
    const sub = await pgQuery(
      `SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = 'active' AND expires_at::timestamp > NOW() LIMIT 1`,
      [activeUserId]
    )
    if (!sub || sub.length === 0) {
      response.status(403).json({ success: false, error: 'Subscribe to ₹200/month plan to view phone numbers and unlock profiles.' })
      return
    }
  } catch {
    response.status(500).json({ success: false, error: 'Could not verify subscription' })
    return
  }

  try {
    if (!(await profileExists(request.params.id))) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }

    await Promise.all([
      updateProfileStateAsync(request.params.id, activeUserId, { is_unlocked: 1 }),
      recordProfileActionAsync({
        profileId: request.params.id,
        actorUserId: activeUserId,
        actionType: 'unlock',
        metadata: { subscriptionGated: true },
      }),
    ])

    response.json({ success: true, data: { unlocked: true } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

// Interest APIs
app.post('/api/matrimony/profiles/:id/interest', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { id: receiverId } = request.params

  try {
    const profileRows = await pgQuery(
      'SELECT id, user_id FROM matrimony_profiles WHERE id = $1 LIMIT 1',
      [receiverId]
    )
    const profile = profileRows[0]
    if (!profile) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }

    if (profile.user_id === activeUserId) {
      response.status(400).json({ success: false, error: 'Cannot send interest to yourself' })
      return
    }

    const receiverUserId = profile.user_id

    const existingRows = await pgQuery(
      'SELECT id, status FROM matrimony_interests WHERE sender_id = $1 AND receiver_id = $2 LIMIT 1',
      [activeUserId, receiverUserId]
    )
    const existing = existingRows[0]

    if (existing?.status === 'pending') {
      response.status(409).json({ success: false, error: 'Interest already sent' })
      return
    }
    if (existing?.status === 'accepted') {
      response.status(409).json({ success: false, error: 'Already matched' })
      return
    }

    // A declined interest can be re-sent, so reuse the row rather than
    // colliding with the unique (sender_id, receiver_id) constraint.
    const interestId = existing?.id || crypto.randomUUID()
    const now = new Date().toISOString()

    await pgQuery(
      `INSERT INTO matrimony_interests (id, sender_id, receiver_id, status, created_at)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (sender_id, receiver_id) DO UPDATE SET
         status = 'pending',
         updated_at = $4`,
      [interestId, activeUserId, receiverUserId, now]
    )

    cacheInvalidate(`interests:${activeUserId}`)
    cacheInvalidate(`interests:${receiverUserId}`)

    response.json({ success: true, data: { interestId, status: 'pending' } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/matrimony/interests', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const cacheKey = `interests:${activeUserId}`
  const cached = cacheGet(cacheKey)
  if (cached) { response.json(cached); return }

  try {
    // Run both queries in parallel
    const [sentRows, receivedRows] = await Promise.all([
      pgQuery(`
        SELECT i.id, p.id as profile_id, u.full_name as name, i.status, i.created_at
        FROM matrimony_interests i
        JOIN matrimony_profiles p ON i.receiver_id = p.user_id
        JOIN users u ON p.user_id = u.id
        WHERE i.sender_id = $1
        ORDER BY i.created_at DESC
      `, [activeUserId]),
      pgQuery(`
        SELECT i.id, p.id as profile_id, u.full_name as name, i.status, i.created_at
        FROM matrimony_interests i
        JOIN matrimony_profiles p ON i.sender_id = p.user_id
        JOIN users u ON p.user_id = u.id
        WHERE i.receiver_id = $1
        ORDER BY i.created_at DESC
      `, [activeUserId]),
    ])

    // Deliberately no user id: the client identifies the other party by
    // profileId, and exposing account ids here leaked them to anyone who
    // exchanged an interest.
    const mapRow = r => ({
      id: r.id,
      profileId: r.profile_id,
      name: r.name,
      status: r.status,
      createdAt: r.created_at,
    })

    const result = { success: true, data: { sent: sentRows.map(mapRow), received: receivedRows.map(mapRow) } }
    cacheSet(cacheKey, result, 10000)
    response.json(result)
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.put('/api/matrimony/interests/:id', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { accept } = request.body || {}
  const { id } = request.params

  const newStatus = accept ? 'accepted' : 'declined'
  const now = new Date().toISOString()

  try {
    // Filtering on receiver_id keeps the ownership check: only the recipient of
    // an interest may respond to it. Doing it in the UPDATE rather than a
    // separate SELECT also makes a double-tap idempotent — the second request
    // matches no pending row and returns 404 instead of creating a second match.
    const updated = await pgQuery(
      `UPDATE matrimony_interests
       SET status = $1, updated_at = $2
       WHERE id = $3 AND receiver_id = $4 AND status = 'pending'
       RETURNING sender_id, receiver_id`,
      [newStatus, now, id, activeUserId]
    )

    const interest = updated[0]
    if (!interest) {
      response.status(404).json({ success: false, error: 'Interest not found or already processed' })
      return
    }

    if (accept) {
      await pgQuery(
        `INSERT INTO matrimony_matches (id, user1_id, user2_id, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user1_id, user2_id) DO NOTHING`,
        [crypto.randomUUID(), interest.sender_id, interest.receiver_id, now]
      )
    }

    cacheInvalidate(`interests:${activeUserId}`)
    cacheInvalidate(`interests:${interest.sender_id}`)

    response.json({ success: true, data: { status: newStatus } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

// Matches & Messaging APIs
app.get('/api/matrimony/matches', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const cacheKey = `matches:${activeUserId}`
  const cached = cacheGet(cacheKey)
  if (cached) { response.set('X-Cache', 'HIT'); response.json(cached); return }
  response.set('X-Cache', 'MISS')

  try {
    const matches = await pgQuery(`
      SELECT
        m.id,
        CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END as otheruserid,
        p.id as profileid,
        u.full_name as name,
        COALESCE(last_msg.created_at, m.created_at) as lastmessagetime,
        COALESCE(last_msg.content, '') as lastmessage,
        COALESCE(unread.cnt, 0) as unreadcount
      FROM matrimony_matches m
      JOIN matrimony_profiles p ON p.user_id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
      JOIN users u ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT content, created_at FROM matrimony_messages
        WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as cnt FROM matrimony_messages
        WHERE match_id = m.id AND sender_id != $1 AND is_read::integer = 0
      ) unread ON true
      WHERE m.user1_id = $1 OR m.user2_id = $1
      ORDER BY COALESCE(last_msg.created_at, m.created_at) DESC
    `, [activeUserId])
    const result = { success: true, data: matches.map(r => ({
      id: r.id,
      profileId: r.profileid,
      name: r.name,
      lastMessage: r.lastmessage || '',
      lastMessageTime: r.lastmessagetime,
      unreadCount: Number(r.unreadcount || 0),
    })) }
    cacheSet(cacheKey, result, 10000)
    response.json(result)
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/matrimony/matches/:id/messages', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { id: matchId } = request.params
  const cacheKey = `messages:${matchId}`
  const cached = cacheGet(cacheKey)
  if (cached) { response.json(cached); return }

  try {
    // Verify user is part of this match
    const [match] = await pgQuery(
      'SELECT id FROM matrimony_matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, activeUserId]
    )
    if (!match) {
      response.status(404).json({ success: false, error: 'Match not found' })
      return
    }

    const messages = await pgQuery(`
      SELECT id, sender_id as senderId, content, created_at as createdAt, is_read as isRead
      FROM matrimony_messages
      WHERE match_id = $1
      ORDER BY created_at ASC
    `, [matchId])

    // Mark messages as read (fire and forget)
    pgQuery(
      'UPDATE matrimony_messages SET is_read = 1 WHERE match_id = $1 AND sender_id != $2',
      [matchId, activeUserId]
    ).catch(() => {})

    const result = { success: true, data: messages.map(r => ({
      id: r.id,
      senderId: r.senderid,
      content: r.content,
      createdAt: r.createdat,
      isRead: r.isread,
    })) }
    cacheSet(cacheKey, result, 3000)
    response.json(result)
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/matrimony/matches/:id/messages', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { id: matchId } = request.params
  const { content } = request.body || {}

  if (!content || !content.trim()) {
    response.status(400).json({ success: false, error: 'Message content required' })
    return
  }

  try {
    const [match] = await pgQuery(
      'SELECT id FROM matrimony_matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, activeUserId]
    )
    if (!match) {
      response.status(404).json({ success: false, error: 'Match not found' })
      return
    }

    const messageId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    await pgQuery(
      'INSERT INTO matrimony_messages (id, match_id, sender_id, content, created_at, is_read) VALUES ($1, $2, $3, $4, $5, 0)',
      [messageId, matchId, activeUserId, content.trim(), createdAt]
    )

    // Invalidate caches so next fetch is fresh
    cacheInvalidate(`messages:${matchId}`)
    cacheInvalidate(`matches:${activeUserId}`)
    response.json({ success: true, data: { id: messageId, createdAt } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/matrimony/saved-filters', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const fastData = await getSavedFiltersByUserIdFast(activeUserId)
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({ success: true, data: getSavedFiltersByUserId(activeUserId) })
})

app.get('/api/matrimony/me', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  let payload = null
  try {
    payload = await getCurrentMemberPayloadFast(activeUserId)
  } catch {
    payload = null
  }

  if (!payload) {
    payload = getCurrentMemberPayload(activeUserId)
  }

  if (!payload) {
    response.status(404).json({ success: false, error: 'Current profile not found' })
    return
  }

  response.json({ success: true, data: payload })
})

app.get('/api/events/summary', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const fastData = await getOwnedEventSummaryFast(activeUserId)
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch (err) {
    // The legacy path runs spawnSync and blocks the worker, so a silent fall
    // through here turns a transient database blip into a latency cliff with
    // nothing in the logs to explain it.
    console.warn('[fallback] fast query failed, using blocking legacy path:', err.message)
  }

  response.json({ success: true, data: getOwnedEventSummary(activeUserId) })
})

app.get('/api/events', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { tab } = request.query
  let events = null
  try {
    events = await getOwnedEventsFast(activeUserId)
  } catch {
    events = null
  }

  const sourceEvents = events || getOwnedEvents(activeUserId)

  const filtered = sourceEvents.filter((event) => {
    const eventDate = new Date(event.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isPast = eventDate.getTime() < today.getTime() || event.status === 'completed' || event.status === 'cancelled'
    const isPending = event.moneyCollected < event.moneyExpected
    const isFullyCollected = event.moneyExpected > 0 && event.moneyCollected >= event.moneyExpected

    if (tab === 'upcoming') return !isPast && event.status !== 'cancelled'
    if (tab === 'past') return isPast
    if (tab === 'pending') return isPending
    if (tab === 'fully_collected') return isFullyCollected
    return true
  })

  response.json({ success: true, data: filtered })
})

app.get('/api/events/:id', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  let event = null
  try {
    event = await getOwnedEventByIdFast(activeUserId, request.params.id)
  } catch {
    event = null
  }

  if (!event) {
    event = getOwnedEventById(activeUserId, request.params.id)
  }

  if (!event) {
    response.status(404).json({ success: false, error: 'Event not found' })
    return
  }

  let guests = null
  try {
    guests = await getOwnedEventGuestsFast(activeUserId, request.params.id)
  } catch {
    guests = null
  }

  const safeGuests = guests || getOwnedEventGuests(activeUserId, request.params.id) || []
  response.json({ success: true, data: { event, guests: safeGuests } })
})

app.get('/api/events/:id/guests', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  let guests = null
  try {
    guests = await getOwnedEventGuestsFast(activeUserId, request.params.id)
  } catch {
    guests = null
  }

  const resolvedGuests = guests || getOwnedEventGuests(activeUserId, request.params.id)
  if (!resolvedGuests) {
    response.status(404).json({ success: false, error: 'Event not found' })
    return
  }

  response.json({ success: true, data: resolvedGuests })
})

app.post('/api/events', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const result = createCommunityEvent(activeUserId, request.body || {})
  if (!result) {
    response.status(400).json({ success: false, error: 'Unable to create event' })
    return
  }

  response.status(201).json({ success: true, data: result })
})

app.post('/api/events/:id/guests', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const result = addCommunityEventGuest(activeUserId, request.params.id, request.body || {})
  if (!result) {
    response.status(404).json({ success: false, error: 'Event not found' })
    return
  }

  response.status(201).json({ success: true, data: result })
})

app.post('/api/events/:id/contributions', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const body = request.body || {}
  const rawGuestName = body.guestName ?? body.guest ?? body.name ?? ''
  const rawAmount = body.amount ?? body.amountReceived ?? body.amount_received ?? body.contributionAmount ?? ''
  const rawDate = body.date ?? body.contributionDate ?? body.contribution_date ?? ''
  const rawPaymentMode = body.paymentMode ?? body.payment_mode ?? body.mode ?? ''
  const notes = body.notes ?? ''

  const normalizedGuestName = String(rawGuestName).trim()
  const normalizedDate = String(rawDate).trim()
  const normalizedPaymentMode = String(rawPaymentMode).trim().toLowerCase()
  const normalizedAmountText = String(rawAmount).replace(/,/g, '').trim()
  const numericAmount = Number(normalizedAmountText)

  const missingFields = []
  if (!normalizedGuestName) missingFields.push('guest name')
  if (!normalizedDate) missingFields.push('date')
  if (!normalizedPaymentMode) missingFields.push('payment mode')
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) missingFields.push('positive amount')

  if (missingFields.length > 0) {
    response.status(400).json({
      success: false,
      error: `Missing or invalid fields: ${missingFields.join(', ')}`,
      missingFields,
    })
    return
  }

  const result = recordCommunityEventContribution(
    activeUserId,
    request.params.id,
    normalizedGuestName,
    numericAmount,
    normalizedDate,
    normalizedPaymentMode,
    notes ? String(notes) : ''
  )

  if (!result) {
    response.status(404).json({ success: false, error: 'Event or guest not found' })
    return
  }

  response.status(201).json({ success: true, data: result })
})

app.put('/api/events/guests/:guestId/rsvp', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { rsvpStatus } = request.body || {}
  if (!rsvpStatus) {
    response.status(400).json({ success: false, error: 'RSVP status is required' })
    return
  }

  const result = updateOwnedEventGuestRSVP(activeUserId, request.params.guestId, String(rsvpStatus))
  if (!result) {
    response.status(404).json({ success: false, error: 'Guest not found' })
    return
  }

  response.json({ success: true, data: result })
})

app.put('/api/matrimony/me', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { user = {}, profile = {}, matrimony = {} } = request.body || {}
  const now = new Date().toISOString()

  // Debug: log what photos look like
  let photosDebug = 'undefined'
  try {
    photosDebug = JSON.stringify(profile.photos).slice(0, 200)
  } catch {}
  console.log('[update profile] photos received:', typeof profile.photos, photosDebug)

  // Clean photos array - ensure it's valid JSON for JSONB column
  let photosForDb = null
  if (profile.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
    try {
      // Only keep necessary fields - pass as object for JSONB
      photosForDb = profile.photos.map(p => ({
        id: p.id || String(Math.random()).slice(2),
        uri: p.uri || p.url || '',
        url: p.url || p.uri || '',
        status: p.status || 'done',
        isPrimary: Boolean(p.isPrimary),
        uploadedAt: p.uploadedAt || new Date().toISOString()
      }))
      console.log('[update profile] photos cleaned:', photosForDb.length, 'photos')
    } catch (e) {
      console.error('[update profile] photos cleaning error:', e.message)
      photosForDb = null
    }
  }

  try {
    // Update users table
    if (user.fullName || user.phone) {
      await pgQuery(
        'UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), updated_at = $3 WHERE id = $4',
        [user.fullName || null, user.phone || null, now, activeUserId]
      )
    }

    // Debug: Log what we're sending for photos
    console.log('[update profile] photosForDb type:', typeof photosForDb, Array.isArray(photosForDb), JSON.stringify(photosForDb).slice(0, 100))

    // Convert photos array to JSON string for ::jsonb cast
    const photosJson = photosForDb ? JSON.stringify(photosForDb) : null

    // Update matrimony_profiles
    const queryParams = [
      profile.location || null,
      profile.occupation || null,
      profile.education || null,
      profile.bio || null,
      profile.gender || null,
      profile.dateOfBirth || null,
      matrimony.maritalStatus || null,
      matrimony.height || null,
      matrimony.income || null,
      matrimony.community || null,
      matrimony.language || null,
      matrimony.subCommunity || null,
      matrimony.familyStatus || null,
      matrimony.familyType || null,
      matrimony.familyWealth || null,
      matrimony.fatherName || null,
      matrimony.motherName || null,
      matrimony.fatherOccupation || null,
      matrimony.motherOccupation || null,
      matrimony.siblings || null,
      profile.nativeCity || null,
      profile.nativeVillage || null,
      photosJson,  // Now a JSON string with ::jsonb cast
      matrimony.eatingHabit || null,
      matrimony.horoscopeTime || null,
      matrimony.horoscopePlace || null,
      matrimony.nakshatra || null,
      matrimony.raasi || null,
      matrimony.employmentType || null,
      matrimony.incomeCurrency || null,
      matrimony.annualIncome || null,
      matrimony.motherTongue || null,
      matrimony.subcaste || null,
      Array.isArray(matrimony.hobbies) ? JSON.stringify(matrimony.hobbies) : null,
      Array.isArray(matrimony.music) ? JSON.stringify(matrimony.music) : null,
      Array.isArray(matrimony.sports) ? JSON.stringify(matrimony.sports) : null,
      Array.isArray(matrimony.cuisine) ? JSON.stringify(matrimony.cuisine) : null,
      now,
      activeUserId,
    ]
    console.log('[update profile] Query param 23 (photos):', typeof queryParams[22], queryParams[22]?.slice(0, 100))

    try {
      await pgQuery(
        `UPDATE matrimony_profiles SET
          location = COALESCE($1, location),
          occupation = COALESCE($2, occupation),
          education = COALESCE($3, education),
          bio = COALESCE($4, bio),
          gender = COALESCE($5, gender),
          date_of_birth = COALESCE($6, date_of_birth),
          marital_status = COALESCE($7, marital_status),
          height = COALESCE($8, height),
          income = COALESCE($9, income),
          community = COALESCE($10, community),
          language = COALESCE($11, language),
          sub_community = COALESCE($12, sub_community),
          family_status = COALESCE($13, family_status),
          family_type = COALESCE($14, family_type),
          family_wealth = COALESCE($15, family_wealth),
          father_name = COALESCE($16, father_name),
          mother_name = COALESCE($17, mother_name),
          father_occupation = COALESCE($18, father_occupation),
          mother_occupation = COALESCE($19, mother_occupation),
          siblings = COALESCE($20, siblings),
          native_city = COALESCE($21, native_city),
          native_village = COALESCE($22, native_village),
          photos = COALESCE($23::jsonb, photos),
          eating_habit = COALESCE($24, eating_habit),
          horoscope_time = COALESCE($25, horoscope_time),
          horoscope_place = COALESCE($26, horoscope_place),
          nakshatra = COALESCE($27, nakshatra),
          raasi = COALESCE($28, raasi),
          employment_type = COALESCE($29, employment_type),
          income_currency = COALESCE($30, income_currency),
          annual_income = COALESCE($31, annual_income),
          mother_tongue = COALESCE($32, mother_tongue),
          subcaste = COALESCE($33, subcaste),
          hobbies = COALESCE($34::jsonb, hobbies),
          music = COALESCE($35::jsonb, music),
          sports = COALESCE($36::jsonb, sports),
          cuisine = COALESCE($37::jsonb, cuisine),
          updated_at = $38
         WHERE user_id = $39`,
        queryParams
      )
    } catch (dbErr) {
      console.error('[update profile] DB Error:', dbErr.message, '| Photos param:', JSON.stringify(photosForDb))
      throw dbErr
    }

    // Invalidate cache so next fetch is fresh
    cacheInvalidate(`memberPayload:${activeUserId}`)

    // Return fresh payload
    let updated = null
    try { updated = await getCurrentMemberPayloadFast(activeUserId) } catch (e) {
      console.error('[update profile] Fast query failed:', e.message)
    }
    if (!updated) {
      console.log('[update profile] Falling back to regular getCurrentMemberPayload')
      updated = getCurrentMemberPayload(activeUserId)
    }

    if (!updated) {
      response.status(404).json({ success: false, error: 'Profile not found after update' })
      return
    }
    
    // Debug: Log what we're returning
    console.log('[update profile] Returning profile.photos:', updated?.profile?.photos?.length || 0, 'photos')
    console.log('[update profile] Returning matrimony.photos:', updated?.matrimony?.photos?.length || 0, 'photos')
    
    response.json({ success: true, data: updated })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

// Photo upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
const STORAGE_BUCKET = 'profile-photos'

// Supabase Storage is only usable when both the project URL and a key are set.
// Without them we fall back to local disk so photo upload works in development.
const useSupabaseStorage = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY)
const localUploadDir = path.resolve('server', 'uploads')

if (!useSupabaseStorage) {
  fs.mkdirSync(localUploadDir, { recursive: true })
  console.log('[upload] Supabase Storage not configured; storing photos on local disk at server/uploads')
}

// Serve locally stored photos. Harmless when Supabase is configured (dir is empty).
app.use('/uploads', express.static(localUploadDir, { maxAge: '7d' }))

/*
 * Privacy policy.
 *
 * Google Play requires a publicly reachable privacy policy URL for any app
 * that offers subscriptions, and the reviewer fetches it anonymously. It
 * therefore sits outside /api, with no session check — everything under /api
 * now requires a token.
 *
 * Served from this server rather than a separate host so the URL stays stable
 * and costs nothing: the repository is private, so GitHub Pages would need a
 * paid plan.
 */
const legalDir = path.join(path.resolve('server'), 'legal')

/*
 * Public landing page.
 *
 * BillDesk's cross-border KYC asks for a business website, and an API origin
 * that answers 404 at the root is not one. It also gives the app a public
 * page to point at from the Play listing.
 */
app.get('/', (_request, response) => {
  response.sendFile(path.join(legalDir, 'index.html'), (error) => {
    if (error) {
      console.error('[legal] could not serve the landing page:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Temporarily unavailable.')
      }
    }
  })
})

app.get(['/privacy-policy', '/privacy'], (_request, response) => {
  response.sendFile(path.join(legalDir, 'privacy-policy.html'), (error) => {
    if (error) {
      console.error('[legal] could not serve the privacy policy:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Privacy policy is temporarily unavailable.')
      }
    }
  })
})

/**
 * Auth headers for the Supabase Storage REST API.
 *
 * Supabase has two key formats. Legacy service_role keys are JWTs and go in
 * Authorization: Bearer. Newer keys (sb_secret_...) are not JWTs — sending one
 * as a Bearer token fails with "Invalid Compact JWS" — and must go in apikey.
 * Sending apikey always, and Bearer only for a JWT, supports both.
 */
function supabaseStorageHeaders(extra = {}) {
  const headers = { apikey: SUPABASE_SERVICE_KEY, ...extra }
  if (SUPABASE_SERVICE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_SERVICE_KEY}`
  }
  return headers
}

/** Absolute base URL for this request, so returned photo URLs work from a phone. */
function publicBaseUrl(request) {
  const configured = String(process.env.PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '')
  if (configured) return configured.replace(/\/api$/, '')
  return `${request.protocol}://${request.get('host')}`
}

app.post('/api/upload/photo', uploadLimiter, upload.single('photo'), async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  if (!request.file) {
    response.status(400).json({ success: false, error: 'No file uploaded' })
    return
  }
  if (!String(request.file.mimetype || '').startsWith('image/')) {
    response.status(400).json({ success: false, error: 'Only image files are allowed' })
    return
  }

  try {
    const ext = request.file.mimetype === 'image/png' ? 'png' : 'jpg'
    const fileName = `${activeUserId}/${crypto.randomUUID()}.${ext}`

    if (!useSupabaseStorage) {
      const destination = path.join(localUploadDir, fileName)
      await fs.promises.mkdir(path.dirname(destination), { recursive: true })
      await fs.promises.writeFile(destination, request.file.buffer)
      response.json({ success: true, data: { url: `${publicBaseUrl(request)}/uploads/${fileName}` } })
      return
    }

    const storageUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`
    const uploadRes = await fetch(storageUrl, {
      method: 'POST',
      headers: supabaseStorageHeaders({
        'Content-Type': request.file.mimetype,
        'x-upsert': 'false',
      }),
      body: request.file.buffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`Storage upload failed: ${err}`)
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`
    response.json({ success: true, data: { url: publicUrl } })
  } catch (err) {
    console.error('[upload] photo upload failed:', err.message)
    response.status(500).json({ success: false, error: err.message })
  }
})

app.delete('/api/upload/photo', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  const { url } = request.body || {}
  if (!url) {
    response.status(400).json({ success: false, error: 'No URL provided' })
    return
  }

  try {
    // Extract the stored path, which is "<userId>/<uuid>.<ext>" under either backend.
    const marker = useSupabaseStorage ? `/object/public/${STORAGE_BUCKET}/` : '/uploads/'
    const idx = url.indexOf(marker)
    if (idx === -1) throw new Error('Invalid photo URL')
    const filePath = url.slice(idx + marker.length)

    // Only allow deleting own photos
    if (!filePath.startsWith(activeUserId + '/')) {
      response.status(403).json({ success: false, error: 'Forbidden' })
      return
    }

    if (!useSupabaseStorage) {
      // Resolve and confirm the path stays inside the upload dir before unlinking.
      const target = path.resolve(localUploadDir, filePath)
      if (!target.startsWith(localUploadDir + path.sep)) {
        response.status(400).json({ success: false, error: 'Invalid photo path' })
        return
      }
      await fs.promises.rm(target, { force: true })
      response.json({ success: true })
      return
    }

    const deleteRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`, {
      method: 'DELETE',
      headers: supabaseStorageHeaders(),
    })

    if (!deleteRes.ok && deleteRes.status !== 404) {
      throw new Error(`Delete failed: ${await deleteRes.text()}`)
    }
    response.json({ success: true })
  } catch (err) {
    console.error('[upload] photo delete failed:', err.message)
    response.status(500).json({ success: false, error: err.message })
  }
})

/* ------------------------------------------------------------------ */
/* Razorpay                                                            */
/* ------------------------------------------------------------------ */

/*
 * Credentials come from the environment only.
 *
 * These were previously inlined as `process.env.X || '<literal key>'` in five
 * places, which meant a deploy that forgot the variables transacted against a
 * committed key instead of failing. One of those fallbacks was a different
 * string again ('placeholder_secret'), so with the environment unset the two
 * signature-verification paths would have used different secrets from the one
 * that signed the request.
 *
 * Without credentials the payment routes report 503 rather than the process
 * refusing to start: payments are one feature, and local development of
 * everything else should not require a Razorpay account.
 */
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ''
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ''
const isRazorpayConfigured = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)

if (!isRazorpayConfigured) {
  console.warn('[payments] RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set — payment routes will return 503')
}

const razorpay = isRazorpayConfigured
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null

const RAZORPAY_BASIC_AUTH =
  'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')

/** Guards every payment route so an unconfigured deploy fails loudly, not silently. */
function requirePayments(request, response, next) {
  if (!isRazorpayConfigured) {
    response.status(503).json({ success: false, error: 'Payments are temporarily unavailable.' })
    return
  }
  next()
}

// Create order
app.post('/api/payments/create-order', requirePayments, async (request, response) => {
  try {
    const activeUserId = resolveUserId(request)
    if (!activeUserId) {
      response.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    const { plan, amount } = request.body
    
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `r_${activeUserId.slice(0, 8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: activeUserId,
        plan: plan || 'basic'
      }
    }

    const order = await razorpay.orders.create(options)
    response.json({ success: true, data: order })
  } catch (err) {
    console.error('[razorpay] Create order error:', err)
    response.status(500).json({ success: false, error: err.message })
  }
})

// Verify payment
app.post('/api/payments/verify', requirePayments, async (request, response) => {
  try {
    const activeUserId = resolveUserId(request)
    if (!activeUserId) {
      response.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, amount } = request.body

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      response.status(400).json({ success: false, error: 'Invalid signature' })
      return
    }

    // Calculate expiry date based on plan
    const now = new Date()
    const expiryDate = new Date(now)
    if (plan === 'basic') {
      expiryDate.setDate(now.getDate() + 7) // 7 days
    } else {
      expiryDate.setDate(now.getDate() + 30) // 30 days
    }

    // Store subscription in database
    await pgQuery(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = $2,
         amount = $3,
         payment_id = $4,
         order_id = $5,
         status = 'active',
         started_at = $6,
         expires_at = $7`,
      [activeUserId, plan, amount, razorpay_payment_id, razorpay_order_id, now.toISOString(), expiryDate.toISOString()]
    )

    response.json({ success: true, data: { verified: true, plan, expiresAt: expiryDate.toISOString() } })
  } catch (err) {
    console.error('[razorpay] Verify error:', err)
    response.status(500).json({ success: false, error: err.message })
  }
})

// Get subscription status
app.get('/api/payments/subscription', async (request, response) => {
  try {
    const activeUserId = resolveUserId(request)
    if (!activeUserId) {
      response.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    let result
    try {
      result = await pgQuery(
        `SELECT id, user_id, plan, status, started_at, expires_at, created_at
         FROM user_subscriptions WHERE user_id = $1 AND status = 'active' AND expires_at::timestamp > NOW()
         ORDER BY expires_at::timestamp DESC LIMIT 1`,
        [activeUserId]
      )
    } catch (queryErr) {
      console.error('[razorpay] Subscription query error:', queryErr.message)
      response.json({ success: true, data: { hasSubscription: false } })
      return
    }

    if (!result || result.length === 0) {
      response.json({ success: true, data: { hasSubscription: false } })
      return
    }

    const sub = result[0]
    response.json({
      success: true,
      data: {
        hasSubscription: true,
        plan: sub.plan,
        amount: sub.amount,
        startedAt: sub.started_at,
        expiresAt: sub.expires_at
      }
    })
  } catch (err) {
    console.error('[razorpay] Get subscription error:', err)
    response.status(500).json({ success: false, error: err.message })
  }
})

// Razorpay Webhook - fires server-side when payment is completed (works even without deep link)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
    if (webhookSecret) {
      const signature = request.headers['x-razorpay-signature']
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(request.body)
        .digest('hex')
      if (expectedSig !== signature) {
        response.status(400).json({ success: false, error: 'Invalid webhook signature' })
        return
      }
    }

    const event = JSON.parse(request.body.toString())
    if (event.event !== 'payment_link.paid') {
      response.json({ success: true }) // ignore other events
      return
    }

    const paymentLink = event.payload?.payment_link?.entity
    const payment = event.payload?.payment?.entity
    if (!paymentLink || !payment) {
      response.json({ success: true })
      return
    }

    const userId = paymentLink.notes?.userId
    const plan = paymentLink.notes?.plan || 'premium'
    const amount = (payment.amount || 0) / 100

    if (!userId) {
      response.json({ success: true })
      return
    }

    const now = new Date()
    const expiryDate = new Date(now)
    expiryDate.setDate(now.getDate() + (plan === 'basic' ? 7 : 30))

    await pgQuery(
      `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = $2, amount = $3, payment_id = $4, order_id = $5,
         status = 'active', started_at = $6, expires_at = $7`,
      [userId, plan, amount, payment.id, paymentLink.id, now.toISOString(), expiryDate.toISOString()]
    )
    console.log(`[webhook] Subscription activated for user ${userId}, plan=${plan}, expires=${expiryDate.toISOString()}`)
    response.json({ success: true })
  } catch (err) {
    console.error('[webhook] Error:', err.message)
    response.status(500).json({ success: false, error: err.message })
  }
})

// Verify Razorpay Payment Link (called by app after returning from Razorpay)
const RAZORPAY_AUTH_HEADER =
  'Basic ' +
  Buffer.from(
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
  ).toString('base64')

function planDurationDays(plan) {
  return plan === 'basic' ? 7 : 30
}

/**
 * Idempotently mark a subscription active. Safe to call repeatedly for the same
 * payment: the row is keyed on user_id, so a repeat call just refreshes it.
 */
async function activateSubscription({ userId, plan, amount, paymentId, orderId }) {
  const normalizedPlan = plan === 'basic' ? 'basic' : 'premium'
  const now = new Date()
  const expiryDate = new Date(now)
  expiryDate.setDate(now.getDate() + planDurationDays(normalizedPlan))

  await pgQuery(
    `INSERT INTO user_subscriptions (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       plan = $2,
       amount = $3,
       payment_id = $4,
       order_id = $5,
       status = 'active',
       started_at = $6,
       expires_at = $7`,
    [userId, normalizedPlan, amount, paymentId, orderId, now.toISOString(), expiryDate.toISOString()]
  )

  return { plan: normalizedPlan, startedAt: now.toISOString(), expiresAt: expiryDate.toISOString() }
}

/**
 * Authoritative poll used by the app after it opens a payment link.
 *
 * Asks Razorpay directly whether the link is paid, so activation does not depend
 * on a webhook reaching us (webhooks cannot reach localhost) or on the deep link
 * firing. The link's `notes.userId` must match the caller, so one user cannot
 * activate a subscription from someone else's payment link.
 */
app.get('/api/payments/link-status/:linkId', requirePayments, async (request, response) => {
  try {
    const activeUserId = resolveUserId(request)
    if (!activeUserId) {
      response.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    const linkId = String(request.params.linkId || '').trim()
    if (!linkId) {
      response.status(400).json({ success: false, error: 'Payment link id is required' })
      return
    }

    const rzpResponse = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(linkId)}`, {
      headers: { Authorization: RAZORPAY_AUTH_HEADER },
    })
    const link = await rzpResponse.json()

    if (!rzpResponse.ok) {
      response.status(502).json({ success: false, error: link.error?.description || 'Could not read payment link' })
      return
    }

    if (link.notes?.userId && link.notes.userId !== activeUserId) {
      response.status(403).json({ success: false, error: 'This payment link belongs to another account' })
      return
    }

    if (link.status !== 'paid') {
      response.json({ success: true, data: { status: link.status, activated: false } })
      return
    }

    const activated = await activateSubscription({
      userId: activeUserId,
      plan: link.notes?.plan || 'premium',
      amount: Math.round(Number(link.amount_paid || link.amount || 0) / 100),
      paymentId: link.id,
      orderId: link.id,
    })

    response.json({ success: true, data: { status: 'paid', activated: true, ...activated } })
  } catch (err) {
    console.error('[razorpay] link-status error:', err.message)
    response.status(500).json({ success: false, error: err.message })
  }
})

/**
 * Razorpay redirects here after checkout; bounce the params into the app's deep
 * link so the client can verify without the user having to come back manually.
 */
app.get('/api/payments/return', (request, response) => {
  const query = new URLSearchParams(request.query).toString()
  response.redirect(302, `chaudharysamaj://payment/razorpay${query ? `?${query}` : ''}`)
})

app.post('/api/payments/verify-link', requirePayments, async (request, response) => {
  try {
    const activeUserId = resolveUserId(request)
    if (!activeUserId) {
      response.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature,
      plan,
      amount,
    } = request.body

    if (!razorpay_payment_id || !razorpay_payment_link_id || !razorpay_signature) {
      response.status(400).json({ success: false, error: 'Missing payment params' })
      return
    }

    // Verify signature: payload = payment_link_id|payment_link_reference_id|payment_link_status|payment_id
    const payload = `${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`
    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex')

    const providedSig = Buffer.from(String(razorpay_signature))
    const computedSig = Buffer.from(expectedSig)
    const signatureValid =
      providedSig.length === computedSig.length && crypto.timingSafeEqual(providedSig, computedSig)

    if (!signatureValid) {
      console.warn('[razorpay] verify-link rejected: bad signature for', razorpay_payment_link_id)
      response.status(400).json({ success: false, error: 'Invalid payment signature' })
      return
    }

    if (razorpay_payment_link_status !== 'paid') {
      response.status(400).json({ success: false, error: 'Payment link is not paid' })
      return
    }

    const activated = await activateSubscription({
      userId: activeUserId,
      plan,
      amount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_payment_link_id,
    })

    response.json({ success: true, data: { verified: true, ...activated } })
  } catch (err) {
    console.error('[razorpay] verify-link error:', err.message)
    response.status(500).json({ success: false, error: err.message })
  }
})

// Create Razorpay Payment Link
/* ------------------------------------------------------------------ */
/* Google Play billing                                                  */
/* ------------------------------------------------------------------ */

/**
 * Grant a subscription from a Play purchase token.
 *
 * The client sends only the token. Everything that decides entitlement —
 * product, expiry, whether it is actually active — comes from Google, never
 * from the request body, so a forged call grants nothing.
 */
app.post('/api/payments/play/verify', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  if (!isPlayBillingConfigured()) {
    response.status(503).json({ success: false, error: 'Play billing is not configured.' })
    return
  }

  const purchaseToken = String(request.body?.purchaseToken || '').trim()
  if (!purchaseToken) {
    response.status(400).json({ success: false, error: 'purchaseToken is required' })
    return
  }

  try {
    const purchase = await getSubscriptionFromPlay(purchaseToken)

    if (!purchase.valid) {
      response.status(400).json({ success: false, error: 'This purchase could not be verified.' })
      return
    }

    // A token already bound to another account means someone is replaying a
    // purchase. The unique index would catch it, but answering here keeps the
    // reason clear instead of surfacing a constraint violation.
    const existing = await pgQuery(
      'SELECT user_id FROM user_subscriptions WHERE play_purchase_token = $1 LIMIT 1',
      [purchaseToken]
    )
    if (existing[0] && existing[0].user_id !== activeUserId) {
      response.status(409).json({ success: false, error: 'This purchase belongs to another account.' })
      return
    }

    if (!purchase.entitled) {
      response.json({
        success: true,
        data: { active: false, state: purchase.state },
      })
      return
    }

    const startedAt = new Date().toISOString()
    const expiresAt = purchase.expiryTime || new Date(Date.now() + 30 * 864e5).toISOString()

    await pgQuery(
      `INSERT INTO user_subscriptions
         (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at,
          play_purchase_token, play_product_id, provider)
       VALUES ($1, 'premium', 200, $2, $3, 'active', $4, $5, $6, $7, 'google_play')
       ON CONFLICT (user_id) DO UPDATE SET
         plan = 'premium',
         status = 'active',
         payment_id = $2,
         order_id = $3,
         started_at = $4,
         expires_at = $5,
         play_purchase_token = $6,
         play_product_id = $7,
         provider = 'google_play'`,
      [
        activeUserId,
        purchase.orderId || purchaseToken.slice(0, 40),
        purchase.orderId || purchaseToken.slice(0, 40),
        startedAt,
        expiresAt,
        purchaseToken,
        purchase.productId,
      ]
    )

    // Play refunds and revokes anything not acknowledged within three days, so
    // this has to happen once access is actually granted.
    if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && purchase.productId) {
      try {
        await acknowledgeSubscription(purchaseToken, purchase.productId)
      } catch (err) {
        // Worth shouting about: an unacknowledged purchase auto-refunds.
        console.error('[play] ACKNOWLEDGE FAILED — purchase may be auto-refunded:', err.message)
      }
    }

    response.json({
      success: true,
      data: { active: true, plan: 'premium', startedAt, expiresAt },
    })
  } catch (err) {
    console.error('[play] verify failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not verify the purchase.' })
  }
})

/**
 * Real-time Developer Notifications, delivered by Pub/Sub push.
 *
 * Without this a cancellation or failed renewal leaves the member with access
 * until our stored expiry passes, and a renewal is never recorded at all.
 * Google only tells us which token changed, so the state still comes from a
 * fresh lookup rather than from the notification body.
 */
app.post('/api/payments/play/rtdn', async (request, response) => {
  if (!isValidRtdnToken(request.query.token)) {
    response.status(403).json({ success: false, error: 'Forbidden' })
    return
  }

  // Acknowledge immediately: Pub/Sub retries anything it thinks failed, and a
  // slow handler turns one notification into many.
  response.status(204).end()

  try {
    const encoded = request.body?.message?.data
    if (!encoded) return

    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    const notification = payload.subscriptionNotification
    if (!notification?.purchaseToken) return

    const purchase = await getSubscriptionFromPlay(notification.purchaseToken)
    if (!purchase.valid) return

    await pgQuery(
      `UPDATE user_subscriptions
       SET status = $1, expires_at = COALESCE($2, expires_at)
       WHERE play_purchase_token = $3`,
      [purchase.entitled ? 'active' : 'expired', purchase.expiryTime, notification.purchaseToken]
    )
  } catch (err) {
    console.error('[play] rtdn handling failed:', err.message)
  }
})

app.post('/api/payments/create-link', requirePayments, async (request, response) => {
  try {
    const activeUserId = resolveUserId(request)
    if (!activeUserId) {
      response.status(401).json({ success: false, error: 'Authentication required' })
      return
    }

    const { plan } = request.body
    // Single plan: ₹200/month (premium). Reject anything else.
    const VALID_PLAN = 'premium'
    const PLAN_AMOUNT = 200
    if (plan !== VALID_PLAN) {
      response.status(400).json({ success: false, error: 'Invalid plan. Only monthly premium plan (₹200) is available.' })
      return
    }
    const amount = PLAN_AMOUNT

    // Create payment link via Razorpay API
    const linkData = {
      amount: amount * 100, // in paise
      currency: 'INR',
      accept_partial: false,
      description: 'Monthly Subscription - Chaudhary Samaj (₹200/month)',
      customer: {
        name: 'User',
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        userId: activeUserId,
        plan: plan,
      },
    }

    // When the API is publicly reachable, send the user back through /payments/return,
    // which bounces into the app deep link. On localhost this is skipped and the app
    // falls back to polling /payments/link-status, which is authoritative either way.
    const publicBaseUrl = String(process.env.PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '')
    if (publicBaseUrl && !/localhost|127\.0\.0\.1/.test(publicBaseUrl)) {
      linkData.callback_url = `${publicBaseUrl}/api/payments/return`
      linkData.callback_method = 'get'
    }

    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': RAZORPAY_BASIC_AUTH,
      },
      body: JSON.stringify(linkData),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[razorpay] Create link error:', data)
      response.status(500).json({ success: false, error: data.error?.description || 'Failed to create payment link' })
      return
    }

    response.json({ success: true, data: { id: data.id, short_url: data.short_url } })
  } catch (err) {
    console.error('[razorpay] Create link error:', err)
    response.status(500).json({ success: false, error: err.message })
  }
})

app.delete('/api/auth/account', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  try {
    await pgQuery('DELETE FROM matrimony_messages WHERE sender_id = $1', [activeUserId])
    await pgQuery('DELETE FROM matrimony_interests WHERE sender_id = $1 OR receiver_id = $1', [activeUserId])
    await pgQuery('DELETE FROM matrimony_matches WHERE user1_id = $1 OR user2_id = $1', [activeUserId])
    await pgQuery('DELETE FROM user_subscriptions WHERE user_id = $1', [activeUserId])
    await pgQuery('DELETE FROM user_settings WHERE user_id = $1', [activeUserId])
    await pgQuery('DELETE FROM matrimony_profiles WHERE user_id = $1', [activeUserId])
    await pgQuery('DELETE FROM auth_accounts WHERE user_id = $1', [activeUserId])
    await pgQuery('DELETE FROM users WHERE id = $1', [activeUserId])
    cacheInvalidate(`user:${activeUserId}`)
    cacheInvalidate(`memberPayload:${activeUserId}`)
    response.json({ success: true })
  } catch (err) {
    console.error('[delete account] error:', err.message)
    response.status(500).json({ success: false, error: 'Failed to delete account' })
  }
})

app.get('/api/settings', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  try {
    const result = await pgQuery(
      // The column list must match the table migrate.js actually creates.
      // This asked for notifications_json and privacy_json, which have never
      // existed, so every settings load failed with a 500 — while the handler
      // below already read the individual columns correctly.
      `SELECT user_id, language, timezone, public_profile,
              notif_community_announcements, notif_matrimony_matches,
              notif_event_reminders, notif_security_alerts, notif_marketing_updates,
              privacy_show_phone, privacy_show_location, privacy_searchable
       FROM user_settings WHERE user_id = $1`,
      [activeUserId]
    )
    if (result.length === 0) {
      // Return defaults if no settings saved yet
      response.json({
        success: true,
        data: {
          language: 'en-IN',
          timezone: 'Asia/Kolkata',
          publicProfile: true,
          notifications: {
            communityAnnouncements: true,
            matrimonyMatches: true,
            eventReminders: true,
            securityAlerts: true,
            marketingUpdates: false,
          },
          privacy: {
            showPhoneToConnections: false,
            showLocationPublicly: true,
            profileSearchable: true,
          },
        },
      })
      return
    }
    const row = result[0]
    response.json({
      success: true,
      data: {
        language: row.language,
        timezone: row.timezone,
        publicProfile: row.public_profile,
        notifications: {
          communityAnnouncements: row.notif_community_announcements,
          matrimonyMatches: row.notif_matrimony_matches,
          eventReminders: row.notif_event_reminders,
          securityAlerts: row.notif_security_alerts,
          marketingUpdates: row.notif_marketing_updates,
        },
        privacy: {
          showPhoneToConnections: row.privacy_show_phone,
          showLocationPublicly: row.privacy_show_location,
          profileSearchable: row.privacy_searchable,
        },
      },
    })
  } catch (err) {
    console.error('[settings] GET error:', err.message)
    response.status(500).json({ success: false, error: 'Failed to load settings' })
  }
})

app.put('/api/settings', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  const { language, timezone, publicProfile, notifications = {}, privacy = {} } = request.body || {}
  const now = new Date().toISOString()
  try {
    await pgQuery(
      `INSERT INTO user_settings (
        user_id, language, timezone, public_profile,
        notif_community_announcements, notif_matrimony_matches,
        notif_event_reminders, notif_security_alerts, notif_marketing_updates,
        privacy_show_phone, privacy_show_location, privacy_searchable,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (user_id) DO UPDATE SET
        language = COALESCE($2, user_settings.language),
        timezone = COALESCE($3, user_settings.timezone),
        public_profile = COALESCE($4, user_settings.public_profile),
        notif_community_announcements = COALESCE($5, user_settings.notif_community_announcements),
        notif_matrimony_matches = COALESCE($6, user_settings.notif_matrimony_matches),
        notif_event_reminders = COALESCE($7, user_settings.notif_event_reminders),
        notif_security_alerts = COALESCE($8, user_settings.notif_security_alerts),
        notif_marketing_updates = COALESCE($9, user_settings.notif_marketing_updates),
        privacy_show_phone = COALESCE($10, user_settings.privacy_show_phone),
        privacy_show_location = COALESCE($11, user_settings.privacy_show_location),
        privacy_searchable = COALESCE($12, user_settings.privacy_searchable),
        updated_at = $13`,
      [
        activeUserId,
        language ?? null,
        timezone ?? null,
        publicProfile ?? null,
        notifications.communityAnnouncements ?? null,
        notifications.matrimonyMatches ?? null,
        notifications.eventReminders ?? null,
        notifications.securityAlerts ?? null,
        notifications.marketingUpdates ?? null,
        privacy.showPhoneToConnections ?? null,
        privacy.showLocationPublicly ?? null,
        privacy.profileSearchable ?? null,
        now,
      ]
    )
    response.json({ success: true })
  } catch (err) {
    console.error('[settings] PUT error:', err.message)
    response.status(500).json({ success: false, error: 'Failed to save settings' })
  }
})

// Admin Dashboard APIs
app.get('/api/admin/stats', requireAdmin, async (request, response) => {
  try {
    // Get total users count
    const totalUsersResult = await pgQuery('SELECT COUNT(*)::int as count FROM users')
    const totalUsers = totalUsersResult[0]?.count || 0

    // Get users registered in last 7 days
    const recentUsersResult = await pgQuery(`
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE created_at::timestamp >= NOW() - INTERVAL '7 days'
    `)
    const recentUsers = recentUsersResult[0]?.count || 0

    // Get active premium subscriptions
    const activeSubscriptionsResult = await pgQuery(`
      SELECT COUNT(*)::int as count, SUM(amount)::int as totalRevenue
      FROM user_subscriptions 
      WHERE status = 'active' AND expires_at::timestamp > NOW()
    `)
    const activePremium = activeSubscriptionsResult[0]?.count || 0
    const totalRevenue = activeSubscriptionsResult[0]?.totalrevenue || 0

    // Get matrimony profiles count
    const profilesResult = await pgQuery('SELECT COUNT(*)::int as count FROM matrimony_profiles')
    const totalProfiles = profilesResult[0]?.count || 0

    // Get interests sent
    const interestsResult = await pgQuery('SELECT COUNT(*)::int as count FROM matrimony_interests')
    const totalInterests = interestsResult[0]?.count || 0

    response.json({
      success: true,
      data: {
        totalUsers,
        recentUsers,
        activePremium,
        totalRevenue,
        totalProfiles,
        totalInterests,
        conversionRate: totalUsers > 0 ? ((activePremium / totalUsers) * 100).toFixed(1) : '0'
      }
    })
  } catch (err) {
    console.error('[admin/stats] error:', err.message)
    response.status(500).json({ success: false, error: 'Failed to fetch stats' })
  }
})

app.get('/api/admin/users', requireAdmin, async (request, response) => {
  try {
    const { page = 1, limit = 20 } = request.query
    const offset = (Number(page) - 1) * Number(limit)

    const usersResult = await pgQuery(`
      SELECT 
        u.id, u.full_name, u.email, u.phone, u.created_at,
        p.age, p.gender, p.location, p.education, p.occupation,
        s.plan as subscription_plan, s.status as subscription_status, s.expires_at
      FROM users u
      LEFT JOIN matrimony_profiles p ON u.id = p.user_id
      LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [Number(limit), offset])

    const totalResult = await pgQuery('SELECT COUNT(*)::int as count FROM users')
    const total = totalResult[0]?.count || 0

    response.json({
      success: true,
      data: {
        users: usersResult,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    })
  } catch (err) {
    console.error('[admin/users] error:', err.message)
    response.status(500).json({ success: false, error: 'Failed to fetch users' })
  }
})

app.use((_request, response) => {
  response.status(404).json({ success: false, error: 'Route not found' })
})

/**
 * JSON error handler.
 *
 * Without this, anything thrown past a route — most easily a malformed JSON
 * body, which express.json() rejects before any handler runs — fell through to
 * Express's default handler. That returns an HTML page containing the stack
 * trace, which gives away absolute filesystem paths, the directory layout and
 * the dependency versions. It also meant an API client asking for JSON got
 * HTML back.
 *
 * The four-argument signature is required: Express identifies error handlers
 * by arity, so removing `next` silently turns this back into normal middleware.
 */
// eslint-disable-next-line no-unused-vars
app.use((error, request, response, next) => {
  const status = Number(error?.status || error?.statusCode || 500)

  if (status === 400 && error?.type === 'entity.parse.failed') {
    response.status(400).json({ success: false, error: 'Request body is not valid JSON' })
    return
  }

  if (status === 413 || error?.type === 'entity.too.large') {
    response.status(413).json({ success: false, error: 'Request body is too large' })
    return
  }

  console.error('[unhandled]', request.method, request.path, error?.message)
  response.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    error: status >= 400 && status < 500 ? 'Bad request' : 'Something went wrong',
  })
})

app.listen(port, () => {
  console.log(`Matrimony backend listening on http://localhost:${port}`)
  warmUpPool()
})
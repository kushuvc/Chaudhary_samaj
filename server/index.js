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
  describePlayBillingHealth,
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
  hashPassword,
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
import { AadhaarQrError, aadhaarFingerprint, compareWithProfile, verifyAadhaarQr } from './aadhaar-qr.js'
import {
  isExpoPushToken, registerPushToken, removePushToken, notifyUsers,
  notifyInBackground, pushInBackground, newBroadcastId,
  welcomeNewMember, pushWelcomeIfFirstDevice, startPlanExpiryReminders, sendPlanExpiryReminders,
  notifyProfileViewed, notificationCutoff, startNotificationPruning,
} from './push.js'
import { startKeepAlive } from './keep-alive.js'
import { runAdminAlerts, startAdminAlerts } from './admin-alerts.js'
import {
  handleInboundMail, listTickets, getTicket, replyToTicket, setTicketStatus,
  blockTicketSender, listBlockedSenders, unblockSender,
} from './support.js'
import { renderHelpPage } from './help-page.js'
import { suggestEmail } from './email-typo.js'
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
  invalidateFastCache,
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

/*
 * Trust exactly one proxy hop.
 *
 * Render terminates TLS at its edge and forwards, so every request arrives
 * from the same upstream address. Without this, express-rate-limit sees one
 * client for the whole community — it logged ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
 * on every request and could not tell members apart, so a single abuser would
 * have exhausted the limit for everyone.
 *
 * One hop, not `true`. With `true` Express believes the left-most entry of
 * X-Forwarded-For, which the client writes — anyone could set a fresh fake IP
 * per request and never hit a limit at all. Counting one hop in from the
 * socket takes the address Render itself observed, which a client cannot
 * forge. If a second proxy is ever put in front of this, raise the number to
 * match, or the limiter starts reading a spoofable value again.
 */
app.set('trust proxy', 1)

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
// Parsed support mail can carry a long HTML body; give that one route more room
// than the 2 MB everything else gets. The first parser to run wins.
app.use('/api/support/inbound', express.json({ limit: '10mb' }))
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
  // Configurable so the test suite, which creates many accounts in seconds,
  // is not throttled. Unset in production, where 30 is the security control.
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
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

/**
 * A misspelt provider ("gamil.com") passes the format check, but the code
 * goes nowhere and the member is stuck. Refused at signup with the likely
 * address; login and reset are left alone so an older account still works.
 */
function emailTypoError(email) {
  const suggestion = suggestEmail(email)
  return suggestion
    ? { success: false, code: 'EMAIL_TYPO', suggestion, error: `Please check your email address. Did you mean ${suggestion}?` }
    : null
}

const REMOVED_MEMBER_ERROR = {
  success: false,
  code: 'ACCOUNT_REMOVED',
  error: 'This account was removed for breaking the community rules. Write to support@chaudharysamaj.com if you think this is a mistake.',
}

/**
 * True if an admin removed a member with this email or phone. Without it a
 * removed member could sign straight up again with the same details.
 */
async function isRemovedMember({ email, phone } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10)
  if (!normalizedEmail && normalizedPhone.length !== 10) return false
  const rows = await pgQuery(
    `SELECT 1 FROM removed_members
      WHERE ($1 <> '' AND lower(email) = $1) OR ($2 <> '' AND phone = $2) LIMIT 1`,
    [normalizedEmail, normalizedPhone.length === 10 ? normalizedPhone : '']
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
      const typo = emailTypoError(email)
      if (typo) {
        response.status(400).json(typo)
        return
      }
      if (await isRemovedMember({ email, phone })) {
        response.status(403).json(REMOVED_MEMBER_ERROR)
        return
      }
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

    /*
     * The email must have passed the code check.
     *
     * The app asks for the emailed code before this, but checking the code and
     * creating the account were separate requests with nothing joining them —
     * so anything calling this route directly could register any address,
     * including one that does not exist, without a code at all.
     *
     * The proof is a correctly entered signup code for this address in the
     * last 24 hours. Recorded on the server rather than passed back by the
     * app, so the builds already installed keep working unchanged. A day is
     * long enough for someone to finish the signup steps later, and short
     * enough that an old verification is not a standing pass.
     */
    if (createAccount && !(await emailRecentlyVerifiedForSignup(email))) {
      response.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Please verify your email address with the code we sent before creating an account.',
      })
      return
    }

    const numericAgeInput = Number(age)
    /*
     * Refuse anyone under 18.
     *
     * The age was previously floored at 18 with Math.max, so a child's date of
     * birth was silently rewritten into an adult profile — an under-age signup
     * was laundered into a compliant-looking one rather than stopped. This is
     * a matrimonial service; nobody under 18 belongs on it.
     */
    if (dateOfBirth) {
      const born = new Date(dateOfBirth)
      if (Number.isNaN(born.getTime())) {
        response.status(400).json({ success: false, error: 'Please enter a valid date of birth' })
        return
      }

      const years = (Date.now() - born.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      if (years < 18) {
        console.warn('[signup] refused an under-18 registration')
        response.status(403).json({
          success: false,
          code: 'UNDER_AGE',
          error: 'You must be at least 18 years old to create an account.',
        })
        return
      }
      if (years > 120) {
        response.status(400).json({ success: false, error: 'Please check the date of birth' })
        return
      }
    }

    if (Number.isFinite(numericAgeInput) && numericAgeInput < 18) {
      response.status(403).json({
        success: false,
        code: 'UNDER_AGE',
        error: 'You must be at least 18 years old to create an account.',
      })
      return
    }

    const userId = crypto.randomUUID()
    const profileId = `profile-${crypto.randomUUID()}`
    const createdAt = new Date().toISOString()
    const safeStr = (v, fb = '') => v ? String(v).trim() || fb : fb
    const numericAge = Number(age)
    const calcAge = Number.isFinite(numericAge) && numericAge >= 18 && numericAge <= 100
      ? Math.round(numericAge)
      : dateOfBirth
        ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : 25
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(fullName).trim())}`

    // Only create account when createAccount flag is true
    if (createAccount) {
      try {
        await pgQuery(
          // Signup is refused above unless the address entered a code, so the
          // email is proved from the start.
          `INSERT INTO users (id, email, full_name, phone, avatar_url, created_at, updated_at, email_verified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6, $6)`,
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
          // Lowercased on the way in. Every read already lowercases to compare,
          // so a stray 'Male' was harmless — but only because each of those
          // call sites remembered to, and one that forgets would silently show
          // a member the wrong half of the directory.
          safeStr(gender, 'unspecified').toLowerCase(), // $5  gender
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
      welcomeNewMember(userId)
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
/** True if a signup code for this address was entered correctly in the last day. */
async function emailRecentlyVerifiedForSignup(email) {
  const rows = await pgQuery(
    `SELECT 1 FROM auth_email_otps
      WHERE lower(email) = lower($1)
        AND purpose = 'signup'
        AND verified_at IS NOT NULL
        AND verified_at::timestamptz > NOW() - INTERVAL '24 hours'
      LIMIT 1`,
    [String(email || '').trim()]
  )
  return rows.length > 0
}

async function verifyEmailOtpAsync(email, purpose, otpCode) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  const normalizedCode = String(otpCode || '').trim()

  if (!normalizedEmail || !normalizedCode || !['signup', 'login', 'reset'].includes(normalizedPurpose)) {
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
  // verified_at records that this was a correct code, which signup relies on.
  const verifiedAt = new Date().toISOString()
  await pgQuery('UPDATE auth_email_otps SET consumed_at = $1, verified_at = $1 WHERE id = $2', [
    verifiedAt,
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

/*
 * Forgot password.
 *
 * Reuses the email OTP machinery under its own purpose, so the throttle, the
 * attempt counter and the five-minute expiry all apply here too.
 *
 * The response is the same whether or not the address has an account. Saying
 * "no account with that email" would turn this endpoint into a way to test
 * which addresses are registered on a matrimony service, which is not
 * something to hand out.
 */
app.post('/api/auth/password/forgot', async (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase()
  const sameAnswer = {
    success: true,
    data: { message: 'If that email has an account, a reset code is on its way.' },
  }

  if (!email || !isValidEmail(email)) {
    response.status(400).json({ success: false, error: 'Please enter a valid email address' })
    return
  }

  try {
    const rows = await pgQuery('SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1', [email])
    if (rows.length === 0) {
      console.log(`[reset] no account for ${email}; answering as if sent`)
      response.json(sameAnswer)
      return
    }

    await (databaseEngine === 'postgres'
      ? invalidateActiveEmailOtpsFast(email, 'reset')
      : invalidateActiveEmailOtps(email, 'reset'))

    const otpRequest = databaseEngine === 'postgres'
      ? await requestEmailOtpFast(email, 'reset')
      : requestEmailOtp(email, 'reset')

    if (!otpRequest.ok || !otpRequest.data) {
      // Throttling is the usual cause, and that the caller should see.
      response
        .status(otpRequest.statusCode || 400)
        .json({ success: false, error: otpRequest.error || 'Unable to send a reset code' })
      return
    }

    const sendResult = await sendEmailOtp({
      to: email,
      otpCode: otpRequest.data.otpCode,
      purpose: 'reset',
      expiresInMinutes: 5,
    })

    if (sendResult.fallback && process.env.NODE_ENV === 'production') {
      console.error('[reset] mailer is not configured; refusing to issue a code')
      await (databaseEngine === 'postgres'
        ? invalidateActiveEmailOtpsFast(email, 'reset')
        : invalidateActiveEmailOtps(email, 'reset'))
      response.status(503).json({ success: false, error: 'Password reset is temporarily unavailable.' })
      return
    }

    response.json({
      ...sameAnswer,
      data: {
        ...sameAnswer.data,
        ...(process.env.NODE_ENV !== 'production' ? { debugOtp: otpRequest.data.otpCode } : {}),
      },
    })
  } catch (err) {
    console.error('[reset] request failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not start a password reset' })
  }
})

/** Completes the reset: the code proves the address, then the password changes. */
app.post('/api/auth/password/reset', async (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase()
  const otp = String(request.body?.otp || '').trim()
  const password = String(request.body?.password || '')

  if (!email || !otp || !password) {
    response.status(400).json({ success: false, error: 'Email, code and new password are required' })
    return
  }
  if (password.length < 8 || password.length > 20) {
    response.status(400).json({ success: false, error: 'Password must be between 8 and 20 characters' })
    return
  }

  try {
    const verified = await verifyEmailOtpAsync(email, 'reset', otp)
    if (!verified.ok) {
      response.status(verified.statusCode || 400).json({ success: false, error: verified.error })
      return
    }

    const rows = await pgQuery('SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1', [email])
    const user = rows[0]
    if (!user) {
      response.status(404).json({ success: false, error: 'Account not found for this email' })
      return
    }

    const now = new Date().toISOString()
    await pgQuery(
      `INSERT INTO auth_accounts (user_id, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (user_id) DO UPDATE SET password_hash = $2, updated_at = $3`,
      [user.id, hashPassword(password), now]
    )
    await markEmailVerified(user.id)

    console.log(`[reset] password changed for ${email}`)
    // A session here saves the member signing in again straight after.
    response.json({ success: true, data: { authToken: issueAuthToken(user.id) } })
  } catch (err) {
    console.error('[reset] failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not reset the password' })
  }
})

/**
 * Records that the account's holder just proved they read its inbox. Kept to
 * the first time: the badge says the address was checked, not when last.
 */
async function markEmailVerified(userId) {
  try {
    await pgQuery(
      'UPDATE users SET email_verified_at = $1 WHERE id = $2 AND email_verified_at IS NULL',
      [new Date().toISOString(), userId]
    )
    invalidateFastCache('publicProfiles')
  } catch (err) {
    console.error('[email-verified] could not record:', err.message)
  }
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
      if (!usingReviewAccount) await markEmailVerified(user.id)
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

  if (!['signup', 'login', 'reset'].includes(normalizedPurpose)) {
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

  if (normalizedPurpose === 'signup') {
    const typo = emailTypoError(normalizedEmail)
    if (typo) {
      response.status(400).json(typo)
      return
    }
  }

  if (normalizedPurpose === 'signup' && doesAccountExist) {
    response.status(409).json({ success: false, error: 'Email already registered' })
    return
  }

  // Refused before a code is emailed, so a removed member learns at the first
  // step rather than after filling in the whole signup.
  if (normalizedPurpose === 'signup') {
    try {
      if (await isRemovedMember({ email: normalizedEmail, phone })) {
        response.status(403).json(REMOVED_MEMBER_ERROR)
        return
      }
    } catch (err) {
      response.status(500).json({ success: false, error: err.message })
      return
    }
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
    sortBy,
    verifiedOnly,
  } = request.query
  const wantVerifiedOnly = verifiedOnly === '1' || verifiedOnly === 'true'

  let baseProfiles = null
  try {
    baseProfiles = await getPublicProfilesFast(activeUserId, await genderOf(activeUserId))
  } catch {
    baseProfiles = null
  }

  // Held separately from the filtered list below: the free allowance is
  // resolved against everything this member could see, never against what
  // they have filtered or sorted to.
  const allProfiles = baseProfiles || getPublicProfiles(activeUserId)

  let profiles = allProfiles.filter((profile) => {
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
    const matchesVerified = !wantVerifiedOnly || profile.idVerified
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
      matchesVerified &&
      matchesTab
    )
  })

  /*
   * Sorting.
   *
   * The app has offered Name and Age since the filter sheet shipped and sent
   * `sortBy` on every request; this endpoint never read it, so the chips lit
   * up and nothing moved.
   *
   * Sorting cannot widen the free allowance, because that allowance is a
   * recorded set of profile ids rather than a position in this list.
   */
  if (sortBy === 'name' || sortBy === 'age') {
    profiles.sort((a, b) => {
      if (sortBy === 'age') {
        // Youngest first, and anyone without an age sinks rather than
        // sorting as 0 and taking over the top of the list.
        const left = Number.isFinite(Number(a.age)) ? Number(a.age) : Infinity
        const right = Number.isFinite(Number(b.age)) ? Number(b.age) : Infinity
        if (left !== right) return left - right
      }
      // localeCompare so Hindi and Gujarati names order sensibly rather than
      // by UTF-16 code unit, and so case never decides the order.
      return String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' })
    })
  }

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
  // Redact anything past the free allowance for members without a subscription.
  // The allowance is the earliest-registered profiles (see
  // resolveFreeAllocation), and those are listed first so a free member does
  // not have to scroll past locked cards to find the ones they can open.
  let access
  try {
    access = await resolveAccess(activeUserId)
  } catch (err) {
    // Fail closed: if we cannot confirm access, do not hand over data.
    console.error('[paywall] access check failed:', err.message)
    response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
    return
  }

  const freeLimit = access.rule.freeProfileLimit
  let allowed = null
  if (!access.entitled) {
    try {
      allowed = await resolveFreeAllocation(activeUserId, allProfiles, freeLimit)
    } catch (err) {
      // Fail closed, as with the access check above.
      console.error('[paywall] could not resolve the free allowance:', err.message)
      response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
      return
    }
    const open = profiles.filter((profile) => allowed.has(profile.id))
    const rest = profiles.filter((profile) => !allowed.has(profile.id))
    profiles = [...open, ...rest]
  }

  const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 50)
  const offset = Math.max(Number(request.query.offset) || 0, 0)
  const page = profiles.slice(offset, offset + limit)
  const visible = allowed
    ? page.map((profile) => (allowed.has(profile.id) ? profile : lockedProfile(profile)))
    : page

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
      subscribed: access.entitled,
      freeLimit,
      // Why they have access, so the app can say "free for you" rather than
      // implying a payment that never happened.
      reason: access.reason,
      pricePaise: access.rule.pricePaise,
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

  /*
   * Whether the caller has already sent, received or matched with this member.
   *
   * The detail screen decides which action to offer from this, and it was
   * never sent — so the button stayed on "Send Interest" however many times
   * you had already sent one, and each tap made another request the server
   * then refused with a 409.
   */
  let interestStatus
  try {
    const rows = await pgQuery(
      `SELECT i.status, i.sender_id
       FROM matrimony_interests i
       JOIN matrimony_profiles p ON p.id = $2
       WHERE (i.sender_id = $1 AND i.receiver_id = p.user_id)
          OR (i.receiver_id = $1 AND i.sender_id = p.user_id)
       ORDER BY i.updated_at DESC NULLS LAST, i.created_at DESC
       LIMIT 1`,
      [activeUserId, request.params.id]
    )
    const row = rows[0]
    if (row) {
      interestStatus = row.status === 'accepted'
        ? 'accepted'
        : row.status === 'declined'
          ? 'declined'
          : row.sender_id === activeUserId
            ? 'sent'
            : 'received'
    }
  } catch (err) {
    // Not worth failing the whole profile over; the button falls back to
    // offering to send, and the server still refuses a duplicate.
    console.warn('[interest status] lookup failed:', err.message)
  }

  // Same paywall as the list: without a subscription, only the first
  // the free allowance of this member's ordering is readable.
  // Otherwise the list could be locked while the detail route handed over
  // everything to anyone who knew an id.
  //
  // Members you already have an interest with (either direction, any status)
  // are exempt: they sit in your Interests tab, and locking them there left
  // "View Profile" on an empty "Profile not found" screen.
  let access
  try {
    access = await resolveAccess(activeUserId)
  } catch (err) {
    console.error('[paywall] access check failed:', err.message)
    response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
    return
  }

  if (!access.entitled && !interestStatus) {
    let allowedIds = []
    try {
      const all = (await getPublicProfilesFast(activeUserId, await genderOf(activeUserId))) || []
      allowedIds = [...(await resolveFreeAllocation(activeUserId, all, access.rule.freeProfileLimit))]
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

  // A plan with a daily cap: a new profile past the cap waits until tomorrow.
  // Profiles already opened today, and people you have an interest with, stay
  // open so the cap never hides a conversation.
  if (access.entitled && access.dailyProfileViews && !interestStatus) {
    try {
      const allowed = await recordDailyView(activeUserId, profile.id, access.dailyProfileViews)
      if (!allowed) {
        response.status(403).json({
          success: false,
          code: 'DAILY_VIEW_LIMIT',
          limit: access.dailyProfileViews,
          error: `You have opened ${access.dailyProfileViews} profiles today, the most your plan allows. More tomorrow.`,
        })
        return
      }
    } catch (err) {
      // A counting failure must not lock out someone who paid.
      console.error('[daily views] count failed:', err.message)
    }
  }

  response.json({ success: true, data: { ...profile, interestStatus } })
})

/** Today's date in India, the day a daily view limit resets on. */
function istDay(at = Date.now()) {
  return new Date(at + 330 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Records that the member opened this profile today, unless that would go
 * past the plan's daily cap. Returns whether they may see it.
 */
async function recordDailyView(userId, profileId, limit) {
  const day = istDay()
  const [{ seen, total }] = await pgQuery(
    `SELECT COUNT(*) FILTER (WHERE profile_id = $3)::int AS seen, COUNT(*)::int AS total
       FROM profile_daily_views WHERE viewer_user_id = $1 AND day = $2`,
    [userId, day, profileId]
  )
  if (seen) return true
  if (total >= limit) return false
  await pgQuery(
    `INSERT INTO profile_daily_views (viewer_user_id, profile_id, day) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, profileId, day]
  )
  return true
}

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
/** Used when the rules table has no row for a gender, or cannot be read. */
/**
 * What a subscription can unlock.
 *
 * Read off whichever plan the member holds, or off the per-gender rule when
 * their gender is free. Everything defaults to allowed: a capability that
 * cannot be read must not lock a paying member out of what they bought.
 */
/*
 * canViewPhoneUnmatched is false even in ALL_CAPABILITIES: that set is the
 * fallback when a plan cannot be read, and a fallback must not start handing
 * out the numbers of people the member has never matched with.
 */
const ALL_CAPABILITIES = { canViewPhone: true, canSendInterest: true, canChat: true, canViewPhoneUnmatched: false, canHidePhone: false }
const NO_CAPABILITIES = { canViewPhone: false, canSendInterest: false, canChat: false, canViewPhoneUnmatched: false, canHidePhone: false }

/*
 * What someone gets without paying.
 *
 * This is not a default anyone chose — it is what the app already did before
 * capabilities existed, written down. Interests and chat had no server gate at
 * all, and contact numbers required a subscription. Introducing plan tiers must
 * not quietly take the first two away from every free member, so the free tier
 * keeps exactly what it had. Change it deliberately, not as a side effect.
 */
const FREE_TIER_CAPABILITIES = { canViewPhone: false, canSendInterest: true, canChat: true, canViewPhoneUnmatched: false, canHidePhone: false }

const optIn = (value) => value === true || value === 1 || value === 't'

function capabilitiesFromRow(row) {
  const on = (value) => value === undefined || value === null || value === true || value === 1 || value === 't'
  return {
    canViewPhone: on(row.can_view_phone),
    canSendInterest: on(row.can_send_interest),
    canChat: on(row.can_chat),
    // Opt-in, so a missing column (the per-gender rules have none) means off.
    canViewPhoneUnmatched: optIn(row.can_view_phone_unmatched),
    canHidePhone: optIn(row.can_hide_phone),
  }
}

/**
 * How many photos one profile may keep.
 *
 * The cap used to live only in the app — 6 on the signup screen, 2 on the
 * profile screen, and nothing at all on the server, so it was a suggestion
 * rather than a limit. Storage is the thing being protected here, and storage
 * is spent server-side.
 */
const MAX_PROFILE_PHOTOS = 2

const DEFAULT_RULE = {
  isFree: false,
  /*
   * Legacy. Price lived on the gender rule when there was one hardcoded plan;
   * it belongs to subscription_plans now and the admin screen no longer offers
   * it. Still returned by /payments/subscription so builds older than the
   * multi-plan release keep showing a figure rather than a blank.
   */
  pricePaise: 20000,
  freeProfileLimit: 2,
  capabilities: { ...ALL_CAPABILITIES },
}

/*
 * Subscription rules, per gender.
 *
 * Who pays, how much, and how many profiles they see before the paywall are
 * all rows in subscription_rules rather than constants, so they can be changed
 * from the admin screen without a deploy. Women are free at launch; that is a
 * row, not a hardcoded rule, and can be switched off the same way.
 *
 * Cached briefly because the paywall consults it on every listing request. The
 * write path clears the cache, so an admin change is visible immediately.
 */
const RULES_CACHE_KEY = 'subscriptionRules'
const RULES_CACHE_MS = 30000

async function loadSubscriptionRules() {
  const cached = cacheGet(RULES_CACHE_KEY)
  if (cached) return cached

  const rows = await pgQuery(
    `SELECT gender, is_free, price_paise, free_profile_limit,
            can_view_phone, can_send_interest, can_chat
     FROM subscription_rules`
  )

  const rules = {}
  for (const row of rows) {
    rules[String(row.gender).toLowerCase()] = {
      isFree: row.is_free === true || row.is_free === 1 || row.is_free === 't',
      pricePaise: Number(row.price_paise) || DEFAULT_RULE.pricePaise,
      freeProfileLimit: Number.isFinite(Number(row.free_profile_limit))
        ? Number(row.free_profile_limit)
        : DEFAULT_RULE.freeProfileLimit,
      capabilities: capabilitiesFromRow(row),
    }
  }

  cacheSet(RULES_CACHE_KEY, rules, RULES_CACHE_MS)
  return rules
}

function invalidateSubscriptionRules() {
  cacheInvalidate(RULES_CACHE_KEY)
}

/* ------------------------------------------------------------------ */
/* Subscription plans                                                  */
/* ------------------------------------------------------------------ */

const PLANS_CACHE_KEY = 'subscriptionPlans'
const PLANS_CACHE_MS = 30000

/**
 * The plan to fall back on when the table cannot be read.
 *
 * Matches the row seeded by the migration, so a database hiccup degrades to
 * what the app used to hardcode rather than to no plans at all.
 */
const FALLBACK_PLAN = {
  code: 'premium',
  name: 'Monthly',
  durationDays: 30,
  pricePaise: 20000,
  playProductId: 'premium_monthly',
  badge: 'Most popular',
  isActive: true,
  sortOrder: 0,
  capabilities: { ...ALL_CAPABILITIES },
}

function planFromRow(row) {
  return {
    code: String(row.code),
    name: String(row.name),
    durationDays: Number(row.duration_days) || FALLBACK_PLAN.durationDays,
    pricePaise: Number(row.price_paise) || 0,
    playProductId: row.play_product_id ? String(row.play_product_id) : null,
    badge: row.badge ? String(row.badge) : null,
    isActive: row.is_active === true || row.is_active === 1 || row.is_active === 't',
    sortOrder: Number(row.sort_order) || 0,
    capabilities: capabilitiesFromRow(row),
    audience: PLAN_AUDIENCES.has(row.audience) ? row.audience : 'all',
    // null = unlimited
    dailyProfileViews: Number(row.daily_profile_views) > 0 ? Number(row.daily_profile_views) : null,
    updatedAt: row.updated_at || null,
  }
}

/**
 * Who a plan is offered to.
 *
 * 'female' and 'male' plans are shown to, and can only be bought by, members
 * of that gender; 'all' is everyone. A member whose gender is not recorded as
 * either gets only the 'all' plans rather than both sets.
 */
const PLAN_AUDIENCES = new Set(['all', 'female', 'male'])

function planOpenTo(plan, gender) {
  if (!plan) return false
  const audience = plan.audience || 'all'
  return audience === 'all' || audience === String(gender || '').toLowerCase()
}

/** Refuse a purchase of a plan meant for the other gender. Returns true if refused. */
async function refuseIfNotForMember(plan, userId, response) {
  if (planOpenTo(plan, await genderOf(userId))) return false
  response.status(403).json({
    success: false,
    code: 'PLAN_NOT_FOR_MEMBER',
    error: 'That plan is not available on your account.',
  })
  return true
}

/** Every plan, active or not. Admin reads this; buyers get the active ones. */
async function loadPlans() {
  const cached = cacheGet(PLANS_CACHE_KEY)
  if (cached) return cached

  const rows = await pgQuery(
    `SELECT code, name, duration_days, price_paise, play_product_id, badge,
            is_active, sort_order, can_view_phone, can_send_interest, can_chat, can_view_phone_unmatched, can_hide_phone, audience,
            daily_profile_views, updated_at
     FROM subscription_plans
     ORDER BY sort_order, price_paise`
  )

  const plans = rows.map(planFromRow)
  cacheSet(PLANS_CACHE_KEY, plans, PLANS_CACHE_MS)
  return plans
}

function invalidatePlans() {
  cacheInvalidate(PLANS_CACHE_KEY)
}

/** What the app is allowed to offer. */
async function activePlans() {
  try {
    const plans = (await loadPlans()).filter((plan) => plan.isActive)
    return plans.length ? plans : [FALLBACK_PLAN]
  } catch (err) {
    console.error('[plans] could not read subscription_plans:', err.message)
    return [FALLBACK_PLAN]
  }
}

/**
 * Resolve a plan by its code.
 *
 * Returns null for an unknown or retired code rather than guessing, so a
 * payment can never be taken for something that is not on sale. Callers that
 * are recording a purchase already made — a Play renewal for a plan since
 * retired — pass `includeInactive`.
 */
async function planByCode(code, { includeInactive = false } = {}) {
  const wanted = String(code || '').trim()
  if (!wanted) return null
  try {
    const plans = await loadPlans()
    const found = plans.find((plan) => plan.code === wanted)
    if (!found) return null
    return found.isActive || includeInactive ? found : null
  } catch (err) {
    console.error('[plans] lookup failed:', err.message)
    return wanted === FALLBACK_PLAN.code ? FALLBACK_PLAN : null
  }
}

/** Resolve a plan from the Play Console product id on a purchase. */
async function planByPlayProductId(productId) {
  const wanted = String(productId || '').trim()
  if (!wanted) return null
  try {
    const plans = await loadPlans()
    return plans.find((plan) => plan.playProductId === wanted) || null
  } catch (err) {
    console.error('[plans] product lookup failed:', err.message)
    return wanted === FALLBACK_PLAN.playProductId ? FALLBACK_PLAN : null
  }
}

async function ruleForGender(gender) {
  const key = String(gender || '').trim().toLowerCase()
  try {
    const rules = await loadSubscriptionRules()
    return rules[key] || DEFAULT_RULE
  } catch (err) {
    // Fail closed on the paid side: an unreadable rules table must not hand
    // out free access, but it must also not crash the listing.
    console.error('[rules] could not read subscription_rules:', err.message)
    return DEFAULT_RULE
  }
}

async function genderOf(userId) {
  const rows = await pgQuery(
    'SELECT gender FROM matrimony_profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  )
  return String(rows[0]?.gender || '').trim().toLowerCase()
}

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

/** The live subscription's plan code, or null when there is none. */
async function activePlanCode(userId) {
  if (!userId) return null
  const rows = await pgQuery(
    `SELECT plan FROM user_subscriptions
     WHERE user_id = $1 AND status = 'active' AND expires_at::timestamp > NOW()
     ORDER BY expires_at::timestamp DESC
     LIMIT 1`,
    [userId]
  )
  return rows[0]?.plan || null
}

/**
 * Whether this member sees the whole directory.
 *
 * Either their gender is free under the current rules, or they hold a live
 * subscription. Returns the rule too, so callers get the free-profile limit
 * that applies to this member rather than one global constant.
 */
async function resolveAccess(userId) {
  if (!userId) {
    return { entitled: false, rule: DEFAULT_RULE, capabilities: NO_CAPABILITIES, reason: 'anonymous', planCode: null }
  }

  const gender = await genderOf(userId)
  const rule = await ruleForGender(gender)

  if (rule.isFree) {
    /*
     * Free for their gender, but they may still have bought a plan for what
     * the free rule does not give — hiding their number, say. Ignoring the
     * plan here meant paying for a feature and never receiving it, so a held
     * plan adds to the free rule rather than being skipped.
     */
    const freeCaps = rule.capabilities || ALL_CAPABILITIES
    const heldCode = await activePlanCode(userId)
    const held = heldCode ? await planByCode(heldCode, { includeInactive: true }) : null
    const capabilities = held?.capabilities
      ? Object.fromEntries(
          Object.keys({ ...freeCaps, ...held.capabilities }).map((key) => [
            key,
            Boolean(freeCaps[key] || held.capabilities[key]),
          ])
        )
      : freeCaps
    return {
      entitled: true,
      rule,
      capabilities,
      reason: 'free-for-gender',
      planCode: heldCode || null,
    }
  }

  const planCode = await activePlanCode(userId)
  if (!planCode) {
    /*
     * A member of this gender who has not paid. The per-gender switches say
     * what they get, the same switches that apply when the gender is free —
     * so the admin card means one thing rather than silently applying only in
     * the free case, which is how it read before and fooled nobody usefully.
     */
    return {
      entitled: false,
      rule,
      capabilities: rule.capabilities || FREE_TIER_CAPABILITIES,
      reason: 'none',
      planCode: null,
    }
  }

  /*
   * Capabilities come from the plan they actually hold, including one that has
   * since been retired — they paid for what it offered at the time, and taking
   * it away mid-term because it left the shop would be wrong.
   */
  const heldPlan = await planByCode(planCode, { includeInactive: true })
  return {
    entitled: true,
    rule,
    capabilities: heldPlan?.capabilities || ALL_CAPABILITIES,
    reason: 'subscribed',
    planCode,
    // Only a plan bought by someone whose gender is not free can carry a cap;
    // free-for-gender access above stays unlimited.
    dailyProfileViews: heldPlan?.dailyProfileViews ?? null,
  }
}

/**
 * Guard one capability on a route.
 *
 * Answers with 403 and a machine-readable code when the member's plan does not
 * include it, so the app can say which plan does rather than showing a generic
 * failure. Returns true when the caller may proceed.
 */
async function requireCapability(userId, capability, response, message) {
  let access
  try {
    access = await resolveAccess(userId)
  } catch (err) {
    console.error('[capability] access check failed:', err.message)
    response.status(503).json({ success: false, error: 'Could not verify your subscription. Please try again.' })
    return false
  }

  if (access.capabilities[capability]) return true

  /*
   * Which of the two it is matters to the member: one is "subscribe", the other
   * is "you subscribed, but not to a plan that includes this".
   */
  response.status(403).json({
    success: false,
    error: message,
    code: access.entitled ? 'PLAN_UPGRADE_REQUIRED' : 'SUBSCRIPTION_REQUIRED',
  })
  return false
}

/**
 * What a locked profile looks like on the wire.
 *
 * Only the id and the flag — the client needs to know a card belongs here and
 * how many there are, and nothing else. No name, age, location, bio, photo or
 * contact detail leaves the server for a profile the caller has not paid for.
 */
/**
 * The profiles a free member may read: the first N to register, of the
 * profiles this member can see (opposite gender, not blocked either way),
 * oldest first. Owner's rule (Oct 2026): "first 2 registered", and if one of
 * them deletes their account the next in line takes its place; raising the
 * allowance to 10 opens the first 10.
 *
 * Computed fresh on each request rather than stored. Ordering by registration
 * keeps it stable: a new member joins at the end and never displaces anyone,
 * which was the reason the old newest-first "first N" had to be frozen per
 * member in matrimony_free_allocations (no longer read).
 *
 * Resolved against the member's full list, not whatever they have filtered or
 * sorted to, so a filter cannot reveal a different two.
 */
async function resolveFreeAllocation(viewerUserId, baseProfiles, freeLimit) {
  if (!(freeLimit > 0)) return new Set()
  const byRegistration = [...baseProfiles].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime() || 0
    const tb = new Date(b.createdAt || 0).getTime() || 0
    return ta - tb || String(a.id).localeCompare(String(b.id))
  })
  return new Set(byRegistration.slice(0, freeLimit).map((profile) => profile.id))
}

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

    // The listing is cached per viewer and carries is_shortlisted with it, so
    // without this the Shortlisted tab keeps showing what it showed before.
    invalidateFastCache('publicProfiles')

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

    const [owner] = await pgQuery('SELECT user_id FROM matrimony_profiles WHERE id = $1', [request.params.id])
    notifyProfileViewed(activeUserId, owner?.user_id).catch((err) =>
      console.error('[notify] profile view failed:', err.message)
    )

    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

/** True when this member has switched phone sharing off on a plan that allows it. */
async function phoneHiddenBy(userId) {
  const [settings] = await pgQuery(
    'SELECT privacy_show_phone FROM user_settings WHERE user_id = $1',
    [userId]
  )
  if (!settings || settings.privacy_show_phone !== false) return false
  const access = await resolveAccess(userId)
  return Boolean(access.capabilities?.canHidePhone)
}

app.post('/api/matrimony/profiles/:id/unlock', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  /*
   * Viewing a contact number needs a plan that includes it. This used to be a
   * bare subscription check, which is now only one half of the question.
   */
  const allowed = await requireCapability(
    activeUserId,
    'canViewPhone',
    response,
    'Your plan does not include contact numbers. Upgrade to see them.'
  )
  if (!allowed) return

  try {
    if (!(await profileExists(request.params.id))) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }

    /*
     * A number is only handed over once both sides have agreed. The endpoint
     * used to answer `{ unlocked: true }` and nothing else, while the profile
     * payload strips the phone — so "Show Number" told every member, paying or
     * not, that the person had not added one. This returns it, and says why
     * when it will not.
     */
    const [owner] = await pgQuery(
      `SELECT p.user_id, u.phone
       FROM matrimony_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1
       LIMIT 1`,
      [request.params.id]
    )

    /*
     * A plan the admin has marked "numbers without a match" skips the
     * accepted-interest check; every other plan still needs both sides to
     * have agreed. Members consent to this sharing at signup.
     */
    const access = await resolveAccess(activeUserId)
    const withoutMatch = Boolean(access.capabilities?.canViewPhoneUnmatched)

    const [interest] = withoutMatch ? [true] : await pgQuery(
      `SELECT status FROM matrimony_interests
       WHERE status = 'accepted'
         AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
       LIMIT 1`,
      [activeUserId, owner?.user_id || null]
    )

    if (!interest) {
      response.status(403).json({
        success: false,
        error: 'Contact numbers are shared once an interest is accepted on both sides.',
        code: 'INTEREST_REQUIRED',
      })
      return
    }

    /*
     * The owner's own choice, last. A number is withheld only when the owner
     * switched sharing off *and* is on a plan that lets them — everyone agrees
     * to share at signup, and hiding is a plan feature. If that plan lapses
     * the number is shared again, as they agreed.
     */
    if (owner?.user_id && (await phoneHiddenBy(owner.user_id))) {
      response.status(403).json({
        success: false,
        error: 'This member has chosen not to share their number.',
        code: 'PHONE_HIDDEN',
      })
      return
    }

    await Promise.all([
      updateProfileStateAsync(request.params.id, activeUserId, { is_unlocked: 1 }),
      recordProfileActionAsync({
        profileId: request.params.id,
        actorUserId: activeUserId,
        actionType: 'unlock',
        metadata: { subscriptionGated: true, withoutMatch },
      }),
    ])

    response.json({ success: true, data: { unlocked: true, phone: owner?.phone || null } })
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

  /*
   * Whether interests cost anything was a constant in the app — three screens
   * each holding `SEND_INTEREST_FREE: true`, and nothing on the server. A
   * patched build ignored it, so this is where the answer belongs.
   */
  const allowed = await requireCapability(
    activeUserId,
    'canSendInterest',
    response,
    'Your plan does not include sending interests. Upgrade to send them.'
  )
  if (!allowed) return

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

    const [sender] = await pgQuery('SELECT full_name FROM users WHERE id = $1', [activeUserId])
    notifyInBackground([receiverUserId], {
      type: 'interest_received',
      title: 'New interest',
      body: `${sender?.full_name || 'Someone'} is interested in your profile.`,
      data: { screen: 'Interests' },
    })

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

  /*
   * Require an explicit boolean.
   *
   * Anything falsy counted as a decline, so a request that simply omitted the
   * field — or spelled it differently — quietly rejected someone's interest
   * and reported success.
   */
  if (typeof accept !== 'boolean') {
    response.status(400).json({
      success: false,
      error: 'accept must be true or false',
    })
    return
  }

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

    // Only acceptance is announced. Telling someone they were declined adds
    // nothing they can act on.
    if (accept) {
      const [receiver] = await pgQuery('SELECT full_name FROM users WHERE id = $1', [activeUserId])
      notifyInBackground([interest.sender_id], {
        type: 'interest_accepted',
        title: "It's a match!",
        body: `${receiver?.full_name || 'Someone'} accepted your interest. You can now message each other.`,
        data: { screen: 'Messages' },
      })
    }

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
  // ?fresh=1 skips the cache: the app asks for it on leaving a chat, so the
  // unread badge it just cleared does not come back from another worker's copy.
  const cached = request.query.fresh ? null : cacheGet(cacheKey)
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

/**
 * Unmatch: end a conversation from either side.
 *
 * Deletes the match and its messages, and sets the accepted interests between
 * the pair back to 'declined'. Without that last part the pair would still
 * read as mutually interested — the contact number would stay unlocked, and
 * the interests screen would keep offering a match that no longer exists.
 *
 * Deliberately not a block: the other member can send a fresh interest later.
 * Blocking is the separate, stronger action on the same menu.
 */
app.delete('/api/matrimony/matches/:id', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    // The id check and the membership check are one statement, so a member
    // cannot end a conversation they are not part of.
    const rows = await pgQuery(
      `SELECT user1_id, user2_id FROM matrimony_matches
        WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [request.params.id, activeUserId]
    )
    const match = rows[0]
    if (!match) {
      response.status(404).json({ success: false, error: 'Match not found' })
      return
    }

    const otherUserId = match.user1_id === activeUserId ? match.user2_id : match.user1_id

    await pgQuery('DELETE FROM matrimony_messages WHERE match_id = $1', [request.params.id])
    await pgQuery('DELETE FROM matrimony_matches WHERE id = $1', [request.params.id])
    await pgQuery(
      `UPDATE matrimony_interests
          SET status = 'declined', updated_at = $3
        WHERE status = 'accepted'
          AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))`,
      [activeUserId, otherUserId, new Date().toISOString()]
    )

    // Both sides: the other member's list must lose the conversation too.
    cacheInvalidate(`matches:${activeUserId}`)
    cacheInvalidate(`matches:${otherUserId}`)
    cacheInvalidate(`interests:${activeUserId}`)
    cacheInvalidate(`interests:${otherUserId}`)

    response.json({ success: true })
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

    /*
     * Mark read before anything can answer from the cache.
     *
     * This used to run after the cache check, fire-and-forget, so a fetch
     * served from cache never marked anything and the unread badge stayed on
     * a conversation the member had already read. Awaited now, so the sender
     * sees the seen tick on their next poll.
     */
    const marked = await pgQuery(
      'UPDATE matrimony_messages SET is_read = 1 WHERE match_id = $1 AND sender_id != $2 AND is_read = 0 RETURNING id',
      [matchId, activeUserId]
    )
    if (marked.length > 0) {
      cacheInvalidate(cacheKey)
      cacheInvalidate(`matches:${activeUserId}`)
    }

    const cached = cacheGet(cacheKey)
    if (cached) { response.json(cached); return }

    const messages = await pgQuery(`
      SELECT id, sender_id as senderId, content, created_at as createdAt, is_read as isRead
      FROM matrimony_messages
      WHERE match_id = $1
      ORDER BY created_at ASC
    `, [matchId])

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

  // Sending, not reading: a member whose plan drops chat can still see what was
  // said to them, which keeps a downgrade from hiding a conversation they had.
  const allowed = await requireCapability(
    activeUserId,
    'canChat',
    response,
    'Your plan does not include messaging. Upgrade to reply.'
  )
  if (!allowed) return

  const { id: matchId } = request.params
  const { content } = request.body || {}

  if (!content || !content.trim()) {
    response.status(400).json({ success: false, error: 'Message content required' })
    return
  }

  try {
    const [match] = await pgQuery(
      'SELECT id, user1_id, user2_id FROM matrimony_matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, activeUserId]
    )
    if (!match) {
      response.status(404).json({ success: false, error: 'Match not found' })
      return
    }
    const otherUserId = match.user1_id === activeUserId ? match.user2_id : match.user1_id

    // Pushed only when this opens a new unread run: a burst of messages is
    // one notification, not ten, and the rest are waiting in the chat.
    const [{ unread } = { unread: 0 }] = await pgQuery(
      `SELECT COUNT(*)::int AS unread FROM matrimony_messages
       WHERE match_id = $1 AND sender_id = $2 AND is_read = 0`,
      [matchId, activeUserId]
    )

    const messageId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    await pgQuery(
      'INSERT INTO matrimony_messages (id, match_id, sender_id, content, created_at, is_read) VALUES ($1, $2, $3, $4, $5, 0)',
      [messageId, matchId, activeUserId, content.trim(), createdAt]
    )

    // Invalidate caches so next fetch is fresh
    cacheInvalidate(`messages:${matchId}`)
    cacheInvalidate(`matches:${activeUserId}`)
    // The recipient's list carries the new last message and unread count.
    cacheInvalidate(`matches:${otherUserId}`)

    if (unread === 0) {
      const [sender] = await pgQuery('SELECT full_name FROM users WHERE id = $1', [activeUserId])
      const text = content.trim()
      pushInBackground([otherUserId], {
        title: sender?.full_name || 'New message',
        body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        data: { type: 'message', screen: 'Messages', matchId },
      })
    }

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

  /*
   * Gender is fixed at signup.
   *
   * The listing shows only the opposite gender, so letting someone flip theirs
   * afterwards would silently swap the entire directory they can see — and,
   * once the rules make one gender free, would be a way to grant yourself free
   * access. It is dropped here rather than rejected so an older client that
   * still sends the field keeps working.
   */
  for (const bag of [profile, matrimony, user]) {
    if (bag && typeof bag === 'object') {
      delete bag.gender
      delete bag.Gender
    }
  }

  /*
   * Name and date of birth are what the Aadhaar check matched. Editing them
   * after would keep the badge on details nobody checked, so once verified
   * they are dropped, like gender, rather than refused. Where they live is
   * frozen too: a verified profile should not quietly move town afterwards.
   */
  if (await isIdVerified(activeUserId)) {
    for (const bag of [profile, matrimony, user]) {
      if (bag && typeof bag === 'object') {
        for (const key of IDENTITY_LOCKED_FIELDS) delete bag[key]
      }
    }
  }

  /*
   * A changed date of birth goes through the same age gate as signup. It used
   * to be written whatever it was, with the age left stale whenever the new
   * date fell outside 18–120, so a member could make themselves a minor on the
   * date while the card still showed an adult age.
   */
  // Only a changed date is checked: the app sends the stored one back on
  // every save, and an old account with a bad date must still save the rest.
  const newDob = [profile, matrimony].map((bag) => bag?.dateOfBirth).find((v) => v)
  const [storedDob] = newDob
    ? await pgQuery('SELECT date_of_birth FROM matrimony_profiles WHERE user_id = $1', [activeUserId])
    : []
  if (newDob && String(newDob).slice(0, 10) !== String(storedDob?.date_of_birth || '').slice(0, 10)) {
    const born = new Date(newDob)
    const years = (Date.now() - born.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    if (Number.isNaN(born.getTime()) || years > 120) {
      response.status(400).json({ success: false, error: 'Please enter a valid date of birth' })
      return
    }
    if (years < 18) {
      response.status(403).json({
        success: false,
        code: 'UNDER_AGE',
        error: 'You must be at least 18 years old.',
      })
      return
    }
  }

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
      // Keep the first N rather than rejecting the save: an older build still
      // offering six would otherwise be unable to save a profile at all.
      photosForDb = profile.photos.slice(0, MAX_PROFILE_PHOTOS).map(p => ({
        id: p.id || String(Math.random()).slice(2),
        uri: p.uri || p.url || '',
        url: p.url || p.uri || '',
        status: p.status || 'done',
        isPrimary: Boolean(p.isPrimary),
        uploadedAt: p.uploadedAt || new Date().toISOString()
      }))
      if (profile.photos.length > MAX_PROFILE_PHOTOS) {
        console.warn(
          `[update profile] trimmed ${profile.photos.length} photos to ${MAX_PROFILE_PHOTOS}`
        )
      }
      console.log('[update profile] photos cleaned:', photosForDb.length, 'photos')
    } catch (e) {
      console.error('[update profile] photos cleaning error:', e.message)
      photosForDb = null
    }
  }

  try {
    // Update users table
    /*
     * Name only. Phone is deliberately not writable here.
     *
     * It is an identity field — the number a sign-in code goes to — and this
     * endpoint took whatever the client sent, so anyone could move their
     * account onto a different number, or collide with someone else's and get
     * a raw unique-constraint 500 for their trouble. Changing it should be a
     * deliberate, verified flow, not a side effect of saving a profile.
     */
    if (user.fullName) {
      await pgQuery(
        'UPDATE users SET full_name = COALESCE($1, full_name), updated_at = $2 WHERE id = $3',
        [user.fullName || null, now, activeUserId]
      )
    }

    // Debug: Log what we're sending for photos
    console.log('[update profile] photosForDb type:', typeof photosForDb, Array.isArray(photosForDb), JSON.stringify(photosForDb).slice(0, 100))

    // Convert photos array to JSON string for ::jsonb cast
    const photosJson = photosForDb ? JSON.stringify(photosForDb) : null

    /*
     * Which request field lands in which column.
     *
     * Two bugs lived in the fixed 39-parameter statement this replaces.
     *
     * First, the app sends religion, caste, sub-caste, dosh, physical status,
     * country, state, village, eating habit and the two horoscope fields under
     * `profile`, while the statement only ever read some of them, and read
     * others only from `matrimony`. Anything on the wrong side of that split
     * was accepted, acknowledged, and silently dropped — which is why editing
     * so much of the profile appeared to do nothing.
     *
     * Second, every column was written with COALESCE($n, column) over a value
     * that had already been through `|| null`, so an emptied field became null
     * became "keep what was there". Clearing anything was impossible.
     *
     * So: each column names the keys it may arrive under, the SET clause is
     * built from the fields actually present, and a field that is present but
     * empty is written as empty rather than ignored.
     */
    const FIELD_SOURCES = {
      location: ['location', 'city'],
      occupation: ['occupation'],
      education: ['education'],
      bio: ['bio'],
      date_of_birth: ['dateOfBirth'],
      marital_status: ['maritalStatus'],
      height: ['height'],
      income: ['income'],
      community: ['community'],
      language: ['language'],
      family_status: ['familyStatus'],
      family_type: ['familyType'],
      family_wealth: ['familyWealth'],
      father_name: ['fatherName'],
      mother_name: ['motherName'],
      father_occupation: ['fatherOccupation'],
      mother_occupation: ['motherOccupation'],
      siblings: ['siblings'],
      native_city: ['nativeCity'],
      native_village: ['nativeVillage'],
      eating_habit: ['eatingHabit'],
      horoscope_time: ['horoscopeTime'],
      horoscope_place: ['horoscopePlace'],
      nakshatra: ['nakshatra'],
      raasi: ['raasi'],
      employment_type: ['employmentType'],
      income_currency: ['incomeCurrency'],
      annual_income: ['annualIncome'],
      mother_tongue: ['motherTongue'],
      // Previously unreachable from the edit screen entirely.
      physical_status: ['physicalStatus'],
      religion: ['religion'],
      caste: ['caste'],
      subcaste: ['subcaste', 'subCaste'],
      // Kept in step with `subcaste` below, because filters and older reads
      // still go through this column.
      sub_community: ['subCommunity'],
      dosh: ['dosh'],
      country: ['country'],
      state: ['state'],
      village: ['village'],
      profile_created_for: ['profileCreatedFor'],
    }

    const JSON_FIELDS = {
      hobbies: ['hobbies'],
      music: ['music'],
      sports: ['sports'],
      cuisine: ['cuisine'],
    }

    // Columns declared NOT NULL take '' when cleared; everything else takes NULL.
    const NOT_NULL_COLUMNS = new Set([
      'location', 'community', 'education', 'occupation', 'bio',
      'marital_status', 'height', 'income', 'language',
    ])

    /** The value for a key from whichever bag carries it, or undefined. */
    const pick = (keys) => {
      for (const key of keys) {
        for (const bag of [profile, matrimony]) {
          if (bag && typeof bag === 'object' && Object.prototype.hasOwnProperty.call(bag, key)) {
            const value = bag[key]
            if (value !== undefined) return value
          }
        }
      }
      return undefined
    }

    const sets = []
    const params = []
    const assign = (column, value) => {
      params.push(value)
      sets.push(`${column} = $${params.length}`)
    }

    for (const [column, keys] of Object.entries(FIELD_SOURCES)) {
      const value = pick(keys)
      if (value === undefined) continue
      const text = value === null ? '' : String(value).trim()
      assign(column, text === '' ? (NOT_NULL_COLUMNS.has(column) ? '' : null) : text)
    }

    // One answer, two columns: keep them equal so whichever a reader picks
    // gives the same sub-caste.
    const subcasteValue = pick(['subcaste', 'subCaste'])
    if (subcasteValue !== undefined && pick(['subCommunity']) === undefined) {
      assign('sub_community', String(subcasteValue ?? '').trim() || null)
    }

    for (const [column, keys] of Object.entries(JSON_FIELDS)) {
      const value = pick(keys)
      if (!Array.isArray(value)) continue
      params.push(JSON.stringify(value))
      sets.push(`${column} = $${params.length}::jsonb`)
    }

    // Age follows the date of birth rather than being typed separately, so a
    // corrected birthday does not leave a stale age on the card.
    const dob = pick(['dateOfBirth'])
    if (dob) {
      const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      if (Number.isFinite(years) && years >= 18 && years <= 120) assign('age', years)
    }

    if (photosJson !== null) {
      params.push(photosJson)
      sets.push(`photos = $${params.length}::jsonb`)
    }

    if (sets.length > 0) {
      params.push(now)
      sets.push(`updated_at = $${params.length}`)
      params.push(activeUserId)
      try {
        await pgQuery(
          `UPDATE matrimony_profiles SET ${sets.join(', ')} WHERE user_id = $${params.length}`,
          params
        )
      } catch (dbErr) {
        console.error('[update profile] DB Error:', dbErr.message)
        throw dbErr
      }
    }

    /*
     * Both caches. This cleared only index.js's cache, while the profile is
     * read back through fast-queries, which keeps its own — so a save landed
     * in the database and the screen redrew from a stale copy. That is the
     * other half of "I edited it and nothing changed".
     *
     * The listing carries name, age, location and photos too, so it has to go
     * as well or the member's card stays wrong for everyone else.
     */
    cacheInvalidate(`memberPayload:${activeUserId}`)
    invalidateFastCache('currentMemberPayload')
    invalidateFastCache('publicProfiles')
    invalidateFastCache('matrimonyFilterOptions')

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
// One copy of these pages, published two ways: this server serves them, and
// render.yaml also deploys the same directory as a static site so a custom
// domain can point at it without paying to upgrade the API.
const siteDir = path.resolve('site')

/*
 * Public landing page.
 *
 * BillDesk's cross-border KYC asks for a business website, and an API origin
 * that answers 404 at the root is not one. It also gives the app a public
 * page to point at from the Play listing.
 */
app.get('/', (_request, response) => {
  response.sendFile(path.join(siteDir, 'index.html'), (error) => {
    if (error) {
      console.error('[legal] could not serve the landing page:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Temporarily unavailable.')
      }
    }
  })
})

/*
 * Admin screen for the subscription rules.
 *
 * The page itself is public HTML; everything it does goes through
 * /api/admin/*, which requires an admin session. Serving it needs no auth for
 * the same reason a login page needs none.
 */
app.get('/admin', (_request, response) => {
  response.sendFile(path.join(siteDir, 'admin.html'), (error) => {
    if (error) {
      console.error('[admin] could not serve the rules page:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Temporarily unavailable.')
      }
    }
  })
})

app.get('/child-safety', (_request, response) => {
  response.sendFile(path.join(siteDir, 'child-safety.html'), (error) => {
    if (error) {
      console.error('[legal] could not serve the child safety page:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Temporarily unavailable.')
      }
    }
  })
})

/*
 * Public help: the in-app guide plus common questions, in the language asked
 * for (?lang=en|hi|gu). The support auto-reply links here.
 */
// The Gmail Apps Script the admin panel offers to copy (contains no secrets).
app.get('/support/gmail-forwarder.gs', (_request, response) => {
  response.type('text/plain').sendFile(path.join(siteDir, '..', 'support', 'gmail-forwarder.gs'))
})

app.get('/help', async (request, response) => {
  try {
    const guide = (await loadGuideSections()).filter((row) => row.is_active)
    response.type('html').send(renderHelpPage(request.query.lang, guide))
  } catch (err) {
    console.error('[help] could not render:', err.message)
    response.type('html').send(renderHelpPage(request.query.lang, []))
  }
})

app.get('/delete-account', (_request, response) => {
  response.sendFile(path.join(siteDir, 'delete-account.html'), (error) => {
    if (error) {
      console.error('[legal] could not serve the deletion page:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Temporarily unavailable.')
      }
    }
  })
})

app.get(['/terms', '/terms-and-conditions'], (_request, response) => {
  response.sendFile(path.join(siteDir, 'terms.html'), (error) => {
    if (error) {
      console.error('[legal] could not serve the terms:', error.message)
      if (!response.headersSent) {
        response.status(500).type('text/plain').send('Terms are temporarily unavailable.')
      }
    }
  })
})

app.get(['/privacy-policy', '/privacy'], (_request, response) => {
  response.sendFile(path.join(siteDir, 'privacy-policy.html'), (error) => {
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

    const { plan } = request.body

    // The amount is the plan's, never the caller's. This used to bill whatever
    // figure was posted, so an order for ₹1 would have bought a full month.
    const selected = await planByCode(plan)
    if (!selected) {
      response.status(400).json({ success: false, error: 'That plan is not available.' })
      return
    }
    // Hidden in the app for the other gender, and refused here too so a
    // hand-made request cannot buy it.
    if (await refuseIfNotForMember(selected, activeUserId, response)) return

    const options = {
      amount: selected.pricePaise,
      currency: 'INR',
      receipt: `r_${activeUserId.slice(0, 8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: activeUserId,
        plan: selected.code
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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = request.body

    // Same rule as create-order: what gets recorded is the plan's price, not a
    // number the client chose.
    const selected = await planByCode(plan, { includeInactive: true })
    if (!selected) {
      response.status(400).json({ success: false, error: 'That plan is not available.' })
      return
    }
    if (await refuseIfNotForMember(selected, activeUserId, response)) return
    const amount = Math.round(selected.pricePaise / 100)

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
    expiryDate.setDate(now.getDate() + (await planDurationDays(plan)))

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

    // The rules decide whether this member pays at all, so the app can show
    // "included for you" instead of a price they will never be charged.
    let access = { entitled: false, rule: DEFAULT_RULE, reason: 'none' }
    try {
      access = await resolveAccess(activeUserId)
    } catch (accessErr) {
      console.error('[subscription] access check failed:', accessErr.message)
    }

    const plan = {
      pricePaise: access.rule.pricePaise,
      freeProfileLimit: access.rule.freeProfileLimit,
      freeForYou: access.rule.isFree,
      // What this member can actually do, so the app can hide a control rather
      // than offer it and let the server refuse.
      capabilities: access.capabilities,
    }

    if (!result || result.length === 0) {
      response.json({
        success: true,
        data: {
          hasSubscription: false,
          // Entitled without a subscription row means their gender is free
          // under the current rules.
          entitled: access.entitled,
          reason: access.reason,
          plan,
        },
      })
      return
    }

    const sub = result[0]
    response.json({
      success: true,
      data: {
        hasSubscription: true,
        entitled: true,
        reason: access.reason,
        plan,
        plan_name: sub.plan,
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
    expiryDate.setDate(now.getDate() + (await planDurationDays(plan)))

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

/**
 * How long a plan runs for.
 *
 * A purchase already made is honoured even if the plan has since been retired
 * or deleted, hence includeInactive and the fallback — refusing to date a
 * payment we have already taken would be worse than dating it conservatively.
 */
async function planDurationDays(plan) {
  const found = await planByCode(plan, { includeInactive: true })
  return found?.durationDays ?? FALLBACK_PLAN.durationDays
}

/**
 * Idempotently mark a subscription active. Safe to call repeatedly for the same
 * payment: the row is keyed on user_id, so a repeat call just refreshes it.
 */
async function activateSubscription({ userId, plan, amount, paymentId, orderId }) {
  const normalizedPlan = String(plan || FALLBACK_PLAN.code).trim() || FALLBACK_PLAN.code
  const now = new Date()
  const expiryDate = new Date(now)
  expiryDate.setDate(now.getDate() + (await planDurationDays(normalizedPlan)))

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

    /*
     * Which plan this is comes from the product id Google reports, so a
     * quarterly or annual subscription records itself correctly without any
     * change here. An unrecognised product still grants access — the member
     * paid — but is recorded against the fallback rather than dropped.
     */
    const bought = (await planByPlayProductId(purchase.productId)) || FALLBACK_PLAN

    /*
     * The verified-member discount is a Play offer the app only offers to
     * Aadhaar-verified members. A purchase of it by anyone else means an
     * older or modified app picked it up. They paid, so access is still
     * granted; the log is how it gets noticed.
     */
    if (purchase.offerId === VERIFIED_DISCOUNT_OFFER_ID && !(await isIdVerified(activeUserId))) {
      console.warn(`[play] verified-member offer bought by unverified user ${activeUserId} (order ${purchase.orderId})`)
    }
    const startedAt = new Date().toISOString()
    // Google's own expiry is the truth for a Play purchase; the plan duration
    // is only a stand-in when the lookup came back without one.
    const expiresAt =
      purchase.expiryTime ||
      new Date(Date.now() + bought.durationDays * 864e5).toISOString()

    await pgQuery(
      `INSERT INTO user_subscriptions
         (user_id, plan, amount, payment_id, order_id, status, started_at, expires_at,
          play_purchase_token, play_product_id, provider, play_state)
       VALUES ($1, $8, $9, $2, $3, 'active', $4, $5, $6, $7, 'google_play', $10)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = $8,
         amount = $9,
         status = 'active',
         payment_id = $2,
         order_id = $3,
         started_at = $4,
         expires_at = $5,
         play_purchase_token = $6,
         play_product_id = $7,
         provider = 'google_play',
         play_state = $10`,
      [
        activeUserId,
        purchase.orderId || purchaseToken.slice(0, 40),
        purchase.orderId || purchaseToken.slice(0, 40),
        startedAt,
        expiresAt,
        purchaseToken,
        purchase.productId,
        bought.code,
        Math.round(bought.pricePaise / 100),
        purchase.state || null,
      ]
    )

    // Log the order for per-plan counts (admin alerts). Renewals carry their
    // own order ids (..0, ..1); counts use distinct buyers, so they do not
    // inflate "how many bought". Best effort.
    pgQuery(
      `INSERT INTO plan_purchases (order_id, user_id, plan, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_id) DO NOTHING`,
      [purchase.orderId || purchaseToken.slice(0, 40), activeUserId, bought.code, new Date().toISOString()]
    ).catch((err) => console.error('[play] purchase log failed:', err.message))

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
      data: { active: true, plan: bought.code, startedAt, expiresAt },
    })
  } catch (err) {
    /*
     * A rejected purchase token is the buyer's problem and they can retry.
     * Rejected credentials are ours, and telling a paying member their
     * purchase is invalid when the fault is our service account would be both
     * wrong and alarming.
     */
    if (err?.code === 'PLAY_AUTH_FAILED') {
      console.error('[play] GOOGLE REJECTED OUR CREDENTIALS:', err.message)
      response.status(503).json({
        success: false,
        code: 'PLAY_AUTH_FAILED',
        error: 'We could not reach Google to confirm this purchase. Please contact support.',
      })
      return
    }

    if (err?.code === 'PLAY_TOKEN_INVALID') {
      console.warn('[play] token rejected by Google:', err.message)
      response.status(400).json({
        success: false,
        code: 'PLAY_TOKEN_INVALID',
        error: 'This purchase could not be verified.',
      })
      return
    }

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

    /*
     * Log every notification that arrives, not only the ones that fail.
     * Without this there is no way to tell a working RTDN pipeline from a
     * silently broken one — and a broken one costs paying members their
     * access with no other symptom.
     */
    const notification = payload.subscriptionNotification
    console.log(
      '[play] rtdn received:',
      JSON.stringify({
        kind: notification ? 'subscription' : payload.testNotification ? 'test' : 'other',
        notificationType: notification?.notificationType ?? null,
        token: notification?.purchaseToken ? `${notification.purchaseToken.slice(0, 12)}…` : null,
      })
    )

    if (!notification?.purchaseToken) return

    const purchase = await getSubscriptionFromPlay(notification.purchaseToken)
    if (!purchase.valid) return

    await pgQuery(
      `UPDATE user_subscriptions
       SET status = $1, expires_at = COALESCE($2, expires_at), play_state = $4
       WHERE play_purchase_token = $3`,
      [purchase.entitled ? 'active' : 'expired', purchase.expiryTime, notification.purchaseToken, purchase.state || null]
    )
  } catch (err) {
    console.error('[play] rtdn handling failed:', err.message)
  }
})

/**
 * The plans on sale, for the app's subscription screen.
 *
 * Deliberately not behind requirePayments: the screen has to render its prices
 * even on a build where Razorpay keys are unset and only Play billing works.
 */
/*
 * The in-app guide.
 *
 * Content lives in app_guide_sections so it can be reworded or extended for a
 * new feature from the admin screen, reaching every installed app without a
 * release. Cached for a minute — it changes rarely and is read on every visit
 * to the guide screen.
 */
const GUIDE_CACHE_KEY = 'appGuide'
const GUIDE_CACHE_MS = 60_000

/** Map an app language tag onto the column suffix holding that translation. */
function guideLangSuffix(language) {
  const tag = String(language || '').toLowerCase()
  if (tag.startsWith('hi')) return 'hi'
  if (tag.startsWith('gu')) return 'gu'
  return 'en'
}

async function loadGuideSections() {
  const cached = cacheGet(GUIDE_CACHE_KEY)
  if (cached) return cached

  const rows = await pgQuery(
    `SELECT key, icon, title_en, title_hi, title_gu, body_en, body_hi, body_gu,
            is_active, sort_order, updated_at
       FROM app_guide_sections
      ORDER BY sort_order, key`
  )
  cacheSet(GUIDE_CACHE_KEY, rows, GUIDE_CACHE_MS)
  return rows
}

app.get('/api/guide', async (request, response) => {
  const suffix = guideLangSuffix(request.query.lang)

  try {
    const rows = (await loadGuideSections()).filter((row) => row.is_active)
    response.json({
      success: true,
      data: rows.map((row) => ({
        key: row.key,
        icon: row.icon || 'information-circle-outline',
        // English is the fallback for a section someone has not translated yet:
        // better a member reads it in the wrong language than not at all.
        title: row[`title_${suffix}`] || row.title_en,
        body: row[`body_${suffix}`] || row.body_en,
      })),
    })
  } catch (err) {
    console.error('[guide] could not read app_guide_sections:', err.message)
    response.status(503).json({ success: false, error: 'Could not load the guide. Please try again.' })
  }
})

app.get('/api/payments/plans', async (request, response) => {
  try {
    /*
     * A signed-in member sees only the plans offered to their gender. Without
     * a session there is no one to filter for, so everything active is listed
     * with its audience, for anything that shows plans before sign-in.
     */
    const viewerId = resolveUserId(request)
    const all = await activePlans()
    let plans = all
    if (viewerId) {
      const gender = await genderOf(viewerId)
      plans = all.filter((plan) => planOpenTo(plan, gender))
    }
    response.json({
      success: true,
      data: plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        durationDays: plan.durationDays,
        pricePaise: plan.pricePaise,
        playProductId: plan.playProductId,
        badge: plan.badge,
        capabilities: plan.capabilities,
        audience: plan.audience,
        dailyProfileViews: plan.dailyProfileViews,
      })),
    })
  } catch (err) {
    console.error('[plans] list failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not load the plans' })
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

    /*
     * The price is the one on the plan, never the one the client sent.
     * createPaymentLink used to take an amount from the caller; anyone could
     * have posted their own figure and paid ₹1 for a year.
     */
    const selected = await planByCode(plan)
    if (!selected) {
      response.status(400).json({ success: false, error: 'That plan is not available.' })
      return
    }
    // Hidden in the app for the other gender, and refused here too so a
    // hand-made request cannot buy it.
    if (await refuseIfNotForMember(selected, activeUserId, response)) return
    const amount = Math.round(selected.pricePaise / 100)
    if (amount <= 0) {
      response.status(400).json({ success: false, error: 'That plan has no price set.' })
      return
    }

    // Create payment link via Razorpay API
    const linkData = {
      amount: amount * 100, // in paise
      currency: 'INR',
      accept_partial: false,
      description: `${selected.name} subscription — Chaudhary Samaj (₹${amount} / ${selected.durationDays} days)`,
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
        plan: selected.code,
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

/**
 * Deletes a member's account and everything tied to it. Shared by a member
 * deleting their own account and an admin removing one, so the two cannot
 * drift apart. Reports filed by or about the member are kept for the admin
 * record.
 */
async function deleteMemberData(userId) {
  await pgQuery('DELETE FROM matrimony_messages WHERE sender_id = $1', [userId])
  await pgQuery('DELETE FROM matrimony_interests WHERE sender_id = $1 OR receiver_id = $1', [userId])
  await pgQuery('DELETE FROM matrimony_matches WHERE user1_id = $1 OR user2_id = $1', [userId])
  await pgQuery('DELETE FROM user_subscriptions WHERE user_id = $1', [userId])
  // Both directions: the grants this member held, and anyone who was
  // granted this member's profile.
  await pgQuery(
    `DELETE FROM matrimony_free_allocations
      WHERE viewer_user_id = $1
         OR profile_id IN (SELECT id FROM matrimony_profiles WHERE user_id = $1)`,
    [userId]
  )
  await pgQuery('DELETE FROM user_settings WHERE user_id = $1', [userId])
  await pgQuery('DELETE FROM push_tokens WHERE user_id = $1', [userId])
  await pgQuery('DELETE FROM notifications WHERE user_id = $1', [userId])
  await pgQuery('DELETE FROM member_verifications WHERE user_id = $1', [userId])
  await pgQuery('DELETE FROM matrimony_profiles WHERE user_id = $1', [userId])
  await pgQuery('DELETE FROM auth_accounts WHERE user_id = $1', [userId])
  await pgQuery('DELETE FROM users WHERE id = $1', [userId])
  await pgQuery('DELETE FROM member_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1', [userId])
  cacheInvalidate(`user:${userId}`)
  cacheInvalidate(`memberPayload:${userId}`)
  invalidateFastCache('publicProfiles')
}

/**
 * Deletes every photo under the member's folder. Best effort: a storage error
 * is logged but does not stop the account itself being deleted.
 */
async function removeMemberPhotos(userId) {
  try {
    if (!useSupabaseStorage) {
      const dir = path.resolve(localUploadDir, userId)
      if (dir.startsWith(localUploadDir + path.sep)) await fs.promises.rm(dir, { recursive: true, force: true })
      return
    }
    const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${STORAGE_BUCKET}`, {
      method: 'POST',
      headers: supabaseStorageHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000 }),
    })
    if (!listRes.ok) throw new Error(`list failed: ${listRes.status}`)
    const files = (await listRes.json()).map((f) => `${userId}/${f.name}`)
    if (!files.length) return
    const delRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}`, {
      method: 'DELETE',
      headers: supabaseStorageHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: files }),
    })
    if (!delRes.ok) throw new Error(`delete failed: ${delRes.status}`)
  } catch (err) {
    console.error(`[delete account] photos of ${userId} not removed:`, err.message)
  }
}

app.delete('/api/auth/account', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  try {
    // An admin deleting their own account by mistake left the panel with no
    // admin at all (25 Oct 2026). Admin accounts cannot be deleted from the
    // app; remove admin access in the database first if it is really meant.
    const [me] = await pgQuery('SELECT is_admin FROM users WHERE id = $1 LIMIT 1', [activeUserId])
    if (me?.is_admin) {
      response.status(403).json({
        success: false,
        code: 'ADMIN_CANNOT_DELETE',
        error: 'This is an admin account and cannot be deleted from the app. Write to support@chaudharysamaj.com if it really must go.',
      })
      return
    }
    await removeMemberPhotos(activeUserId)
    await deleteMemberData(activeUserId)
    response.json({ success: true })
  } catch (err) {
    console.error('[delete account] error:', err.message)
    response.status(500).json({ success: false, error: 'Failed to delete account' })
  }
})

async function canHidePhone(userId) {
  try {
    const access = await resolveAccess(userId)
    return Boolean(access.capabilities?.canHidePhone)
  } catch {
    return false
  }
}

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
            showPhoneToConnections: true,
            showLocationPublicly: true,
            profileSearchable: true,
          },
          canHidePhone: await canHidePhone(activeUserId),
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
        // Lets the app grey the switch out instead of offering a choice the
        // server will refuse.
        canHidePhone: await canHidePhone(activeUserId),
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

  // Hiding your number is a plan feature; turning sharing back on never is.
  if (privacy.showPhoneToConnections === false && !(await canHidePhone(activeUserId))) {
    response.status(403).json({
      success: false,
      error: 'Your plan does not include hiding your phone number.',
      code: 'PLAN_NO_HIDE_PHONE',
    })
    return
  }

  try {
    await pgQuery(
      `INSERT INTO user_settings (
        user_id, language, timezone, public_profile,
        notif_community_announcements, notif_matrimony_matches,
        notif_event_reminders, notif_security_alerts, notif_marketing_updates,
        privacy_show_phone, privacy_show_location, privacy_searchable,
        updated_at
      /*
       * Defaults on insert, COALESCE on update.
       *
       * Every column here is NOT NULL, and a partial save — which is all the
       * app ever sends — passed null for the untouched ones. On a member's
       * first save there was no existing row to fall back on, so the insert
       * violated the constraint and the whole save failed with a 500. The
       * settings screen appeared to work and silently changed nothing.
       */
      ) VALUES (
        $1,
        COALESCE($2, 'en-IN'), COALESCE($3, 'Asia/Kolkata'), COALESCE($4, true),
        COALESCE($5, true), COALESCE($6, true), COALESCE($7, true),
        COALESCE($8, true), COALESCE($9, false),
        COALESCE($10, true), COALESCE($11, true), COALESCE($12, true),
        $13
      )
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

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

app.post('/api/push-tokens', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  const { token, platform } = request.body || {}
  if (!isExpoPushToken(token)) {
    response.status(400).json({ success: false, error: 'A valid Expo push token is required' })
    return
  }
  try {
    await registerPushToken(activeUserId, token, typeof platform === 'string' ? platform.slice(0, 20) : null)
    pushWelcomeIfFirstDevice(activeUserId).catch((err) => console.error('[push] welcome failed:', err.message))
    response.json({ success: true })
  } catch (err) {
    console.error('[push] register failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not register this device' })
  }
})

// Called on sign-out, so a shared phone stops receiving the last member's notifications.
app.delete('/api/push-tokens', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  const { token } = request.body || {}
  if (typeof token !== 'string') {
    response.status(400).json({ success: false, error: 'token is required' })
    return
  }
  try {
    await removePushToken(activeUserId, token)
    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: 'Could not remove this device' })
  }
})

app.get('/api/notifications', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  try {
    const rows = await pgQuery(
      `SELECT id, type, title, body, data_json, created_at, read_at
       FROM notifications WHERE user_id = $1 AND created_at >= $2
       ORDER BY created_at DESC LIMIT 100`,
      [activeUserId, notificationCutoff()]
    )
    const parse = (text) => { try { return JSON.parse(text || '{}') } catch { return {} } }
    response.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        data: parse(r.data_json),
        createdAt: r.created_at,
        read: Boolean(r.read_at),
      })),
    })
  } catch (err) {
    console.error('[notifications] list failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not load notifications' })
  }
})

/** Marks the given ids read, or all of this member's when none are given. */
app.post('/api/notifications/read', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  const { ids } = request.body || {}
  const now = new Date().toISOString()
  try {
    if (Array.isArray(ids) && ids.length) {
      await pgQuery(
        'UPDATE notifications SET read_at = $3 WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL',
        [activeUserId, ids.map(String), now]
      )
    } else {
      await pgQuery(
        'UPDATE notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL',
        [activeUserId, now]
      )
    }
    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: 'Could not update notifications' })
  }
})

const BROADCAST_AUDIENCES = new Set(['all', 'female', 'male', 'subscribers', 'free', 'plan', 'user'])

/** The member ids an admin broadcast goes to. */
async function broadcastRecipients(audience, target) {
  const live = `status = 'active' AND expires_at::timestamp > NOW()`
  let rows = []
  if (audience === 'all') {
    rows = await pgQuery('SELECT id AS user_id FROM users')
  } else if (audience === 'female' || audience === 'male') {
    rows = await pgQuery(
      'SELECT user_id FROM matrimony_profiles WHERE LOWER(TRIM(gender)) = $1',
      [audience]
    )
  } else if (audience === 'subscribers') {
    rows = await pgQuery(`SELECT DISTINCT user_id FROM user_subscriptions WHERE ${live}`)
  } else if (audience === 'free') {
    rows = await pgQuery(
      `SELECT id AS user_id FROM users
       WHERE id NOT IN (SELECT user_id FROM user_subscriptions WHERE ${live})`
    )
  } else if (audience === 'plan') {
    rows = await pgQuery(
      `SELECT DISTINCT user_id FROM user_subscriptions WHERE ${live} AND plan = $1`,
      [String(target || '')]
    )
  } else if (audience === 'user') {
    const value = String(target || '').trim()
    rows = await pgQuery(
      `SELECT id AS user_id FROM users
       WHERE LOWER(email) = LOWER($1) OR phone = $1 OR phone = RIGHT($1, 10)
       LIMIT 1`,
      [value]
    )
  }
  return rows.map((r) => r.user_id)
}

/**
 * Send a notification from the admin dashboard.
 *
 * `dryRun: true` only counts the recipients, so the dashboard can say "this
 * will reach 214 members" before anything is sent.
 */
app.post('/api/admin/notifications', requireAdmin, async (request, response) => {
  const { title, body, audience, target, dryRun } = request.body || {}
  const cleanTitle = String(title || '').trim()
  const cleanBody = String(body || '').trim()

  if (!BROADCAST_AUDIENCES.has(audience)) {
    response.status(400).json({ success: false, error: 'Choose who to send it to' })
    return
  }
  if ((audience === 'plan' || audience === 'user') && !String(target || '').trim()) {
    response.status(400).json({
      success: false,
      error: audience === 'plan' ? 'Choose a plan' : 'Enter the member\'s email or phone number',
    })
    return
  }
  if (!dryRun) {
    if (!cleanTitle || cleanTitle.length > 65) {
      response.status(400).json({ success: false, error: 'Title is required (up to 65 characters)' })
      return
    }
    if (!cleanBody || cleanBody.length > 240) {
      response.status(400).json({ success: false, error: 'Message is required (up to 240 characters)' })
      return
    }
  }

  try {
    const recipients = await broadcastRecipients(audience, target)
    if (dryRun) {
      response.json({ success: true, data: { recipients: recipients.length } })
      return
    }
    if (!recipients.length) {
      response.status(404).json({ success: false, error: 'No members match that audience' })
      return
    }

    const result = await notifyUsers(recipients, {
      type: 'announcement',
      title: cleanTitle,
      body: cleanBody,
      data: { screen: 'Notifications' },
    })

    const id = newBroadcastId()
    await pgQuery(
      `INSERT INTO notification_broadcasts
         (id, title, body, audience, target, sent_by, recipients, devices, delivered, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id, cleanTitle, cleanBody, audience, target ? String(target).trim() : null,
        resolveUserId(request), result.recipients, result.devices, result.delivered,
        new Date().toISOString(),
      ]
    )

    response.json({ success: true, data: { id, ...result } })
  } catch (err) {
    console.error('[admin/notifications] send failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not send the notification' })
  }
})

/** Runs the plan expiry check now rather than waiting for the hourly one. */
app.post('/api/admin/notifications/expiry-reminders', requireAdmin, async (_request, response) => {
  try {
    const sent = await sendPlanExpiryReminders()
    response.json({ success: true, data: { sent } })
  } catch (err) {
    console.error('[reminders] manual run failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not run the reminders' })
  }
})

app.get('/api/admin/notifications', requireAdmin, async (_request, response) => {
  try {
    const [history, devices] = await Promise.all([
      pgQuery(
        `SELECT id, title, body, audience, target, recipients, devices, delivered, created_at
         FROM notification_broadcasts ORDER BY created_at DESC LIMIT 50`
      ),
      pgQuery('SELECT COUNT(*)::int AS devices, COUNT(DISTINCT user_id)::int AS members FROM push_tokens'),
    ])
    response.json({
      success: true,
      data: {
        history: history.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          audience: r.audience,
          target: r.target,
          recipients: r.recipients,
          devices: r.devices,
          delivered: r.delivered,
          createdAt: r.created_at,
        })),
        reach: devices[0] || { devices: 0, members: 0 },
      },
    })
  } catch (err) {
    response.status(500).json({ success: false, error: 'Could not read notifications' })
  }
})

// Admin Dashboard APIs
/*
 * Subscription rules — read and write.
 *
 * Who pays and how much is data, not code, so it can change without a deploy.
 * Reading is admin-only because it is an operations screen; members see the
 * part that applies to them through /api/payments/subscription.
 */
/*
 * Reporting and blocking.
 *
 * Google's child safety standards expect an in-app way to report a member,
 * and there was none — no endpoint, no screen. Reports are queued for review
 * rather than acted on automatically; blocking takes effect immediately,
 * because that is the part the reporter needs straight away.
 */
const REPORT_REASONS = [
  'underage',
  'fake_profile',
  'harassment',
  'inappropriate_content',
  'scam',
  'other',
]

/*
 * Verification: email and Aadhaar.
 *
 * Email is proved by any correctly entered code (signup, login, reset) and
 * recorded in users.email_verified_at. Aadhaar is proved by scanning the
 * Secure QR on the member's card — see aadhaar-qr.js. Phone/SMS verification
 * is deliberately absent: it needs TRAI DLT registration.
 *
 * A genuine QR whose name, date of birth and gender match the profile is
 * verified at once. A genuine QR that does not match goes to the admin queue,
 * because nicknames and spelling are common and a person should decide.
 */
// The offer id to create in Play Console for the verified-member discount.
// The app looks for the same id; keep the two in step.
const VERIFIED_DISCOUNT_OFFER_ID = 'verified-discount'

const AADHAAR_FINGERPRINT_SECRET = process.env.AADHAAR_FINGERPRINT_SECRET || JWT_SECRET

const aadhaarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (request) => `user:${resolveUserId(request) || 'anonymous'}`,
  store: new PostgresRateLimitStore({ prefix: 'aadhaar' }),
  message: { success: false, error: 'Too many attempts. Please try again in an hour.' },
})

/** Fields a member cannot change once their Aadhaar is verified. */
const IDENTITY_LOCKED_FIELDS = ['fullName', 'dateOfBirth', 'location', 'country', 'state', 'city']

async function isIdVerified(userId) {
  const rows = await pgQuery(
    "SELECT 1 FROM member_verifications WHERE user_id = $1 AND status = 'verified' LIMIT 1",
    [userId]
  )
  return rows.length > 0
}

async function verificationSummary(userId) {
  const [userRows, idRows] = await Promise.all([
    pgQuery('SELECT email, email_verified_at FROM users WHERE id = $1 LIMIT 1', [userId]),
    pgQuery(
      `SELECT status, id_name, mismatches, submitted_at, reviewed_at, review_note
         FROM member_verifications WHERE user_id = $1 LIMIT 1`,
      [userId]
    ),
  ])
  const user = userRows[0]
  const id = idRows[0]
  const placeholderEmail = /@phone\.local$/i.test(user?.email || '')
  return {
    email: {
      address: placeholderEmail ? null : user?.email || null,
      verified: Boolean(user?.email_verified_at),
      verifiedAt: user?.email_verified_at || null,
    },
    aadhaar: {
      status: id?.status || 'none',
      nameOnId: id?.id_name || null,
      mismatches: id?.mismatches ? JSON.parse(id.mismatches) : [],
      submittedAt: id?.submitted_at || null,
      reviewedAt: id?.reviewed_at || null,
      reviewNote: id?.review_note || null,
    },
  }
}

function invalidateVerificationCaches(userId) {
  cacheInvalidate(`memberPayload:${userId}`)
  invalidateFastCache('publicProfiles')
}

app.get('/api/verification', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  try {
    response.json({ success: true, data: await verificationSummary(activeUserId) })
  } catch (err) {
    console.error('[verification] summary failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not load verification status' })
  }
})

app.post('/api/verification/aadhaar', aadhaarLimiter, async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  if (request.body?.consent !== true) {
    response.status(400).json({
      success: false,
      code: 'CONSENT_REQUIRED',
      error: 'Please agree to the Aadhaar verification terms first.',
    })
    return
  }

  try {
    const existing = await pgQuery('SELECT status FROM member_verifications WHERE user_id = $1', [activeUserId])
    if (existing[0]?.status === 'verified') {
      response.json({ success: true, data: await verificationSummary(activeUserId) })
      return
    }

    let id
    try {
      id = verifyAadhaarQr(request.body?.qr)
    } catch (err) {
      if (err instanceof AadhaarQrError) {
        const status = err.code === 'NOT_CONFIGURED' ? 503 : 400
        response.status(status).json({ success: false, code: err.code, error: err.message })
        return
      }
      throw err
    }

    const profileRows = await pgQuery(
      `SELECT u.full_name, p.date_of_birth, p.gender
         FROM users u JOIN matrimony_profiles p ON p.user_id = u.id
        WHERE u.id = $1 LIMIT 1`,
      [activeUserId]
    )
    const profile = profileRows[0]
    if (!profile) {
      response.status(404).json({ success: false, error: 'Please complete your profile first.' })
      return
    }

    const fingerprint = aadhaarFingerprint(id, AADHAAR_FINGERPRINT_SECRET)
    const taken = await pgQuery(
      `SELECT user_id FROM member_verifications
        WHERE fingerprint = $1 AND status IN ('verified', 'review') AND user_id <> $2 LIMIT 1`,
      [fingerprint, activeUserId]
    )
    // A card that belonged to a removed member cannot vouch for a new account.
    const removedCard = await pgQuery(
      'SELECT 1 FROM removed_members WHERE aadhaar_fingerprint = $1 LIMIT 1',
      [fingerprint]
    )
    if (removedCard.length) {
      console.warn(`[aadhaar] card of a removed member scanned (user ${activeUserId})`)
      response.status(403).json(REMOVED_MEMBER_ERROR)
      return
    }
    if (taken.length) {
      console.warn(`[aadhaar] card already used by another account (user ${activeUserId})`)
      response.status(409).json({
        success: false,
        code: 'AADHAAR_ALREADY_USED',
        error: 'This Aadhaar is already linked to another account. Contact support if this is your card.',
      })
      return
    }

    const mismatches = compareWithProfile(id, {
      fullName: profile.full_name,
      dateOfBirth: profile.date_of_birth,
      gender: profile.gender,
    })
    const status = mismatches.length ? 'review' : 'verified'
    const now = new Date().toISOString()

    await pgQuery(
      `INSERT INTO member_verifications
         (user_id, method, status, fingerprint, id_name, id_dob, id_gender, id_last4, mismatches,
          submitted_at, reviewed_at, reviewed_by, review_note)
       VALUES ($1, 'aadhaar_qr', $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         method = EXCLUDED.method, status = EXCLUDED.status, fingerprint = EXCLUDED.fingerprint,
         id_name = EXCLUDED.id_name, id_dob = EXCLUDED.id_dob, id_gender = EXCLUDED.id_gender,
         id_last4 = EXCLUDED.id_last4, mismatches = EXCLUDED.mismatches,
         submitted_at = EXCLUDED.submitted_at, reviewed_at = NULL, reviewed_by = NULL, review_note = NULL`,
      [
        activeUserId, status, fingerprint, id.name, id.dob || id.birthYear, id.gender, id.last4,
        JSON.stringify(mismatches), now,
      ]
    )
    invalidateVerificationCaches(activeUserId)
    console.log(`[aadhaar] user ${activeUserId} -> ${status} (QR v${id.version}, key ${id.signer})`)

    response.json({ success: true, data: await verificationSummary(activeUserId) })
  } catch (err) {
    // Two scans of one card racing past the duplicate check meet the unique index.
    if (err?.code === '23505') {
      response.status(409).json({
        success: false,
        code: 'AADHAAR_ALREADY_USED',
        error: 'This Aadhaar is already linked to another account. Contact support if this is your card.',
      })
      return
    }
    console.error('[aadhaar] verification failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not verify right now. Please try again.' })
  }
})

app.get('/api/admin/verifications', requireAdmin, async (request, response) => {
  const status = ['review', 'verified', 'rejected'].includes(request.query.status)
    ? request.query.status
    : 'review'
  try {
    const rows = await pgQuery(
      `SELECT v.user_id, v.status, v.id_name, v.id_dob, v.id_gender, v.id_last4, v.mismatches,
              v.submitted_at, v.reviewed_at, v.review_note,
              u.full_name, u.email, p.id AS profile_id, p.date_of_birth, p.gender, p.location
         FROM member_verifications v
         JOIN users u ON u.id = v.user_id
         LEFT JOIN matrimony_profiles p ON p.user_id = v.user_id
        WHERE v.status = $1
        ORDER BY v.submitted_at DESC
        LIMIT 200`,
      [status]
    )
    response.json({
      success: true,
      data: rows.map((row) => ({
        userId: row.user_id,
        profileId: row.profile_id,
        status: row.status,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        reviewNote: row.review_note,
        mismatches: row.mismatches ? JSON.parse(row.mismatches) : [],
        onId: { name: row.id_name, dob: row.id_dob, gender: row.id_gender, last4: row.id_last4 },
        onProfile: {
          name: row.full_name,
          email: row.email,
          dob: row.date_of_birth,
          gender: row.gender,
          location: row.location,
        },
      })),
    })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.put('/api/admin/verifications/:userId', requireAdmin, async (request, response) => {
  const decision = String(request.body?.decision || '')
  if (!['approve', 'reject', 'revoke'].includes(decision)) {
    response.status(400).json({ success: false, error: 'decision must be approve, reject or revoke' })
    return
  }
  const note = String(request.body?.note || '').trim().slice(0, 500) || null
  const status = decision === 'approve' ? 'verified' : 'rejected'
  try {
    const rows = await pgQuery(
      `UPDATE member_verifications
          SET status = $1, reviewed_at = $2, reviewed_by = $3, review_note = $4
        WHERE user_id = $5
        RETURNING user_id`,
      [status, new Date().toISOString(), resolveUserId(request), note, request.params.userId]
    )
    if (!rows.length) {
      response.status(404).json({ success: false, error: 'No verification for this member' })
      return
    }
    invalidateVerificationCaches(request.params.userId)
    response.json({ success: true, data: { userId: request.params.userId, status } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/matrimony/profiles/:id/report', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const reason = String(request.body?.reason || '').trim().toLowerCase()
  const details = String(request.body?.details || '').trim().slice(0, 2000)

  if (!REPORT_REASONS.includes(reason)) {
    response.status(400).json({
      success: false,
      error: `Reason must be one of: ${REPORT_REASONS.join(', ')}`,
    })
    return
  }

  try {
    const rows = await pgQuery(
      'SELECT user_id FROM matrimony_profiles WHERE id = $1 LIMIT 1',
      [request.params.id]
    )
    const reportedUserId = rows[0]?.user_id
    if (!reportedUserId) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }
    if (reportedUserId === activeUserId) {
      response.status(400).json({ success: false, error: 'You cannot report your own profile' })
      return
    }

    await pgQuery(
      `INSERT INTO member_reports (id, reporter_user_id, reported_user_id, reason, details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       ON CONFLICT (reporter_user_id, reported_user_id) DO UPDATE SET
         reason = EXCLUDED.reason,
         details = EXCLUDED.details,
         status = 'open',
         created_at = EXCLUDED.created_at`,
      [`report-${crypto.randomUUID()}`, activeUserId, reportedUserId, reason, details || null, new Date().toISOString()]
    )

    // Reporting someone you do not want to see again should also stop showing
    // them to you, without a second step.
    await pgQuery(
      `INSERT INTO member_blocks (blocker_user_id, blocked_user_id, created_at)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [activeUserId, reportedUserId, new Date().toISOString()]
    )

    console.warn(`[report] ${reason} filed against ${reportedUserId}`)
    invalidateFastCache('publicProfiles')
    response.status(201).json({
      success: true,
      data: { message: 'Thank you. Our team will review this, and the member is now hidden from you.' },
    })
  } catch (err) {
    console.error('[report] failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not submit the report' })
  }
})

app.post('/api/matrimony/profiles/:id/block', async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    const rows = await pgQuery(
      'SELECT user_id FROM matrimony_profiles WHERE id = $1 LIMIT 1',
      [request.params.id]
    )
    const blockedUserId = rows[0]?.user_id
    if (!blockedUserId) {
      response.status(404).json({ success: false, error: 'Profile not found' })
      return
    }
    if (blockedUserId === activeUserId) {
      response.status(400).json({ success: false, error: 'You cannot block yourself' })
      return
    }

    await pgQuery(
      `INSERT INTO member_blocks (blocker_user_id, blocked_user_id, created_at)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [activeUserId, blockedUserId, new Date().toISOString()]
    )
    invalidateFastCache('publicProfiles')
    response.json({ success: true, data: { blocked: true } })
  } catch (err) {
    console.error('[block] failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not block this member' })
  }
})

/** The review queue. */
app.get('/api/admin/reports', requireAdmin, async (_request, response) => {
  try {
    const rows = await pgQuery(
      `SELECT r.id, r.reason, r.details, r.status, r.created_at,
              reporter.email AS reporter_email,
              COALESCE(reported.email, removed.email) AS reported_email,
              r.reported_user_id,
              (removed.user_id IS NOT NULL) AS reported_removed
       FROM member_reports r
       LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
       LEFT JOIN users reported ON reported.id = r.reported_user_id
       LEFT JOIN removed_members removed ON removed.user_id = r.reported_user_id
       ORDER BY (r.status = 'open') DESC, r.created_at DESC
       LIMIT 200`
    )
    response.json({ success: true, data: rows })
  } catch (err) {
    console.error('[admin/reports] read failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not read reports' })
  }
})

app.put('/api/admin/reports/:id', requireAdmin, async (request, response) => {
  const status = String(request.body?.status || '').trim().toLowerCase()
  if (!['open', 'actioned', 'dismissed'].includes(status)) {
    response.status(400).json({ success: false, error: 'Status must be open, actioned or dismissed' })
    return
  }

  try {
    const rows = await pgQuery(
      `UPDATE member_reports SET status = $2, reviewed_at = $3 WHERE id = $1
       RETURNING id, status, reviewed_at`,
      [request.params.id, status, new Date().toISOString()]
    )
    if (!rows.length) {
      response.status(404).json({ success: false, error: 'Report not found' })
      return
    }
    response.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error('[admin/reports] update failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not update the report' })
  }
})

app.get('/api/admin/play/health', requireAdmin, async (_request, response) => {
  try {
    response.json({ success: true, data: await describePlayBillingHealth() })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/admin/subscription-rules', requireAdmin, async (_request, response) => {
  try {
    const rows = await pgQuery(
      `SELECT gender, is_free, price_paise, free_profile_limit,
              can_view_phone, can_send_interest, can_chat, updated_at
       FROM subscription_rules ORDER BY gender`
    )
    response.json({ success: true, data: rows })
  } catch (err) {
    console.error('[admin/rules] read failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not read subscription rules' })
  }
})

app.put('/api/admin/subscription-rules/:gender', requireAdmin, async (request, response) => {
  const gender = String(request.params.gender || '').trim().toLowerCase()
  if (!['male', 'female'].includes(gender)) {
    response.status(400).json({ success: false, error: 'Gender must be male or female' })
    return
  }

  const { isFree, pricePaise, freeProfileLimit, canViewPhone, canSendInterest, canChat } =
    request.body || {}

  if (isFree !== undefined && typeof isFree !== 'boolean') {
    response.status(400).json({ success: false, error: 'isFree must be true or false' })
    return
  }
  if (pricePaise !== undefined && (!Number.isInteger(pricePaise) || pricePaise < 0)) {
    response.status(400).json({ success: false, error: 'pricePaise must be a whole number of paise' })
    return
  }
  if (
    freeProfileLimit !== undefined &&
    (!Number.isInteger(freeProfileLimit) || freeProfileLimit < 0)
  ) {
    response.status(400).json({ success: false, error: 'freeProfileLimit must be zero or more' })
    return
  }
  for (const [label, value] of [
    ['canViewPhone', canViewPhone],
    ['canSendInterest', canSendInterest],
    ['canChat', canChat],
  ]) {
    if (value !== undefined && typeof value !== 'boolean') {
      response.status(400).json({ success: false, error: `${label} must be true or false` })
      return
    }
  }

  try {
    const rows = await pgQuery(
      `INSERT INTO subscription_rules
         (gender, is_free, price_paise, free_profile_limit,
          can_view_phone, can_send_interest, can_chat, updated_at)
       VALUES ($1, COALESCE($2, false), COALESCE($3, 20000), COALESCE($4, 2),
               COALESCE($5, true), COALESCE($6, true), COALESCE($7, true), NOW()::text)
       ON CONFLICT (gender) DO UPDATE SET
         is_free = COALESCE($2, subscription_rules.is_free),
         price_paise = COALESCE($3, subscription_rules.price_paise),
         free_profile_limit = COALESCE($4, subscription_rules.free_profile_limit),
         can_view_phone = COALESCE($5, subscription_rules.can_view_phone),
         can_send_interest = COALESCE($6, subscription_rules.can_send_interest),
         can_chat = COALESCE($7, subscription_rules.can_chat),
         updated_at = NOW()::text
       RETURNING gender, is_free, price_paise, free_profile_limit,
                 can_view_phone, can_send_interest, can_chat, updated_at`,
      [
        gender,
        isFree === undefined ? null : isFree,
        pricePaise === undefined ? null : pricePaise,
        freeProfileLimit === undefined ? null : freeProfileLimit,
        canViewPhone === undefined ? null : canViewPhone,
        canSendInterest === undefined ? null : canSendInterest,
        canChat === undefined ? null : canChat,
      ]
    )

    // Drop the cache so the change is live on the next request rather than up
    // to 30 seconds later.
    invalidateSubscriptionRules()
    console.log(`[admin/rules] ${gender} updated: ${JSON.stringify(rows[0])}`)
    response.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error('[admin/rules] write failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not update subscription rules' })
  }
})

/* ------------------------------------------------------------------ */
/* Admin: subscription plans                                           */
/* ------------------------------------------------------------------ */

app.get('/api/admin/guide', requireAdmin, async (_request, response) => {
  try {
    const rows = await pgQuery(
      `SELECT key, icon, title_en, title_hi, title_gu, body_en, body_hi, body_gu,
              is_active, sort_order, updated_at
         FROM app_guide_sections
        ORDER BY sort_order, key`
    )
    response.json({ success: true, data: rows })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.put('/api/admin/guide/:key', requireAdmin, async (request, response) => {
  const key = String(request.params.key || '').trim().toLowerCase()
  if (!/^[a-z0-9_-]{2,40}$/.test(key)) {
    response.status(400).json({ success: false, error: 'Key must be 2-40 characters: letters, numbers, - or _' })
    return
  }

  const body = request.body || {}
  const text = (value) => String(value ?? '').trim()

  // Every language is required. A section saved with two of the three filled in
  // would quietly serve English to whoever speaks the missing one, and nothing
  // in the app would ever say so.
  const fields = {
    title_en: text(body.title_en), title_hi: text(body.title_hi), title_gu: text(body.title_gu),
    body_en: text(body.body_en), body_hi: text(body.body_hi), body_gu: text(body.body_gu),
  }
  const missing = Object.entries(fields).filter(([, value]) => !value).map(([name]) => name)
  if (missing.length) {
    response.status(400).json({ success: false, error: `Missing: ${missing.join(', ')}` })
    return
  }

  try {
    await pgQuery(
      `INSERT INTO app_guide_sections
         (key, icon, title_en, title_hi, title_gu, body_en, body_hi, body_gu, is_active, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (key) DO UPDATE SET
         icon = EXCLUDED.icon,
         title_en = EXCLUDED.title_en, title_hi = EXCLUDED.title_hi, title_gu = EXCLUDED.title_gu,
         body_en = EXCLUDED.body_en, body_hi = EXCLUDED.body_hi, body_gu = EXCLUDED.body_gu,
         is_active = EXCLUDED.is_active,
         sort_order = EXCLUDED.sort_order,
         updated_at = EXCLUDED.updated_at`,
      [
        key,
        text(body.icon) || 'information-circle-outline',
        fields.title_en, fields.title_hi, fields.title_gu,
        fields.body_en, fields.body_hi, fields.body_gu,
        body.is_active === undefined ? true : Boolean(body.is_active),
        Number.isFinite(Number(body.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0,
        new Date().toISOString(),
      ]
    )
    cacheInvalidate(GUIDE_CACHE_KEY)
    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.delete('/api/admin/guide/:key', requireAdmin, async (request, response) => {
  try {
    await pgQuery('DELETE FROM app_guide_sections WHERE key = $1', [String(request.params.key)])
    cacheInvalidate(GUIDE_CACHE_KEY)
    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/admin/plans', requireAdmin, async (_request, response) => {
  try {
    const rows = await pgQuery(
      `SELECT code, name, duration_days, price_paise, play_product_id, badge,
              is_active, sort_order, can_view_phone, can_send_interest, can_chat, can_view_phone_unmatched, can_hide_phone, audience,
              daily_profile_views, updated_at
       FROM subscription_plans
       ORDER BY sort_order, price_paise`
    )
    response.json({ success: true, data: rows.map(planFromRow) })
  } catch (err) {
    console.error('[admin/plans] read failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not read the plans' })
  }
})

/**
 * Create or update one plan.
 *
 * The code is the primary key and ends up in user_subscriptions.plan, so an
 * existing code updates in place and the shape of it is restricted — it also
 * travels in a Razorpay payment link's notes.
 */
app.put('/api/admin/plans/:code', requireAdmin, async (request, response) => {
  const code = String(request.params.code || '').trim().toLowerCase()
  if (!/^[a-z0-9_]{2,40}$/.test(code)) {
    response.status(400).json({
      success: false,
      error: 'Code must be 2-40 characters of lowercase letters, numbers or underscores',
    })
    return
  }

  const {
    name, durationDays, pricePaise, playProductId, badge, isActive, sortOrder,
    canViewPhone, canSendInterest, canChat, canViewPhoneUnmatched, canHidePhone, audience,
    dailyProfileViews,
  } = request.body || {}

  // undefined = leave as is; null or 0 = unlimited; otherwise a daily cap.
  if (dailyProfileViews !== undefined && dailyProfileViews !== null &&
      (!Number.isInteger(dailyProfileViews) || dailyProfileViews < 0 || dailyProfileViews > 10000)) {
    response.status(400).json({ success: false, error: 'Profile views per day must be a whole number (empty for unlimited)' })
    return
  }

  if (audience !== undefined && !PLAN_AUDIENCES.has(audience)) {
    response.status(400).json({ success: false, error: "audience must be 'all', 'female' or 'male'" })
    return
  }

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) {
    response.status(400).json({ success: false, error: 'Name is required (up to 40 characters)' })
    return
  }
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    response.status(400).json({ success: false, error: 'Duration must be between 1 and 3650 days' })
    return
  }
  if (!Number.isInteger(pricePaise) || pricePaise < 0) {
    response.status(400).json({ success: false, error: 'Price must be a whole number of paise' })
    return
  }
  if (playProductId !== undefined && playProductId !== null && typeof playProductId !== 'string') {
    response.status(400).json({ success: false, error: 'Play product id must be text' })
    return
  }
  if (badge !== undefined && badge !== null && typeof badge !== 'string') {
    response.status(400).json({ success: false, error: 'Badge must be text' })
    return
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    response.status(400).json({ success: false, error: 'isActive must be true or false' })
    return
  }
  if (sortOrder !== undefined && !Number.isInteger(sortOrder)) {
    response.status(400).json({ success: false, error: 'sortOrder must be a whole number' })
    return
  }
  for (const [label, value] of [
    ['canViewPhone', canViewPhone],
    ['canSendInterest', canSendInterest],
    ['canChat', canChat],
    ['canViewPhoneUnmatched', canViewPhoneUnmatched],
    ['canHidePhone', canHidePhone],
  ]) {
    if (value !== undefined && typeof value !== 'boolean') {
      response.status(400).json({ success: false, error: `${label} must be true or false` })
      return
    }
  }

  // Empty string and null both mean "sells through Razorpay only". Storing it
  // as NULL keeps the unique index from treating two such plans as a clash.
  const productId = String(playProductId || '').trim() || null

  try {
    const rows = await pgQuery(
      `INSERT INTO subscription_plans
         (code, name, duration_days, price_paise, play_product_id, badge,
          is_active, sort_order, can_view_phone, can_send_interest, can_chat, can_view_phone_unmatched, can_hide_phone, audience,
          daily_profile_views, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), COALESCE($8, 0),
               COALESCE($9, true), COALESCE($10, true), COALESCE($11, true), COALESCE($13, false), COALESCE($14, false), COALESCE($12, 'all'),
               $15, NOW()::text)
       ON CONFLICT (code) DO UPDATE SET
         name = $2,
         duration_days = $3,
         price_paise = $4,
         play_product_id = $5,
         badge = $6,
         is_active = COALESCE($7, subscription_plans.is_active),
         sort_order = COALESCE($8, subscription_plans.sort_order),
         can_view_phone = COALESCE($9, subscription_plans.can_view_phone),
         can_send_interest = COALESCE($10, subscription_plans.can_send_interest),
         can_chat = COALESCE($11, subscription_plans.can_chat),
         can_view_phone_unmatched = COALESCE($13, subscription_plans.can_view_phone_unmatched),
         can_hide_phone = COALESCE($14, subscription_plans.can_hide_phone),
         audience = COALESCE($12, subscription_plans.audience),
         daily_profile_views = CASE WHEN $16 THEN $15 ELSE subscription_plans.daily_profile_views END,
         updated_at = NOW()::text
       RETURNING code, name, duration_days, price_paise, play_product_id, badge,
                 is_active, sort_order, can_view_phone, can_send_interest, can_chat, can_view_phone_unmatched, can_hide_phone, audience,
                 daily_profile_views, updated_at`,
      [
        code,
        name.trim(),
        durationDays,
        pricePaise,
        productId,
        String(badge || '').trim() || null,
        isActive === undefined ? null : isActive,
        sortOrder === undefined ? null : sortOrder,
        canViewPhone === undefined ? null : canViewPhone,
        canSendInterest === undefined ? null : canSendInterest,
        canChat === undefined ? null : canChat,
        audience === undefined ? null : audience,
        canViewPhoneUnmatched === undefined ? null : canViewPhoneUnmatched,
        canHidePhone === undefined ? null : canHidePhone,
        dailyProfileViews ? dailyProfileViews : null,
        dailyProfileViews !== undefined,
      ]
    )

    invalidatePlans()
    response.json({ success: true, data: planFromRow(rows[0]) })
  } catch (err) {
    if (/subscription_plans_play_product_key/.test(err.message)) {
      response.status(409).json({
        success: false,
        error: 'Another plan already uses that Play product id',
      })
      return
    }
    console.error('[admin/plans] write failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not save the plan' })
  }
})

/**
 * Retire a plan.
 *
 * Deactivates rather than deletes when anyone holds a subscription on it:
 * user_subscriptions.plan stores the code, and removing the row would leave
 * those records pointing at nothing and their renewals undatable.
 */
app.delete('/api/admin/plans/:code', requireAdmin, async (request, response) => {
  const code = String(request.params.code || '').trim().toLowerCase()
  try {
    const inUse = await pgQuery(
      'SELECT 1 FROM user_subscriptions WHERE plan = $1 LIMIT 1',
      [code]
    )

    if (inUse.length > 0) {
      await pgQuery(
        `UPDATE subscription_plans SET is_active = false, updated_at = NOW()::text WHERE code = $1`,
        [code]
      )
      invalidatePlans()
      response.json({
        success: true,
        data: { code, removed: false, deactivated: true },
      })
      return
    }

    await pgQuery('DELETE FROM subscription_plans WHERE code = $1', [code])
    invalidatePlans()
    response.json({ success: true, data: { code, removed: true, deactivated: false } })
  } catch (err) {
    console.error('[admin/plans] delete failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not remove the plan' })
  }
})

/** A subscription row that was paid for, as opposed to granted access. */
const PAID_SUBSCRIPTION_SQL = `(provider = 'google_play' OR payment_id LIKE 'pay\\_%')`

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

    /*
     * Active subscriptions, split into paid and free access. Only a Google Play
     * purchase (or a real Razorpay payment, pay_…) is money. The Play
     * reviewer's access and old test rows are also "active" rows, and the
     * reviewer's carries an amount of 20000 from older code, so summing every
     * active row showed ₹20,050 when ₹50 had been paid.
     */
    const activeSubscriptionsResult = await pgQuery(`
      SELECT
        COUNT(*) FILTER (WHERE ${PAID_SUBSCRIPTION_SQL})::int AS count,
        COALESCE(SUM(amount) FILTER (WHERE ${PAID_SUBSCRIPTION_SQL}), 0)::int AS totalrevenue,
        COUNT(*) FILTER (WHERE NOT ${PAID_SUBSCRIPTION_SQL})::int AS freeaccess
      FROM user_subscriptions
      WHERE status = 'active' AND expires_at::timestamp > NOW()
    `)
    const activePremium = activeSubscriptionsResult[0]?.count || 0
    const totalRevenue = activeSubscriptionsResult[0]?.totalrevenue || 0
    const freeAccess = activeSubscriptionsResult[0]?.freeaccess || 0

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
        freeAccess,
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
        u.id, u.full_name, u.email, u.phone, u.created_at, u.is_admin,
        (SELECT COUNT(*)::int FROM member_reports r WHERE r.reported_user_id = u.id) AS report_count,
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

/* ------------------------------------------------------------------ */
/* Support tickets (mail to support@ via Brevo inbound parsing)        */
/* ------------------------------------------------------------------ */

/*
 * The Gmail Apps Script (support/gmail-forwarder.gs) posts support mail here.
 * The URL carries a secret token (SUPPORT_INBOUND_TOKEN) the way the Play
 * RTDN hook does; without the variable the hook is closed to everyone.
 */
function isValidSupportToken(provided) {
  const expected = process.env.SUPPORT_INBOUND_TOKEN || ''
  if (!expected) return false
  const a = Buffer.from(String(provided || ''))
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

app.post('/api/support/inbound', async (request, response) => {
  if (!isValidSupportToken(request.query.token)) {
    response.status(403).json({ success: false, error: 'Forbidden' })
    return
  }
  const items = Array.isArray(request.body?.items) ? request.body.items : []
  const results = []
  for (const item of items) {
    try {
      results.push(await handleInboundMail(item))
    } catch (err) {
      // One bad mail must not make Brevo retry the whole batch forever.
      console.error('[support] inbound mail failed:', err.message)
      results.push({ action: 'error' })
    }
  }
  response.json({ success: true, data: results })
})

app.get('/api/admin/support/tickets', requireAdmin, async (request, response) => {
  try {
    response.json({ success: true, data: await listTickets(String(request.query.status || '')) })
  } catch (err) {
    console.error('[support] list failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not load tickets' })
  }
})

app.get('/api/admin/support/tickets/:id', requireAdmin, async (request, response) => {
  try {
    const found = await getTicket(request.params.id)
    if (!found) {
      response.status(404).json({ success: false, error: 'Ticket not found' })
      return
    }
    response.json({ success: true, data: found })
  } catch (err) {
    console.error('[support] read failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not load the ticket' })
  }
})

app.post('/api/admin/support/tickets/:id/reply', requireAdmin, async (request, response) => {
  const message = String(request.body?.message || '').trim()
  if (!message) {
    response.status(400).json({ success: false, error: 'Write a reply first' })
    return
  }
  try {
    const result = await replyToTicket(request.params.id, message, { close: Boolean(request.body?.close) })
    if (!result) {
      response.status(404).json({ success: false, error: 'Ticket not found' })
      return
    }
    if (!result.sent) {
      response.status(502).json({ success: false, error: 'The email could not be sent. It is saved on the ticket; try again.' })
      return
    }
    response.json({ success: true, data: result })
  } catch (err) {
    console.error('[support] reply failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not send the reply' })
  }
})

app.put('/api/admin/support/tickets/:id', requireAdmin, async (request, response) => {
  try {
    const updated = await setTicketStatus(request.params.id, String(request.body?.status || ''))
    if (!updated) {
      response.status(400).json({ success: false, error: 'Status must be open, waiting or closed' })
      return
    }
    response.json({ success: true, data: updated })
  } catch (err) {
    response.status(500).json({ success: false, error: 'Could not update the ticket' })
  }
})

/** Blocks a ticket's sender (or their domain); their later mail never becomes a ticket. */
app.post('/api/admin/support/tickets/:id/block', requireAdmin, async (request, response) => {
  try {
    const result = await blockTicketSender(request.params.id, {
      domain: Boolean(request.body?.domain),
      reason: String(request.body?.reason || '').slice(0, 300) || null,
    })
    if (result.error) {
      response.status(result.status).json({ success: false, error: result.error })
      return
    }
    response.json({ success: true, data: result })
  } catch (err) {
    console.error('[support] block failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not block the sender' })
  }
})

app.get('/api/admin/support/blocked', requireAdmin, async (_request, response) => {
  try {
    response.json({ success: true, data: await listBlockedSenders() })
  } catch (err) {
    response.status(500).json({ success: false, error: 'Could not load blocked senders' })
  }
})

app.delete('/api/admin/support/blocked/:pattern', requireAdmin, async (request, response) => {
  try {
    const removed = await unblockSender(request.params.pattern)
    response.status(removed ? 200 : 404).json(removed ? { success: true } : { success: false, error: 'Not blocked' })
  } catch (err) {
    response.status(500).json({ success: false, error: 'Could not unblock' })
  }
})

/**
 * Runs the milestone / capacity check now and emails a summary even if nothing
 * is due, so the admin can see the alerts reach their inbox.
 */
app.post('/api/admin/alerts/check', requireAdmin, async (_request, response) => {
  try {
    response.json({ success: true, data: await runAdminAlerts({ force: true }) })
  } catch (err) {
    console.error('[admin-alerts] manual check failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not run the check' })
  }
})

/**
 * Removes a member completely: account, profile, photos, chats and
 * verification are deleted, open reports about them are closed as actioned,
 * and their email, phone and Aadhaar go on the removed list so they cannot
 * sign up again. For members who keep breaking the rules after a warning.
 *
 * A Google Play subscription is not cancelled by this — Google keeps charging
 * until it is cancelled or refunded in Play Console — so the response hands
 * back the order id for the admin to do that.
 */
app.delete('/api/admin/users/:id', requireAdmin, async (request, response) => {
  const adminId = resolveUserId(request)
  const userId = String(request.params.id || '')
  const reason = String(request.body?.reason || '').trim().slice(0, 500)
  if (!reason) {
    response.status(400).json({ success: false, error: 'Write down why this member is being removed' })
    return
  }
  if (userId === adminId) {
    response.status(400).json({ success: false, error: 'You cannot remove your own account here' })
    return
  }

  try {
    const rows = await pgQuery(
      `SELECT u.id, u.email, u.phone, u.full_name, u.is_admin, v.fingerprint
         FROM users u LEFT JOIN member_verifications v ON v.user_id = u.id
        WHERE u.id = $1 LIMIT 1`,
      [userId]
    )
    const member = rows[0]
    if (!member) {
      response.status(404).json({ success: false, error: 'Member not found' })
      return
    }
    if (member.is_admin) {
      response.status(400).json({ success: false, error: 'This is an admin account; remove admin access first' })
      return
    }

    const now = new Date().toISOString()
    const subs = await pgQuery(
      `SELECT plan, order_id, expires_at, play_purchase_token FROM user_subscriptions
        WHERE user_id = $1 AND status = 'active' AND expires_at > $2 LIMIT 1`,
      [userId, now]
    )
    const phone = String(member.phone || '').replace(/\D/g, '').slice(-10)

    await pgQuery(
      `INSERT INTO removed_members
         (user_id, email, phone, aadhaar_fingerprint, full_name, reason, removed_by, removed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, removed_at = EXCLUDED.removed_at`,
      [
        userId, String(member.email || '').trim().toLowerCase() || null, phone.length === 10 ? phone : null,
        member.fingerprint || null, member.full_name || null, reason, adminId, now,
      ]
    )
    await pgQuery(
      `UPDATE member_reports SET status = 'actioned', reviewed_at = $2
        WHERE reported_user_id = $1 AND status = 'open'`,
      [userId, now]
    )
    await removeMemberPhotos(userId)
    await deleteMemberData(userId)
    console.log(`[admin] member ${userId} removed by ${adminId}: ${reason}`)

    const sub = subs[0]
    response.json({
      success: true,
      data: {
        removed: true,
        activeSubscription: sub
          ? { plan: sub.plan, orderId: sub.order_id, expiresAt: sub.expires_at, viaPlay: Boolean(sub.play_purchase_token) }
          : null,
      },
    })
  } catch (err) {
    console.error('[admin] remove member failed:', err.message)
    response.status(500).json({ success: false, error: 'Could not remove this member' })
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
  startPlanExpiryReminders()
  startNotificationPruning()
  startKeepAlive()
  startAdminAlerts()
  console.log(`Matrimony backend listening on http://localhost:${port}`)
  warmUpPool()
})
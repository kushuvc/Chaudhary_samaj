import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import multer from 'multer'
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

// Simple in-memory cache with TTL for expensive per-user queries
const _cache = new Map()
function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null }
  return entry.value
}
function cacheSet(key, value, ttlMs = 5000) {
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}
function cacheInvalidate(prefix) {
  for (const key of _cache.keys()) { if (key.startsWith(prefix)) _cache.delete(key) }
}

function pgHashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const digest = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${digest}`
}
function pgVerifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, digest] = storedHash.split(':')
  const candidate = crypto.scryptSync(password, salt, 64)
  const stored = Buffer.from(digest, 'hex')
  if (candidate.length !== stored.length) return false
  return crypto.timingSafeEqual(candidate, stored)
}

const app = express()
const port = process.env.PORT || 3000
const OTP_SEND_TIMEOUT_MS = Number(process.env.OTP_SEND_TIMEOUT_MS || 25000)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

function isGmailAddress(email) {
  return /^[^\s@]+@gmail\.com$/i.test(String(email || '').trim())
}

function resolveUserId(request) {
  const headerUserId = request.header('x-user-id')
  if (!headerUserId) return null
  const ck = `user:${headerUserId}`
  let exists = cacheGet(ck)
  if (exists === null) {
    exists = userExists(headerUserId) ? true : false
    cacheSet(ck, exists, 300000) // 5 min TTL
  }
  return exists ? headerUserId : null
}

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body || {}

  if (!email || !password) {
    response.status(400).json({ success: false, error: 'Email and password are required' })
    return
  }

  if (!isGmailAddress(email)) {
    response.status(400).json({ success: false, error: 'Only Gmail addresses are allowed' })
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
    if (!row || !pgVerifyPassword(String(password), row.password_hash)) {
      response.status(401).json({ success: false, error: 'Account not found or incorrect password. Please check your credentials and try again.' })
      return
    }
    const user = { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row.full_name || row.email)}` }
    cacheSet(`user:${row.id}`, true, 300000)
    response.json({ success: true, data: { user, authToken: user.id } })
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
  } = request.body || {}

  if (!fullName || !email || !password) {
    response.status(400).json({ success: false, error: 'Name, email and password are required' })
    return
  }

  if (!isGmailAddress(email)) {
    response.status(400).json({ success: false, error: 'Only Gmail addresses are allowed' })
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
    const existing = await pgQuery('SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1', [String(email).trim()])
    if (existing.length > 0) {
      response.status(409).json({ success: false, error: 'Email already registered' })
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
        ? Math.max(18, Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
        : 25
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(fullName).trim())}`

    await pgQuery(
      'INSERT INTO users (id, email, full_name, phone, avatar_url, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)',
      [userId, String(email).trim().toLowerCase(), String(fullName).trim(), phone || null, avatarUrl, createdAt]
    )
    await pgQuery(
      'INSERT INTO auth_accounts (user_id, password_hash, created_at, updated_at) VALUES ($1,$2,$3,$3)',
      [userId, pgHashPassword(String(password)), createdAt]
    )
    await pgQuery(
      `INSERT INTO matrimony_profiles
        (id, user_id, date_of_birth, age, gender, location, community, sub_community, education, occupation, bio,
         marital_status, height, income, language, compatibility_score, is_unlocked, is_shortlisted, is_viewed,
         native_city, native_village, family_status, family_type, family_wealth,
         father_name, mother_name, father_occupation, mother_occupation, siblings,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$30)`,
      [
        profileId, userId, dateOfBirth || null, calcAge,
        safeStr(gender, 'unspecified'),
        safeStr(city || location),
        safeStr(community || caste, 'Chaudhary'),
        safeStr(subCommunity),
        safeStr(education),
        safeStr(occupation),
        'New member profile. Please update details in Profile section.',
        safeStr(maritalStatus, 'Never Married'),
        safeStr(height),
        '',
        safeStr(language, 'Hindi'),
        0, 1, 0, 0,
        safeStr(nativeCity),
        safeStr(nativeVillage),
        safeStr(familyStatus),
        safeStr(familyType),
        safeStr(familyWealth),
        safeStr(fatherName),
        safeStr(motherName),
        safeStr(fatherOccupation),
        safeStr(motherOccupation),
        safeStr(siblings),
        createdAt,
      ]
    )

    const user = { id: userId, fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(), phone: phone || null, avatar: avatarUrl }
    cacheSet(`user:${userId}`, true, 300000)
    response.status(201).json({ success: true, data: { user, authToken: userId } })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/auth/otp/request', async (request, response) => {
  const { email, purpose } = request.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  const routeStart = Date.now()
  if (!normalizedEmail || !normalizedPurpose) {
    response.status(400).json({ success: false, error: 'Email and purpose are required' })
    return
  }

  if (!isGmailAddress(normalizedEmail)) {
    response.status(400).json({ success: false, error: 'Only Gmail addresses are allowed' })
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

    response.json({
      success: true,
      data: {
        email: normalizedEmail,
        purpose: normalizedPurpose,
        expiresAt: otpRequest.data.expiresAt,
        sentViaFallback: Boolean(sendResult.fallback),
        ...(process.env.NODE_ENV !== 'production' || sendResult.fallback ? { debugOtp: otpRequest.data.otpCode } : {}),
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

    // On timeout or any error, fallback to returning OTP in dev mode
    if (error?.message?.includes('timeout') || process.env.NODE_ENV !== 'production') {
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

app.get('/api/community/posts', async (request, response) => {
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
  } catch {
    // fall back to legacy query path
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

app.get('/api/community/meetings', (_request, response) => {
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

app.get('/api/community/stats', async (_request, response) => {
  try {
    const fastData = await getCommunityFeedStatsFast()
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch {
    // fall back to legacy query path
  }

  response.json({ success: true, data: getCommunityFeedStats() })
})

app.get('/api/business/listings', async (_request, response) => {
  try {
    const fastData = await getBusinessListingsFast()
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch {
    // fall back to legacy query path
  }

  response.json({ success: true, data: getBusinessListings() })
})

app.get('/api/business/listings/:id', (request, response) => {
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
  } catch {
    // fall back to legacy query path
  }

  response.json({
    success: true,
    data: getHelpRequests(payload),
  })
})

app.get('/api/help-requests/:id', (request, response) => {
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
    response.json({ success: true, data: [] })
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
    const matchesGender = !gender || profile.gender === gender
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
      (tab === 'locked' && !profile.isUnlocked)

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

  response.json({ success: true, data: profiles })
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
  } catch {
    // fall back to legacy query path
  }

  response.json({ success: true, data: getMatrimonyFilterOptions(activeUserId) })
})

app.get('/api/matrimony/profiles/:id', async (request, response) => {
  const activeUserId = resolveUserId(request)
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

  response.json({ success: true, data: profile })
})

app.post('/api/matrimony/profiles/:id/shortlist', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const profile = database.prepare('SELECT id, is_shortlisted FROM matrimony_profiles WHERE id = ?').get(request.params.id)

  if (!profile) {
    response.status(404).json({ success: false, error: 'Profile not found' })
    return
  }

  const state = database
    .prepare(
      'SELECT is_shortlisted FROM matrimony_profile_states WHERE profile_id = ? AND viewer_user_id = ? LIMIT 1'
    )
    .get(request.params.id, activeUserId)
  const nextValue = state?.is_shortlisted ? 0 : 1
  updateProfileState(request.params.id, activeUserId, { is_shortlisted: nextValue })
  recordProfileAction({
    profileId: request.params.id,
    actorUserId: activeUserId,
    actionType: 'shortlist',
    metadata: { shortlisted: Boolean(nextValue) },
  })

  response.json({ success: true, data: { shortlisted: Boolean(nextValue) } })
})

app.post('/api/matrimony/profiles/:id/view', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const profile = database.prepare('SELECT id FROM matrimony_profiles WHERE id = ?').get(request.params.id)

  if (!profile) {
    response.status(404).json({ success: false, error: 'Profile not found' })
    return
  }

  updateProfileState(request.params.id, activeUserId, { is_viewed: 1 })
  recordProfileAction({
    profileId: request.params.id,
    actorUserId: activeUserId,
    actionType: 'view',
  })

  response.json({ success: true })
})

app.post('/api/matrimony/profiles/:id/unlock', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const profile = database.prepare('SELECT id FROM matrimony_profiles WHERE id = ?').get(request.params.id)

  if (!profile) {
    response.status(404).json({ success: false, error: 'Profile not found' })
    return
  }

  updateProfileState(request.params.id, activeUserId, { is_unlocked: 1 })
  recordProfileAction({
    profileId: request.params.id,
    actorUserId: activeUserId,
    actionType: 'unlock',
    metadata: { paymentStatus: 'placeholder' },
  })

  response.json({ success: true, data: { unlocked: true } })
})

// Interest APIs
app.post('/api/matrimony/profiles/:id/interest', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { id: receiverId } = request.params

  // Check if profile exists
  const profile = database.prepare('SELECT id, user_id FROM matrimony_profiles WHERE id = ?').get(receiverId)
  if (!profile) {
    response.status(404).json({ success: false, error: 'Profile not found' })
    return
  }

  // Cannot send interest to self
  if (profile.user_id === activeUserId) {
    response.status(400).json({ success: false, error: 'Cannot send interest to yourself' })
    return
  }

  const receiverUserId = profile.user_id

  // Check if interest already exists
  const existing = database.prepare(
    'SELECT id, status FROM matrimony_interests WHERE sender_id = ? AND receiver_id = ?'
  ).get(activeUserId, receiverUserId)

  if (existing) {
    if (existing.status === 'pending') {
      response.status(409).json({ success: false, error: 'Interest already sent' })
      return
    }
    if (existing.status === 'accepted') {
      response.status(409).json({ success: false, error: 'Already matched' })
      return
    }
  }

  // Create interest
  const interestId = crypto.randomUUID()
  database.prepare(
    'INSERT INTO matrimony_interests (id, sender_id, receiver_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(interestId, activeUserId, receiverUserId, 'pending', new Date().toISOString())

  response.json({ success: true, data: { interestId, status: 'pending' } })
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
        SELECT i.id, i.receiver_id as user_id, p.id as profile_id, u.full_name as name, i.status, i.created_at
        FROM matrimony_interests i
        JOIN matrimony_profiles p ON i.receiver_id = p.user_id
        JOIN users u ON p.user_id = u.id
        WHERE i.sender_id = $1
        ORDER BY i.created_at DESC
      `, [activeUserId]),
      pgQuery(`
        SELECT i.id, i.sender_id as user_id, p.id as profile_id, u.full_name as name, i.status, i.created_at
        FROM matrimony_interests i
        JOIN matrimony_profiles p ON i.sender_id = p.user_id
        JOIN users u ON p.user_id = u.id
        WHERE i.receiver_id = $1
        ORDER BY i.created_at DESC
      `, [activeUserId]),
    ])

    const mapRow = r => ({
      id: r.id,
      userId: r.user_id,
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

app.put('/api/matrimony/interests/:id', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const { accept } = request.body || {}
  const { id } = request.params

  // Verify interest exists and belongs to current user
  const interest = database.prepare(
    'SELECT * FROM matrimony_interests WHERE id = ? AND receiver_id = ?'
  ).get(id, activeUserId)

  if (!interest) {
    response.status(404).json({ success: false, error: 'Interest not found' })
    return
  }

  if (interest.status !== 'pending') {
    response.status(400).json({ success: false, error: 'Interest already processed' })
    return
  }

  const newStatus = accept ? 'accepted' : 'declined'
  database.prepare(
    'UPDATE matrimony_interests SET status = ?, updated_at = ? WHERE id = ?'
  ).run(newStatus, new Date().toISOString(), id)

  // If accepted, create a match
  if (accept) {
    const matchId = crypto.randomUUID()
    database.prepare(
      'INSERT INTO matrimony_matches (id, user1_id, user2_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(matchId, interest.sender_id, interest.receiver_id, new Date().toISOString())
  }

  response.json({ success: true, data: { status: newStatus } })
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

app.get('/api/matrimony/saved-filters', async (_request, response) => {
  const activeUserId = resolveUserId(_request)
  if (!activeUserId) {
    response.json({ success: true, data: [] })
    return
  }

  try {
    const fastData = await getSavedFiltersByUserIdFast(activeUserId)
    if (fastData) {
      response.json({ success: true, data: fastData })
      return
    }
  } catch {
    // fall back to legacy query path
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
  } catch {
    // fall back to legacy query path
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
  console.log('[update profile] photos received:', typeof profile.photos, JSON.stringify(profile.photos).slice(0, 200))

  // Clean photos array - ensure it's valid JSON
  let cleanPhotos = null
  if (profile.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
    try {
      // Only keep necessary fields
      cleanPhotos = profile.photos.map(p => ({
        id: p.id || String(Math.random()).slice(2),
        uri: p.uri || p.url || '',
        url: p.url || p.uri || '',
        status: p.status || 'done',
        isPrimary: Boolean(p.isPrimary),
        uploadedAt: p.uploadedAt || new Date().toISOString()
      }))
      // Validate it's serializable
      JSON.parse(JSON.stringify(cleanPhotos))
    } catch (e) {
      console.error('[update profile] photos serialization error:', e.message)
      cleanPhotos = null
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

    // Update matrimony_profiles
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
        photos = COALESCE($23, photos),
        updated_at = $24
       WHERE user_id = $25`,
      [
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
        cleanPhotos,
        now,
        activeUserId,
      ]
    )

    // Invalidate cache so next fetch is fresh
    cacheInvalidate(`memberPayload:${activeUserId}`)

    // Return fresh payload
    let updated = null
    try { updated = await getCurrentMemberPayloadFast(activeUserId) } catch {}
    if (!updated) updated = getCurrentMemberPayload(activeUserId)

    if (!updated) {
      response.status(404).json({ success: false, error: 'Profile not found after update' })
      return
    }
    response.json({ success: true, data: updated })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

// Photo upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gvcefstsjakuwkxsuwkl.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
const STORAGE_BUCKET = 'profile-photos'

app.post('/api/upload/photo', upload.single('photo'), async (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  if (!request.file) {
    response.status(400).json({ success: false, error: 'No file uploaded' })
    return
  }

  try {
    const ext = request.file.mimetype === 'image/png' ? 'png' : 'jpg'
    const fileName = `${activeUserId}/${crypto.randomUUID()}.${ext}`
    const storageUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`

    const uploadRes = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': request.file.mimetype,
        'x-upsert': 'false',
      },
      body: request.file.buffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`Storage upload failed: ${err}`)
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`
    response.json({ success: true, data: { url: publicUrl } })
  } catch (err) {
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
    // Extract path after bucket name
    const marker = `/object/public/${STORAGE_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) throw new Error('Invalid photo URL')
    const filePath = url.slice(idx + marker.length)

    // Only allow deleting own photos
    if (!filePath.startsWith(activeUserId + '/')) {
      response.status(403).json({ success: false, error: 'Forbidden' })
      return
    }

    const deleteRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
    })

    if (!deleteRes.ok && deleteRes.status !== 404) {
      throw new Error(`Delete failed: ${await deleteRes.text()}`)
    }
    response.json({ success: true })
  } catch (err) {
    response.status(500).json({ success: false, error: err.message })
  }
})

app.use((_request, response) => {
  response.status(404).json({ success: false, error: 'Route not found' })
})

app.listen(port, () => {
  console.log(`Matrimony backend listening on http://localhost:${port}`)
  warmUpPool()
})
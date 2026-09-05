import { randomUUID } from 'node:crypto'
import pkg from 'pg'
import { LRUCache } from 'lru-cache'

const { Pool } = pkg

const hasPostgres = Boolean(process.env.DATABASE_URL)

const pool = hasPostgres
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
      // Same reasoning as the pool in db.js: a pooler closes idle server
      // connections itself, so a large pool held open for minutes fills with
      // dead sockets. Opening a fresh one costs ~2.5s against a distant region,
      // so keep them a reasonable while but well under the pooler's own timeout.
      max: /pooler\.supabase\.com|pgbouncer/i.test(process.env.DATABASE_URL) ? 10 : 50,
      min: 0,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      statement_timeout: 30000,
    })
  : null

if (pool) {
  pool.on('error', (err) => {
    console.error('[FastQueryPool] idle client error:', err.message)
  })
}

// Bounded LRU cache — max 5000 entries with 5s TTL, prevents unbounded memory growth
const cache = new LRUCache({ max: 5000, ttl: 5000, ttlAutopurge: false })

function cacheKey(name, payload) {
  return `${name}:${JSON.stringify(payload || {})}`
}

function getCached(name, payload) {
  return cache.get(cacheKey(name, payload)) ?? null
}

function setCached(name, payload, value) {
  cache.set(cacheKey(name, payload), value)
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

export function mapPublicProfile(row) {
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
    gender: row.gender ? String(row.gender).toLowerCase() : row.gender,
    isNew: row.created_at ? (Date.now() - new Date(row.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000 : false,
    dateOfBirth: row.date_of_birth,
    familyStatus: row.family_status,
    familyType: row.family_type,
    familyWealth: row.family_wealth,
    fatherName: row.father_name,
    motherName: row.mother_name,
    fatherOccupation: row.father_occupation,
    motherOccupation: row.mother_occupation,
    siblings: row.siblings,
    nativeCity: row.native_city,
    nativeVillage: row.native_village,
    photos: (() => {
      if (!row.photos) return []
      if (Array.isArray(row.photos)) return row.photos
      try {
        const parsed = JSON.parse(row.photos)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    })(),
    physicalStatus: row.physical_status,
    religion: row.religion,
    dosh: row.dosh,
    eatingHabit: row.eating_habit,
    horoscopeTime: row.horoscope_time,
    horoscopePlace: row.horoscope_place,
    village: row.village,
    hobbies: (() => {
      if (!row.hobbies) return []
      if (Array.isArray(row.hobbies)) return row.hobbies
      try {
        const parsed = JSON.parse(row.hobbies)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    })(),
    music: (() => {
      if (!row.music) return []
      if (Array.isArray(row.music)) return row.music
      try {
        const parsed = JSON.parse(row.music)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    })(),
    sports: (() => {
      if (!row.sports) return []
      if (Array.isArray(row.sports)) return row.sports
      try {
        const parsed = JSON.parse(row.sports)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    })(),
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

function mapEventGuestRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    rsvpStatus: row.rsvp_status,
    amountPromised: row.amount_promised,
    amountReceived: row.amount_received,
    paymentMode: row.payment_mode || undefined,
    notes: row.notes || '',
  }
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function normalizeOtpPurpose(purpose) {
  return String(purpose || '').trim().toLowerCase()
}

function normalizeOtpEmail(email) {
  return String(email || '').trim().toLowerCase()
}

async function query(text, values) {
  if (!pool) return null
  const result = await pool.query(text, values)
  return result.rows
}

export async function getCommunityPostsFast({ category, search, pinnedOnly } = {}) {
  if (!pool) return null

  const payload = { category: category || null, search: search || null, pinnedOnly: Boolean(pinnedOnly) }
  const cached = getCached('communityPosts', payload)
  if (cached) return cached

  const rows = await query(
    `
      SELECT *
      FROM community_posts
      WHERE ($1::text IS NULL OR category = $1::text)
        AND ($2::boolean = false OR pinned = 1)
        AND (
          $3::text IS NULL OR
          LOWER(title) LIKE LOWER($4::text) OR
          LOWER(content) LIKE LOWER($4::text) OR
          LOWER(author_name) LIKE LOWER($4::text)
        )
      ORDER BY pinned DESC, created_at DESC
    `,
    [payload.category, payload.pinnedOnly, payload.search, payload.search ? `%${payload.search}%` : null]
  )

  const mapped = (rows || []).map(mapCommunityPostRow)
  setCached('communityPosts', payload, mapped)
  return mapped
}

export async function getCommunityFeedStatsFast() {
  if (!pool) return null

  const cached = getCached('communityStats', {})
  if (cached) return cached

  const [postCounts, pinnedRows, meetingRows] = await Promise.all([
    query(
      `
        SELECT category, COUNT(*) AS total
        FROM community_posts
        GROUP BY category
      `,
      []
    ),
    query('SELECT COUNT(*)::int AS total FROM community_posts WHERE pinned = 1', []),
    query("SELECT COUNT(*)::int AS total FROM community_meetings WHERE meeting_date >= NOW()", []),
  ])

  const totalPosts = (postCounts || []).reduce((sum, row) => sum + Number(row.total || 0), 0)
  const result = {
    totalPosts,
    pinnedPosts: Number(pinnedRows?.[0]?.total || 0),
    upcomingMeetings: Number(meetingRows?.[0]?.total || 0),
    byCategory: (postCounts || []).reduce((acc, row) => ({ ...acc, [row.category]: Number(row.total) }), {}),
  }

  setCached('communityStats', {}, result)
  return result
}

export async function getBusinessListingsFast() {
  if (!pool) return null

  const cached = getCached('businessListings', {})
  if (cached) return cached

  const rows = await query(
    `
      SELECT *
      FROM business_listings
      ORDER BY promoted DESC, featured DESC, trending DESC, created_at DESC
    `,
    []
  )

  const mapped = (rows || []).map(mapBusinessRow)
  setCached('businessListings', {}, mapped)
  return mapped
}

export async function getHelpRequestsFast({ category, urgency, status, search } = {}) {
  if (!pool) return null

  const payload = {
    category: category || null,
    urgency: urgency || null,
    status: status || null,
    search: search || null,
  }
  const cached = getCached('helpRequests', payload)
  if (cached) return cached

  const rows = await query(
    `
      SELECT r.*, u.full_name,
        COALESCE((
          SELECT COUNT(*) FROM help_support_offers s WHERE s.request_id = r.id
        ), 0) AS supporter_count
      FROM help_requests r
      JOIN users u ON u.id = r.creator_user_id
      WHERE ($1::text IS NULL OR r.category = $1::text)
        AND ($2::text IS NULL OR r.urgency = $2::text)
        AND ($3::text IS NULL OR r.status = $3::text)
        AND (
          $4::text IS NULL OR
          LOWER(r.title) LIKE LOWER($5::text) OR
          LOWER(r.description) LIKE LOWER($5::text) OR
          LOWER(u.full_name) LIKE LOWER($5::text)
        )
      ORDER BY r.created_at DESC
    `,
    [payload.category, payload.urgency, payload.status, payload.search, payload.search ? `%${payload.search}%` : null]
  )

  const mapped = (rows || []).map(mapHelpRequestRow)
  setCached('helpRequests', payload, mapped)
  return mapped
}

export async function authAccountExistsByEmailFast(email) {
  if (!pool || !email) return null

  const normalized = String(email).trim().toLowerCase()
  const cached = getCached('authAccountExistsByEmail', { email: normalized })
  if (cached !== null) return cached

  const rows = await query(
    `
      SELECT u.id
      FROM users u
      JOIN auth_accounts a ON a.user_id = u.id
      WHERE lower(u.email) = $1
      LIMIT 1
    `,
    [normalized]
  )

  const exists = Boolean(rows?.[0])
  setCached('authAccountExistsByEmail', { email: normalized }, exists)
  return exists
}

export async function requestEmailOtpFast(email, purpose) {
  if (!pool) return null

  const normalizedEmail = normalizeOtpEmail(email)
  const normalizedPurpose = normalizeOtpPurpose(purpose)

  if (!normalizedEmail || !['signup', 'login'].includes(normalizedPurpose)) {
    return { ok: false, statusCode: 400, error: 'Invalid email OTP request' }
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const latestResult = await client.query(
      `
        SELECT created_at
        FROM auth_email_otps
        WHERE lower(email) = lower($1)
          AND purpose = $2
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [normalizedEmail, normalizedPurpose]
    )

    const latest = latestResult.rows?.[0]
    if (latest) {
      const elapsedMs = Date.now() - new Date(latest.created_at).getTime()
      if (Number.isFinite(elapsedMs) && elapsedMs < 60_000) {
        const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - elapsedMs) / 1000))
        await client.query('ROLLBACK')
        return {
          ok: false,
          statusCode: 429,
          error: `Please wait ${retryAfterSeconds}s before requesting a new OTP`,
        }
      }
    }

    const recentCountResult = await client.query(
      `
        SELECT COUNT(*)::int AS total
        FROM auth_email_otps
        WHERE lower(email) = lower($1)
          AND purpose = $2
          AND created_at::timestamptz >= NOW() - INTERVAL '1 hour'
      `,
      [normalizedEmail, normalizedPurpose]
    )

    const otpCount = Number(recentCountResult.rows?.[0]?.total || 0)
    if (otpCount >= 10) {
      await client.query('ROLLBACK')
      return {
        ok: false,
        statusCode: 429,
        error: 'Too many OTP requests. Please try again after some time.',
      }
    }

    const otpCode = generateOtpCode()
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()

    await client.query(
      `
        INSERT INTO auth_email_otps (
          id, email, purpose, otp_code, expires_at, attempts, max_attempts, consumed_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        `otp-${randomUUID()}`,
        normalizedEmail,
        normalizedPurpose,
        otpCode,
        expiresAt,
        0,
        5,
        null,
        createdAt,
      ]
    )

    await client.query('COMMIT')

    return {
      ok: true,
      data: {
        otpCode,
        expiresAt,
      },
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    return {
      ok: false,
      statusCode: 500,
      error: error instanceof Error ? error.message : 'Unable to create OTP',
    }
  } finally {
    client.release()
  }
}

export async function invalidateActiveEmailOtpsFast(email, purpose) {
  if (!pool) return null

  const normalizedEmail = normalizeOtpEmail(email)
  const normalizedPurpose = normalizeOtpPurpose(purpose)

  if (!normalizedEmail || !['signup', 'login'].includes(normalizedPurpose)) {
    return null
  }

  await pool.query(
    `
      UPDATE auth_email_otps
      SET consumed_at = NOW()
      WHERE lower(email) = lower($1)
        AND purpose = $2
        AND consumed_at IS NULL
    `,
    [normalizedEmail, normalizedPurpose]
  )

  return true
}

export async function getPublicProfilesFast(currentUserId) {
  if (!pool || !currentUserId) return null

  const payload = { currentUserId }
  const cached = getCached('publicProfiles', payload)
  if (cached) return cached

  const rows = await query(
    `
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
        ON s.profile_id = p.id AND s.viewer_user_id = $1
      WHERE p.user_id != $1
      ORDER BY p.compatibility_score DESC, p.created_at DESC
    `,
    [currentUserId]
  )

  const mapped = (rows || []).map(mapPublicProfile)
  setCached('publicProfiles', payload, mapped)
  return mapped
}

export async function getMatrimonyProfileByIdFast(currentUserId, profileId) {
  if (!pool || !profileId) return null

  const rows = await query(
    `
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
        ON s.profile_id = p.id AND s.viewer_user_id = $1
      WHERE p.id = $2
      LIMIT 1
    `,
    [currentUserId || null, profileId]
  )

  return rows?.[0] || null
}

export async function getSavedFiltersByUserIdFast(userId) {
  if (!pool || !userId) return null

  const payload = { userId }
  const cached = getCached('savedFilters', payload)
  if (cached) return cached

  const rows = await query(
    'SELECT * FROM matrimony_saved_filters WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  )

  const mapped = (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    filters: JSON.parse(row.filters_json || '{}'),
  }))

  setCached('savedFilters', payload, mapped)
  return mapped
}

export async function getCurrentMemberPayloadFast(userId) {
  if (!pool || !userId) return null

  const payload = { userId }
  const cached = getCached('currentMemberPayload', payload)
  if (cached) return cached

  const recordRows = await query(
    `
      SELECT u.id AS user_id, u.full_name, u.email, u.phone, u.avatar_url,
             p.id AS profile_id, p.date_of_birth, p.age, p.gender, p.location, p.community,
             p.sub_community, p.education, p.occupation, p.bio, p.marital_status, p.height, p.income, p.language,
             p.compatibility_score, p.is_unlocked, p.is_shortlisted, p.is_viewed,
             p.photos, p.physical_status, p.religion, p.caste, p.dosh, p.eating_habit, p.horoscope_time, p.horoscope_place,
             p.country, p.state, p.village, p.native_city, p.native_village,
             p.family_status, p.family_type, p.family_wealth,
             p.father_name, p.mother_name, p.father_occupation, p.mother_occupation, p.siblings,
             p.hobbies, p.music, p.sports,
             p.created_at, p.updated_at
      FROM users u
      JOIN matrimony_profiles p ON p.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  )

  const record = recordRows?.[0]
  if (!record) return null

  const preferenceRows = await query('SELECT * FROM matrimony_preferences WHERE profile_id = $1 LIMIT 1', [record.profile_id])
  const preference = preferenceRows?.[0]

  const result = {
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
      gender: record.gender,
      dateOfBirth: record.date_of_birth,
      physicalStatus: record.physical_status || '',
      religion: record.religion || '',
      caste: record.caste || '',
      subCaste: record.sub_community || '',
      dosh: record.dosh || '',
      country: record.country || '',
      state: record.state || '',
      city: record.location || '',
      village: record.village || '',
      nativeCity: record.native_city || '',
      nativeVillage: record.native_village || '',
      eatingHabit: record.eating_habit || '',
      horoscopeTime: record.horoscope_time || '',
      horoscopePlace: record.horoscope_place || '',
      photos: (() => {
        if (!record.photos) return []
        if (Array.isArray(record.photos)) return record.photos
        try {
          const parsed = JSON.parse(record.photos)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })(),
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
      familyStatus: record.family_status || '',
      familyType: record.family_type || '',
      familyWealth: record.family_wealth || '',
      fatherName: record.father_name || '',
      motherName: record.mother_name || '',
      fatherOccupation: record.father_occupation || '',
      motherOccupation: record.mother_occupation || '',
      siblings: record.siblings || '',
      hobbies: Array.isArray(record.hobbies) ? record.hobbies : (record.hobbies ? JSON.parse(record.hobbies) : []),
      music: Array.isArray(record.music) ? record.music : (record.music ? JSON.parse(record.music) : []),
      sports: Array.isArray(record.sports) ? record.sports : (record.sports ? JSON.parse(record.sports) : []),
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

  setCached('currentMemberPayload', payload, result)
  return result
}

export async function getMatrimonyFilterOptionsFast(userId) {
  if (!pool || !userId) return null

  const payload = { userId }
  const cached = getCached('matrimonyFilterOptions', payload)
  if (cached) return cached

  const rows = await getPublicProfilesFast(userId)
  if (!rows) return null

  const keepValue = (value) => {
    if (!value) return false
    const normalized = String(value).trim().toLowerCase()
    return normalized.length > 0 && normalized !== 'not set'
  }
  const byStringNormalized = (items, key) => {
    const seen = new Map()
    items.forEach((item) => {
      const raw = item[key]
      if (!keepValue(raw)) return
      const normalized = String(raw).trim().toLowerCase()
      if (!seen.has(normalized)) seen.set(normalized, normalized)
    })
    return Array.from(seen.values()).sort((a, b) => String(a).localeCompare(String(b)))
  }
  const byString = (items, key) =>
    Array.from(new Set(items.map((item) => item[key]).filter(keepValue))).sort((a, b) =>
      String(a).localeCompare(String(b))
    )

  const ages = rows.map((item) => item.age).filter((value) => Number.isFinite(value))
  const result = {
    locations: byString(rows, 'location'),
    genders: byStringNormalized(rows, 'gender'),
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

  setCached('matrimonyFilterOptions', payload, result)
  return result
}

export async function getOwnedEventsFast(userId) {
  if (!pool || !userId) return null

  const payload = { userId }
  const cached = getCached('ownedEvents', payload)
  if (cached) return cached

  const rows = await query(
    `
      SELECT *
      FROM community_events
      WHERE creator_user_id = $1
      ORDER BY event_date DESC, created_at DESC
    `,
    [userId]
  )

  const mapped = (rows || []).map(mapEventRow)
  setCached('ownedEvents', payload, mapped)
  return mapped
}

export async function getOwnedEventByIdFast(userId, eventId) {
  if (!pool || !userId || !eventId) return null

  const rows = await query(
    `
      SELECT *
      FROM community_events
      WHERE creator_user_id = $1 AND id = $2
      LIMIT 1
    `,
    [userId, eventId]
  )

  return rows?.[0] ? mapEventRow(rows[0]) : null
}

export async function getOwnedEventGuestsFast(userId, eventId) {
  if (!pool || !userId || !eventId) return null

  const event = await getOwnedEventByIdFast(userId, eventId)
  if (!event) return null

  const payload = { userId, eventId }
  const cached = getCached('ownedEventGuests', payload)
  if (cached) return cached

  const rows = await query(
    `
      SELECT *
      FROM community_event_guests
      WHERE event_id = $1
      ORDER BY created_at DESC
    `,
    [eventId]
  )

  const mapped = (rows || []).map(mapEventGuestRow)
  setCached('ownedEventGuests', payload, mapped)
  return mapped
}

export async function getOwnedEventSummaryFast(userId) {
  if (!pool || !userId) return null

  const events = await getOwnedEventsFast(userId)
  if (!events) return null

  return {
    totalCreated: events.length,
    upcomingCount: events.filter((event) => event.status === 'upcoming' || event.status === 'ongoing').length,
    pastCount: events.filter((event) => event.status === 'completed' || event.status === 'cancelled').length,
    pendingCount: events.filter((event) => event.moneyCollected < event.moneyExpected).length,
    fullyCollectedCount: events.filter((event) => event.moneyCollected >= event.moneyExpected && event.moneyExpected > 0)
      .length,
  }
}

import pkg from 'pg'

const { Pool } = pkg

const hasPostgres = Boolean(process.env.DATABASE_URL)

const pool = hasPostgres
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
    })
  : null

const cache = new Map()
const CACHE_TTL_MS = 5000

function cacheKey(name, payload) {
  return `${name}:${JSON.stringify(payload || {})}`
}

function getCached(name, payload) {
  const key = cacheKey(name, payload)
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    cache.delete(key)
    return null
  }
  return hit.value
}

function setCached(name, payload, value) {
  cache.set(cacheKey(name, payload), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
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

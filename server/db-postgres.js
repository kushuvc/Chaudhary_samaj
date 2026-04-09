import pkg from 'pg'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export const database = { pool }

// Hash password with salt
function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}.${hash.toString('hex')}`
}

// Verify password
function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split('.')
  const salt = Buffer.from(saltHex, 'hex')
  const hash = scryptSync(password, salt, 64)
  const storedHashBuffer = Buffer.from(hashHex, 'hex')
  try {
    return timingSafeEqual(hash, storedHashBuffer)
  } catch {
    return false
  }
}

// Core user functions
export function userExists(userId) {
  return Boolean(userId && typeof userId === 'string' && userId.length > 0)
}

export function createAuthUser(email, password, fullName, profileData = {}) {
  const userId = randomBytes(8).toString('hex')
  const passwordHash = hashPassword(password)
  
  const query = `
    INSERT INTO users (id, email, password_hash, full_name, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, email, full_name
  `
  
  try {
    const result = pool.querySync(query, [userId, email, passwordHash, fullName])
    
    // Create matrimony profile for new user
    const matrimonyQuery = `
      INSERT INTO matrimony_profiles (id, user_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `
    const matrimonyId = randomBytes(8).toString('hex')
    pool.querySync(matrimonyQuery, [matrimonyId, userId])
    
    return { id: userId, email, fullName }
  } catch (error) {
    console.error('Create user error:', error)
    return null
  }
}

export function authAccountExistsByEmail(email) {
  const query = 'SELECT id FROM users WHERE LOWER(email) = LOWER($1)'
  try {
    const result = pool.querySync(query, [email])
    return result.rowCount > 0
  } catch {
    return false
  }
}

export function authenticateUser(email, password) {
  const query = 'SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER($1)'
  try {
    const result = pool.querySync(query, [email])
    if (result.rowCount === 0) return null
    
    const row = result.rows[0]
    
    const hashQuery = 'SELECT password_hash FROM users WHERE id = $1'
    const hashResult = pool.querySync(hashQuery, [row.id])
    if (hashResult.rowCount === 0) return null
    
    const storedHash = hashResult.rows[0].password_hash
    if (!verifyPassword(password, storedHash)) return null
    
    return { id: row.id, email: row.email, fullName: row.full_name || row.email }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

// OTP functions
export function requestEmailOtp(email, purpose) {
  if (!isGmailAddress(email)) {
    return { ok: false, statusCode: 400, error: 'Only Gmail addresses are allowed' }
  }
  
  // Invalidate old OTPs
  const invalidateQuery = 'DELETE FROM otp_codes WHERE email = $1 AND purpose = $2'
  try {
    pool.querySync(invalidateQuery, [email, purpose])
  } catch {}
  
  const otp = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  
  const query = `
    INSERT INTO otp_codes (email, purpose, code, created_at, expires_at)
    VALUES ($1, $2, $3, NOW(), $4)
  `
  
  try {
    pool.querySync(query, [email, purpose, otp, expiresAt])
    console.log(`[OTP] ${email} (${purpose}): ${otp}`)
    return { ok: true, debugOtp: otp, sentViaFallback: false }
  } catch (error) {
    console.error('OTP request error:', error)
    return { ok: false, statusCode: 500, error: error.message }
  }
}

export function verifyEmailOtp(email, purpose, code) {
  const query = `
    SELECT code, expires_at FROM otp_codes 
    WHERE email = $1 AND purpose = $2 
    ORDER BY created_at DESC 
    LIMIT 1
  `
  
  try {
    const result = pool.querySync(query, [email, purpose])
    if (result.rowCount === 0) {
      return { ok: false, statusCode: 400, error: 'No OTP found for this email' }
    }
    
    const row = result.rows[0]
    if (new Date() > new Date(row.expires_at)) {
      return { ok: false, statusCode: 400, error: 'OTP has expired' }
    }
    
    if (row.code !== String(code).trim()) {
      return { ok: false, statusCode: 400, error: 'Invalid OTP' }
    }
    
    // Mark as used
    const deleteQuery = 'DELETE FROM otp_codes WHERE email = $1 AND purpose = $2'
    pool.querySync(deleteQuery, [email, purpose])
    
    return { ok: true }
  } catch (error) {
    console.error('OTP verify error:', error)
    return { ok: false, statusCode: 500, error: error.message }
  }
}

// Matrimony functions
export function getPublicProfiles(userId, filters = {}) {
  let query = `
    SELECT mp.*, mp.user_id
    FROM matrimony_profiles mp
    WHERE mp.user_id != $1
  `
  const params = [userId]
  let paramIndex = 2
  
  if (filters.location) {
    query += ` AND LOWER(mp.location) LIKE LOWER($${paramIndex})`
    params.push(`%${filters.location}%`)
    paramIndex++
  }
  
  if (filters.minAge && filters.maxAge) {
    query += ` AND mp.age BETWEEN $${paramIndex} AND $${paramIndex + 1}`
    params.push(filters.minAge, filters.maxAge)
    paramIndex += 2
  }
  
  query += ` LIMIT 50`
  
  try {
    const result = pool.querySync(query, params)
    return result.rows || []
  } catch (error) {
    console.error('Get profiles error:', error)
    return []
  }
}

export function getCurrentMemberPayload(userId) {
  const query = `SELECT * FROM matrimony_profiles WHERE user_id = $1`
  try {
    const result = pool.querySync(query, [userId])
    return result.rows[0] || {}
  } catch {
    return {}
  }
}

export function applyProfileUpdate(userId, profile) {
  const fields = Object.keys(profile).filter(k => k !== 'id' && k !== 'user_id')
  if (fields.length === 0) return profile
  
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const query = `
    UPDATE matrimony_profiles 
    SET ${setClauses} 
    WHERE user_id = $1 
    RETURNING *
  `
  
  const values = [userId, ...fields.map(f => profile[f])]
  
  try {
    const result = pool.querySync(query, values)
    return result.rows[0] || {}
  } catch (error) {
    console.error('Profile update error:', error)
    return {}
  }
}

// Events functions
export function getOwnedEvents(userId) {
  const query = `SELECT * FROM events WHERE user_id = $1 ORDER BY created_at DESC`
  try {
    const result = pool.querySync(query, [userId])
    return result.rows || []
  } catch {
    return []
  }
}

export function getOwnedEventById(userId, eventId) {
  const query = `SELECT * FROM events WHERE id = $1 AND user_id = $2`
  try {
    const result = pool.querySync(query, [eventId, userId])
    return result.rows[0] || null
  } catch {
    return null
  }
}

export function createCommunityEvent(userId, eventData) {
  const id = randomBytes(8).toString('hex')
  const query = `
    INSERT INTO events (id, user_id, title, date, location, organizer, expected_guests, expected_money, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *
  `
  
  try {
    const result = pool.querySync(query, [
      id, userId, eventData.title, eventData.date, eventData.location,
      eventData.organizer, eventData.expectedGuests, eventData.expectedMoney
    ])
    return result.rows[0] || {}
  } catch (error) {
    console.error('Create event error:', error)
    return {}
  }
}

// Community functions
export function getCommunityPosts(filters = {}) {
  let query = `SELECT * FROM community_posts WHERE TRUE`
  const params = []
  let paramIndex = 1
  
  if (filters.category) {
    query += ` AND category = $${paramIndex}`
    params.push(filters.category)
    paramIndex++
  }
  
  query += ` ORDER BY ${filters.pinned ? 'pinned DESC,' : ''} created_at DESC LIMIT 50`
  
  try {
    const result = pool.querySync(query, params)
    return result.rows || []
  } catch {
    return []
  }
}

export function createCommunityPost(userId, postData) {
  const id = randomBytes(8).toString('hex')
  const query = `
    INSERT INTO community_posts (id, user_id, title, content, category, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *
  `
  
  try {
    const result = pool.querySync(query, [id, userId, postData.title, postData.content, postData.category])
    return result.rows[0] || {}
  } catch {
    return {}
  }
}

// Help and Need functions
export function getHelpRequests(filters = {}) {
  let query = `SELECT * FROM help_requests WHERE TRUE`
  const params = []
  let paramIndex = 1
  
  if (filters.category) {
    query += ` AND category = $${paramIndex}`
    params.push(filters.category)
    paramIndex++
  }
  
  query += ` ORDER BY created_at DESC LIMIT 50`
  
  try {
    const result = pool.querySync(query, params)
    return result.rows || []
  } catch {
    return []
  }
}

export function createHelpRequest(userId, requestData) {
  const id = randomBytes(8).toString('hex')
  const query = `
    INSERT INTO help_requests (id, user_id, category, title, description, amount_needed, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())
    RETURNING *
  `
  
  try {
    const result = pool.querySync(query, [
      id, userId, requestData.category, requestData.title,
      requestData.description, requestData.amountNeeded
    ])
    return result.rows[0] || {}
  } catch {
    return {}
  }
}

// Business functions
export function getBusinessListings() {
  const query = `SELECT * FROM business_listings ORDER BY created_at DESC LIMIT 100`
  try {
    const result = pool.querySync(query)
    return result.rows || []
  } catch {
    return []
  }
}

export function createBusinessListing(userId, listingData) {
  const id = randomBytes(8).toString('hex')
  const query = `
    INSERT INTO business_listings (id, user_id, name, category, owner, description, phone, email, location, tags, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING *
  `
  
  try {
    const result = pool.querySync(query, [
      id, userId, listingData.name, listingData.category, listingData.owner,
      listingData.description, listingData.phone, listingData.email,
      listingData.location, listingData.tags
    ])
    return result.rows[0] || {}
  } catch {
    return {}
  }
}

// Stub functions for unimplemented features
export function getMatrimonyFilterOptions() {
  return {
    locations: ['Delhi', 'Mumbai', 'Bangalore', 'Pune'],
    genders: ['Male', 'Female', 'Other'],
    educations: ['High School', 'Bachelor', 'Master'],
    occupations: ['Engineer', 'Doctor', 'Business'],
    languages: ['Hindi', 'English', 'Gujarati'],
    communities: ['Chaudhary'],
  }
}

export function getFilterOptions() {
  return getMatrimonyFilterOptions()
}

export function updateProfileState() {
  return { ok: true }
}

export function recordProfileAction() {
  return { ok: true }
}

export function getOwnedEventGuests() {
  return []
}

export function recordCommunityEventContribution() {
  return { ok: true }
}

export function updateOwnedEventGuestRSVP() {
  return { ok: true }
}

export function getCommunityFeedStats() {
  return { posts: 0, meetings: 0 }
}

export function getUpcomingCommunityMeetings() {
  return []
}

export function addCommunityEventGuest() {
  return { ok: true }
}

export function createCommunityMeeting() {
  return {}
}

export function getSavedFiltersByUserId() {
  return []
}

export function getHelpRequestById() {
  return null
}

export function offerHelpOnRequest() {
  return { ok: true }
}

export function getBusinessListingById() {
  return null
}

export function getOwnedEventSummary() {
  return { created: 0, upcoming: 0, past: 0 }
}

export function invalidateActiveEmailOtps() {
  return true
}

function isGmailAddress(email) {
  return /^[^\s@]+@gmail\.com$/i.test(String(email || '').trim())
}

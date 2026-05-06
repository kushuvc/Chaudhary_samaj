import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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
  requestEmailOtpFast,
} from './fast-queries.js'

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
  if (headerUserId && userExists(headerUserId)) {
    return headerUserId
  }
  return null
}

app.post('/api/auth/login', (request, response) => {
  const { email, password } = request.body || {}

  if (!email || !password) {
    response.status(400).json({ success: false, error: 'Email and password are required' })
    return
  }

  if (!isGmailAddress(email)) {
    response.status(400).json({ success: false, error: 'Only Gmail addresses are allowed' })
    return
  }

  const user = authenticateUser(String(email), String(password))
  if (!user) {
    response.status(401).json({ success: false, error: 'Invalid email or password' })
    return
  }

  response.json({ success: true, data: { user, authToken: user.id } })
})

app.post('/api/auth/signup', (request, response) => {
  const {
    fullName,
    email,
    password,
    confirmPassword,
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

  const result = createAuthUser({
    fullName: String(fullName).trim(),
    email: String(email).trim(),
    password: String(password),
    gender: gender ? String(gender).trim() : null,
    dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : null,
    phone: phone ? String(phone).trim() : null,
    age: age !== undefined && age !== null && String(age).trim() !== '' ? Number(age) : null,
    location: location ? String(location).trim() : null,
    community: community ? String(community).trim() : null,
    subCommunity: subCommunity ? String(subCommunity).trim() : null,
    education: education ? String(education).trim() : null,
    occupation: occupation ? String(occupation).trim() : null,
    maritalStatus: maritalStatus ? String(maritalStatus).trim() : null,
    language: language ? String(language).trim() : null,
  })

  if (!result.ok) {
    response.status(409).json({ success: false, error: result.error || 'Unable to create user' })
    return
  }

  response.status(201).json({ success: true, data: { user: result.user, authToken: result.user.id } })
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
    profile = await getMatrimonyProfileByIdFast(activeUserId, request.params.id)
  } catch {
    profile = null
  }

  if (!profile) {
    profile = database
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

app.put('/api/matrimony/me', (request, response) => {
  const activeUserId = resolveUserId(request)
  if (!activeUserId) {
    response.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  const updated = applyProfileUpdate(activeUserId, request.body || {})

  if (!updated) {
    response.status(404).json({ success: false, error: 'Current profile not found' })
    return
  }

  response.json({ success: true, data: updated })
})

app.use((_request, response) => {
  response.status(404).json({ success: false, error: 'Route not found' })
})

app.listen(port, () => {
  console.log(`Matrimony backend listening on http://localhost:${port}`)
})
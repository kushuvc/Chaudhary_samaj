/**
 * Google Play subscription verification.
 *
 * The client hands us a purchase token from Play Billing. That token is not
 * proof of anything on its own — anyone can POST a made-up string — so the
 * server asks Google directly what the token represents before granting a
 * subscription. Nothing the client claims about price, product or expiry is
 * trusted; all of it comes from Google's answer.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'

const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

const packageName = process.env.PLAY_PACKAGE_NAME || 'com.chaudharysamaj.mobile'

/**
 * Service account credentials, as downloaded from Google Cloud / Play Console.
 *
 * Accepts either a path to the JSON key file or the JSON itself, so a host
 * that only offers environment variables (Render) does not need a file on disk.
 */
function loadServiceAccount() {
  const inline = process.env.PLAY_SERVICE_ACCOUNT_JSON
  if (inline) {
    try {
      return JSON.parse(inline)
    } catch {
      throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not valid JSON')
    }
  }

  const path = process.env.PLAY_SERVICE_ACCOUNT_FILE
  if (path && fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  }

  return null
}

const serviceAccount = loadServiceAccount()

export function isPlayBillingConfigured() {
  return Boolean(serviceAccount?.client_email && serviceAccount?.private_key)
}

if (!isPlayBillingConfigured()) {
  console.warn('[play] service account not configured — Play purchase verification will return 503')
}

/*
 * Access tokens last an hour. Caching one avoids a JWT signature and a round
 * trip to Google on every purchase check, and avoids hammering the token
 * endpoint if a client retries.
 */
let cachedToken = null

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const now = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    {
      iss: serviceAccount.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    },
    serviceAccount.private_key,
    { algorithm: 'RS256' }
  )

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    // Tagged so the API can say "our credentials are wrong" rather than
    // blaming the buyer's purchase token — the two need very different fixes.
    const authError = new Error(payload.error_description || 'Could not obtain a Google access token')
    authError.code = 'PLAY_AUTH_FAILED'
    throw authError
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
  }
  return cachedToken.value
}

/**
 * Ask Google what a purchase token actually is.
 *
 * Uses the subscriptionsv2 endpoint, which reports the subscription state
 * directly rather than making callers infer it from expiry timestamps.
 */
export async function getSubscriptionFromPlay(purchaseToken) {
  if (!isPlayBillingConfigured()) {
    throw new Error('Play billing is not configured')
  }

  const accessToken = await getAccessToken()
  const url = `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const payload = await response.json().catch(() => ({}))

  if (response.status === 404 || response.status === 400) {
    // Google does not recognise this token: forged, from another app, or an
    // already-refunded purchase Google has dropped.
    return { valid: false, reason: payload?.error?.message || 'Unknown purchase token' }
  }

  if (!response.ok) {
    const apiError = new Error(payload?.error?.message || `Play API responded ${response.status}`)
    // 401/403 from Google means the service account is not authorised for this
    // package; 404/400 means the token itself is no good.
    apiError.code = response.status === 401 || response.status === 403
      ? 'PLAY_AUTH_FAILED'
      : 'PLAY_TOKEN_INVALID'
    apiError.status = response.status
    throw apiError
  }

  // ACTIVE and IN_GRACE_PERIOD both mean the member should keep access. A
  // grace period is a failed renewal Google is still retrying — cutting access
  // there would punish someone whose card simply expired.
  const state = payload.subscriptionState
  const entitled = state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'

  const lineItem = Array.isArray(payload.lineItems) ? payload.lineItems[0] : null

  return {
    valid: true,
    entitled,
    state,
    productId: lineItem?.productId || null,
    expiryTime: lineItem?.expiryTime || null,
    // Present only until the purchase is acknowledged.
    acknowledgementState: payload.acknowledgementState,
    // Identifies the buyer's Play account across reinstalls and re-purchases.
    linkedPurchaseToken: payload.linkedPurchaseToken || null,
    orderId: payload.latestOrderId || null,
  }
}

/**
 * Tell Google the purchase has been granted.
 *
 * Play automatically refunds and revokes any subscription that is not
 * acknowledged within three days, so this is not optional bookkeeping — a
 * missed acknowledgement silently cancels a paying member.
 */
export async function acknowledgeSubscription(purchaseToken, productId) {
  const accessToken = await getAccessToken()
  const url = `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  if (!response.ok && response.status !== 410) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message || `Acknowledge failed (${response.status})`)
  }
}

/**
 * Verify a Real-time Developer Notification came from Google.
 *
 * RTDN arrives via Pub/Sub push. The shared secret in the subscription's push
 * URL is what proves origin, so compare it in constant time.
 */
export function isValidRtdnToken(provided) {
  const expected = process.env.PLAY_RTDN_TOKEN || ''
  if (!expected) return false
  const a = Buffer.from(String(provided || ''))
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const PLAY_PACKAGE_NAME = packageName

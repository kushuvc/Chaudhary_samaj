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
/**
 * Reports which part of the Play setup is wrong, without revealing the key.
 *
 * Verification answered the same way for a mangled JSON key, a service
 * account Google will not authenticate, and a missing package name — leaving
 * no way to tell them apart except by guessing.
 */
export async function describePlayBillingHealth() {
  const result = {
    hasCredentials: Boolean(process.env.PLAY_SERVICE_ACCOUNT_JSON || process.env.PLAY_SERVICE_ACCOUNT_FILE),
    packageName: packageName || null,
    jsonParses: false,
    clientEmail: null,
    hasPrivateKey: false,
    privateKeyLooksWrapped: false,
    canAuthenticate: false,
    canReadPackage: false,
    packageAccessStatus: null,
    purchaseProbeStatus: null,
    purchaseProbeMessage: null,
    canReadPurchases: false,
    subscriptionsVisible: [],
    error: null,
  }

  if (!result.hasCredentials) {
    result.error = 'PLAY_SERVICE_ACCOUNT_JSON is not set'
    return result
  }
  if (!result.packageName) {
    result.error = 'PLAY_PACKAGE_NAME is not set'
    return result
  }

  let account
  try {
    account = loadServiceAccount()
    result.jsonParses = true
  } catch (err) {
    result.error = err.message
    return result
  }

  result.clientEmail = account.client_email || null
  const key = String(account.private_key || '')
  result.hasPrivateKey = key.length > 0
  // A key pasted through a form that ate the newlines arrives as one line and
  // will never sign anything.
  result.privateKeyLooksWrapped = key.includes('\n') || key.split('\n').length > 2

  if (!result.hasPrivateKey) {
    result.error = 'The key file has no private_key field'
    return result
  }

  try {
    await getAccessToken()
    result.canAuthenticate = true
  } catch (err) {
    result.error = err.message
    return result
  }

  /*
   * A token proves the key is valid, not that the account may touch this app.
   * Those are separate grants, and only the second one fails at purchase time
   * — which is why "canAuthenticate: true" sat next to a purchase that could
   * not be verified.
   */
  /*
   * Probe the exact call verification makes.
   *
   * Listing subscription products and reading a purchase are separate
   * permissions, so testing the wrong one sends you hunting for a setting
   * that was never the problem. A dummy token here should come back 400 or
   * 404 — "no such purchase" — which proves access is fine. A 401 or 403 is
   * the permission fault.
   */
  try {
    const token = await getAccessToken()
    const probeUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/diagnostic-probe-token`
    const probe = await fetch(probeUrl, { headers: { Authorization: `Bearer ${token}` } })
    const probeBody = await probe.json().catch(() => ({}))
    result.purchaseProbeStatus = probe.status
    result.purchaseProbeMessage = probeBody?.error?.message || null
    result.canReadPurchases = probe.status !== 401 && probe.status !== 403

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/subscriptions?pageSize=1`
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    result.packageAccessStatus = response.status

    if (response.ok) {
      const payload = await response.json().catch(() => ({}))
      result.canReadPackage = true
      result.subscriptionsVisible = (payload.subscriptions || []).map((s) => s.productId)
    } else {
      const payload = await response.json().catch(() => ({}))
      result.canReadPackage = false
      result.error = payload?.error?.message || `Play API responded ${response.status}`
    }
  } catch (err) {
    result.canReadPackage = false
    result.error = err.message
  }

  return result
}

/**
 * Which Play subscription states still mean "this member may use the app".
 *
 *   ACTIVE           — paying, nothing wrong.
 *   IN_GRACE_PERIOD  — a renewal failed and Google is still retrying. Cutting
 *                      access here punishes someone whose card simply expired.
 *   CANCELED         — they turned off auto-renew, but the period they already
 *                      paid for has not ended. Google holds a subscription in
 *                      this state from the moment of cancellation until expiry.
 *
 * CANCELED was missing and it was a real fault: cancelling took access away
 * that instant rather than at the end of the paid period. The expiry date is
 * what ends access — every caller checks it — so this only has to answer
 * whether the member is still owed the time.
 *
 * Deliberately excluded: ON_HOLD (payment failed, retries exhausted), PAUSED
 * (member chose to suspend), EXPIRED, and PENDING.
 */
const ENTITLED_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
])

export function isEntitledState(state) {
  return ENTITLED_STATES.has(state)
}

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

  const state = payload.subscriptionState
  const entitled = isEntitledState(state)

  const lineItem = Array.isArray(payload.lineItems) ? payload.lineItems[0] : null

  return {
    valid: true,
    entitled,
    state,
    productId: lineItem?.productId || null,
    expiryTime: lineItem?.expiryTime || null,
    // Which Play offer was bought, if any — the verified-member discount is one.
    offerId: lineItem?.offerDetails?.offerId || null,
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

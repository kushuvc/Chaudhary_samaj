/**
 * Notifications: the in-app list, and push delivery through Expo.
 *
 * Every notification a member should be able to find again is written to
 * `notifications` first and pushed second, so a member who declined the
 * permission, or whose phone was off, still sees it in the app. Chat messages
 * are the exception — they live in the conversation already, so they are
 * pushed but not listed.
 *
 * Delivery goes through Expo's push service, which hands the message to
 * Firebase Cloud Messaging. Both are free. The FCM credentials live in the
 * Expo project, not here, so this needs no secret of its own.
 */
import crypto from 'node:crypto'
import { pgQuery } from './db.js'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
// Expo accepts at most 100 messages per request.
const BATCH_SIZE = 100

/**
 * Whether to actually call Expo. Off under test, so the suite never reaches
 * a real service; the rows are still written, which is what tests check.
 */
function deliveryEnabled() {
  return process.env.PUSH_DELIVERY !== 'off' && process.env.NODE_ENV !== 'test'
}

export function isExpoPushToken(token) {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)
}

export async function registerPushToken(userId, token, platform) {
  const now = new Date().toISOString()
  // A token belongs to one device; if someone else signs in on it, the token
  // moves to them rather than delivering their notifications to the last user.
  await pgQuery(
    `INSERT INTO push_tokens (token, user_id, platform, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (token) DO UPDATE SET user_id = $2, platform = $3, updated_at = $4`,
    [token, userId, platform || null, now]
  )
}

export async function removePushToken(userId, token) {
  await pgQuery('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [token, userId])
}

/**
 * Push to every device of these members. Never throws: a notification that
 * fails to send must not fail the request that caused it.
 */
export async function pushToUsers(userIds, { title, body, data = {} }) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return { devices: 0, delivered: 0 }

  let rows
  try {
    rows = await pgQuery('SELECT token FROM push_tokens WHERE user_id = ANY($1)', [ids])
  } catch (err) {
    console.error('[push] could not read tokens:', err.message)
    return { devices: 0, delivered: 0 }
  }
  if (!rows.length || !deliveryEnabled()) return { devices: rows.length, delivered: 0 }

  const messages = rows.map((row) => ({
    to: row.token,
    title,
    body,
    data,
    sound: 'default',
    channelId: 'default',
    priority: 'high',
  }))

  let delivered = 0
  const dead = []
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      })
      const json = await res.json().catch(() => ({}))
      const tickets = Array.isArray(json.data) ? json.data : []
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') delivered += 1
        // The app was uninstalled or the token rotated; stop sending to it.
        else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[index].to)
      })
    } catch (err) {
      console.error('[push] send failed:', err.message)
    }
  }

  if (dead.length) {
    await pgQuery('DELETE FROM push_tokens WHERE token = ANY($1)', [dead]).catch(() => {})
  }
  return { devices: rows.length, delivered }
}

/**
 * Record a notification for each member, then push it. Returns how many
 * members it was recorded for and how many devices accepted it.
 */
export async function notifyUsers(userIds, { type, title, body, data = {} }) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return { recipients: 0, devices: 0, delivered: 0 }

  const now = new Date().toISOString()
  try {
    // One statement for any number of members, so a broadcast to everyone is
    // a single round trip rather than one insert per member.
    await pgQuery(
      `INSERT INTO notifications (id, user_id, type, title, body, data_json, created_at)
       SELECT gen_random_uuid()::text, uid, $2, $3, $4, $5, $6
       FROM unnest($1::text[]) AS uid`,
      [ids, type, title, body, JSON.stringify(data), now]
    )
  } catch (err) {
    console.error('[notify] could not record:', err.message)
  }

  const pushed = await pushToUsers(ids, { title, body, data: { ...data, type } })
  return { recipients: ids.length, ...pushed }
}

/** Fire-and-forget form for the automatic notifications inside request handlers. */
export function notifyInBackground(userIds, payload) {
  notifyUsers(userIds, payload).catch((err) => console.error('[notify] failed:', err.message))
}

export function pushInBackground(userIds, payload) {
  pushToUsers(userIds, payload).catch((err) => console.error('[push] failed:', err.message))
}

export function newBroadcastId() {
  return crypto.randomUUID()
}

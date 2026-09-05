/**
 * SMS delivery via MSG91.
 *
 * The environment variables for this were documented long before any code
 * used them, so phone OTPs were never actually sent anywhere — the code was
 * simply returned in the HTTP response instead. This module is what makes
 * production phone login possible without doing that.
 */

const MSG91_ENDPOINT = 'https://control.msg91.com/api/v5/flow/'

export function isSmsConfigured() {
  return Boolean(process.env.MSG91_AUTHKEY && process.env.MSG91_TEMPLATE_ID)
}

/**
 * Send a one-time code to an Indian mobile number.
 *
 * Resolves on success and throws otherwise, so callers can decide whether a
 * failure should be surfaced to the user or fall back to another channel.
 */
export async function sendOtpSms(phone, otpCode) {
  const authKey = process.env.MSG91_AUTHKEY
  const templateId = process.env.MSG91_TEMPLATE_ID

  if (!authKey || !templateId) {
    throw new Error('SMS is not configured (MSG91_AUTHKEY and MSG91_TEMPLATE_ID required)')
  }

  const digits = String(phone || '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) {
    throw new Error('A 10-digit mobile number is required')
  }

  const body = {
    template_id: templateId,
    // MSG91 expects the number with country code and no plus sign.
    recipients: [{ mobiles: `91${digits}`, OTP: otpCode }],
  }
  if (process.env.MSG91_SENDERID) {
    body.sender = process.env.MSG91_SENDERID
  }

  // Never let a hanging provider hold the request open.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  let payload
  try {
    const response = await fetch(MSG91_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.message || `MSG91 responded ${response.status}`)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('SMS provider timed out')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  // MSG91 can return 200 with a failure body.
  if (payload?.type && payload.type !== 'success') {
    throw new Error(payload.message || 'SMS provider rejected the request')
  }

  return { ok: true }
}

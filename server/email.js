import nodemailer from 'nodemailer'

const brevoApiKey = process.env.BREVO_API_KEY || ''
const smtpService = process.env.SMTP_SERVICE || ''
const smtpHost = process.env.SMTP_HOST || ''
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
const smtpUser = process.env.SMTP_USER || ''
const smtpPass = process.env.SMTP_PASS || ''
const smtpFrom = process.env.SMTP_FROM || smtpUser || 'no-reply@chaudhary-samaj.local'

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'
const SEND_TIMEOUT_MS = 12000

/**
 * Splits `Display Name <address@host>` into Brevo's sender object. Brevo
 * rejects the whole string in its `email` field, so the two halves have to be
 * separated before the call rather than passed through as one header.
 */
export function parseFromAddress(value) {
  const match = String(value).match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/)
  if (match) {
    return { name: match[1] || undefined, email: match[2] }
  }
  return { email: String(value).trim() }
}

function buildTransporter() {
  if (!smtpUser || !smtpPass) {
    return null
  }

  if (smtpService) {
    return nodemailer.createTransport({
      service: smtpService,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  }

  if (!smtpHost) {
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: 15000,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

function buildGmailSslTransporter() {
  if (!smtpUser || !smtpPass) {
    return null
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: 15000,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

function isRecipientNotFoundError(error) {
  const responseCode = Number(error?.responseCode || 0)
  const responseText = String(error?.response || error?.message || '').toLowerCase()

  if (responseCode === 550 || responseCode === 551 || responseCode === 553) {
    return true
  }

  return (
    responseText.includes('5.1.1') ||
    responseText.includes('user unknown') ||
    responseText.includes('mailbox unavailable') ||
    responseText.includes('recipient address rejected') ||
    responseText.includes('no such user')
  )
}

function buildSmtpErrorDetails(error) {
  if (!error) {
    return { reason: 'unknown_error' }
  }

  return {
    name: error.name || null,
    code: error.code || null,
    errno: error.errno || null,
    command: error.command || null,
    responseCode: Number(error.responseCode || 0) || null,
    message: error.message || null,
    response: error.response || null,
  }
}

/**
 * Sends through Brevo's REST endpoint over HTTPS.
 *
 * This exists because Render's free tier blocks outbound traffic on every SMTP
 * port (25, 465, 587) as of 26 Sep 2025, so nodemailer cannot open a
 * connection at all there — it just times out. Port 443 is unaffected, so the
 * same Brevo account works over the API.
 *
 * Throws on failure; the caller handles fallback.
 */
async function sendViaBrevoApi({ to, subject, html }) {
  const sender = parseFromAddress(smtpFrom)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

  let response
  let body
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: controller.signal,
    })
    body = await response.text()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Brevo API timeout after ${SEND_TIMEOUT_MS / 1000} seconds`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  if (response.ok) {
    return
  }

  let parsed = null
  try {
    parsed = JSON.parse(body)
  } catch {
    // Brevo returns JSON for every documented error, but a proxy or an outage
    // page can return HTML. Keep the raw text in that case.
  }

  const apiError = new Error(parsed?.message || `Brevo API returned ${response.status}`)
  apiError.responseCode = response.status
  apiError.response = body ? body.slice(0, 500) : null
  apiError.code = parsed?.code || null
  throw apiError
}

/**
 * Brevo reports an unroutable recipient as a 400 rather than an SMTP 5.x code,
 * so the signup flow can tell the user their address is wrong instead of
 * silently failing.
 */
function isBrevoRecipientError(error) {
  if (Number(error?.responseCode) !== 400) {
    return false
  }
  const text = String(error?.response || error?.message || '').toLowerCase()
  return (
    error?.code === 'invalid_parameter' &&
    (text.includes('email') || text.includes('recipient') || text.includes('to'))
  )
}

export async function sendEmailOtp({ to, otpCode, purpose, expiresInMinutes = 5 }) {
  const useApi = Boolean(brevoApiKey)
  const transporter = useApi ? null : buildTransporter()
  const gmailSslTransporter = useApi ? null : buildGmailSslTransporter()
  const sendStart = Date.now()
  const transportLabel = useApi ? 'brevo-api' : transporter ? 'smtp' : 'dev'
  console.log(`[OTP SEND] start to=${to} purpose=${purpose} transport=${transportLabel}`)
  const subject =
    purpose === 'login'
      ? 'Your login OTP code'
      : purpose === 'reset'
        ? 'Reset your password'
        : 'Your signup OTP code'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #1d4ed8; margin-bottom: 8px;">Chaudhary Community Verification</h2>
      <p style="margin-top: 0; color: #334155;">${purpose === 'reset' ? 'Use this one-time password to reset your password:' : `Use this one-time password to continue your ${purpose}:`}</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 16px; border-radius: 8px; display: inline-block;">
        ${otpCode}
      </div>
      <p style="color: #334155; margin-top: 16px;">This OTP expires in ${expiresInMinutes} minutes.</p>
      <p style="color: #64748b; font-size: 13px;">If you did not request this, please ignore this email.</p>
    </div>
  `

  if (useApi) {
    try {
      await sendViaBrevoApi({ to, subject, html })
      console.log(`[OTP SEND] success via brevo-api to=${to} duration=${Date.now() - sendStart}ms`)
      return { ok: true, fallback: false }
    } catch (error) {
      const details = buildSmtpErrorDetails(error)

      if (isBrevoRecipientError(error)) {
        const recipientError = new Error('Recipient email could not be validated')
        recipientError.code = 'RECIPIENT_NOT_FOUND'
        console.error(
          `[OTP SEND] recipient error to=${to} afterMs=${Date.now() - sendStart}ms details=${JSON.stringify(details)}`
        )
        throw recipientError
      }

      console.error(
        `[OTP SEND] brevo-api error to=${to} afterMs=${Date.now() - sendStart}ms details=${JSON.stringify(details)}`
      )
      console.log(`[OTP FALLBACK] ${to} (${purpose}) => ${otpCode}`)
      return { ok: true, fallback: true }
    }
  }

  if (!transporter) {
    console.log(`[OTP DEV] ${to} (${purpose}) => ${otpCode}`)
    console.log(`[OTP SEND] dev-fallback to=${to} duration=${Date.now() - sendStart}ms`)
    return { ok: true, fallback: true }
  }

  const sendWithTransporter = async (activeTransporter, label) => {
    const sendMailPromise = activeTransporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
    })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`SMTP timeout after 12 seconds (${label})`)), SEND_TIMEOUT_MS)
    )
    await Promise.race([sendMailPromise, timeoutPromise])
  }

  try {
    await sendWithTransporter(transporter, 'primary')
  } catch (error) {
    const smtpError = buildSmtpErrorDetails(error)

    if (isRecipientNotFoundError(error)) {
      const recipientError = new Error('Recipient email could not be validated')
      recipientError.code = 'RECIPIENT_NOT_FOUND'
      console.error(
        `[OTP SEND] recipient error to=${to} afterMs=${Date.now() - sendStart}ms details=${JSON.stringify(smtpError)}`
      )
      throw recipientError
    }

    const shouldTryGmailSslRetry =
      Boolean(gmailSslTransporter) &&
      !smtpService &&
      String(smtpHost || '').toLowerCase() === 'smtp.gmail.com' &&
      Number(smtpPort) === 587 &&
      smtpSecure === false

    if (shouldTryGmailSslRetry) {
      try {
        await sendWithTransporter(gmailSslTransporter, 'gmail-ssl')
        console.log(`[OTP SEND] success via gmail-ssl retry to=${to} duration=${Date.now() - sendStart}ms`)
        return { ok: true, fallback: false }
      } catch (retryError) {
        const retryDetails = buildSmtpErrorDetails(retryError)
        console.error(
          `[OTP SEND] smtp retry error to=${to} afterMs=${Date.now() - sendStart}ms details=${JSON.stringify(retryDetails)}`
        )
      }
    }

    console.error(
      `[OTP SEND] smtp error to=${to} afterMs=${Date.now() - sendStart}ms details=${JSON.stringify(smtpError)}`
    )
    console.log(`[OTP FALLBACK] ${to} (${purpose}) => ${otpCode}`)
    console.log(`[OTP SEND] fallback to=${to} duration=${Date.now() - sendStart}ms`)
    return { ok: true, fallback: true }
  }

  console.log(`[OTP SEND] success to=${to} duration=${Date.now() - sendStart}ms`)
  return { ok: true, fallback: false }
}

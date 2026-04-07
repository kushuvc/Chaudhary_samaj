import nodemailer from 'nodemailer'

const smtpHost = process.env.SMTP_HOST || ''
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
const smtpUser = process.env.SMTP_USER || ''
const smtpPass = process.env.SMTP_PASS || ''
const smtpFrom = process.env.SMTP_FROM || smtpUser || 'no-reply@chaudhary-samaj.local'

function buildTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
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

export async function sendEmailOtp({ to, otpCode, purpose, expiresInMinutes = 5 }) {
  const transporter = buildTransporter()
  const subject = purpose === 'login' ? 'Your login OTP code' : 'Your signup OTP code'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #1d4ed8; margin-bottom: 8px;">Chaudhary Community Verification</h2>
      <p style="margin-top: 0; color: #334155;">Use this one-time password to continue your ${purpose}:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 16px; border-radius: 8px; display: inline-block;">
        ${otpCode}
      </div>
      <p style="color: #334155; margin-top: 16px;">This OTP expires in ${expiresInMinutes} minutes.</p>
      <p style="color: #64748b; font-size: 13px;">If you did not request this, please ignore this email.</p>
    </div>
  `

  if (!transporter) {
    console.log(`[OTP DEV] ${to} (${purpose}) => ${otpCode}`)
    return { ok: true, fallback: true }
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
    })
  } catch (error) {
    if (isRecipientNotFoundError(error)) {
      const recipientError = new Error('Recipient email could not be validated')
      recipientError.code = 'RECIPIENT_NOT_FOUND'
      throw recipientError
    }
    throw error
  }

  return { ok: true, fallback: false }
}

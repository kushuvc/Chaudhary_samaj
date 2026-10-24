/*
 * Support tickets for mail sent to support@chaudharysamaj.com.
 *
 * Namecheap forwards support@ to the operator's Gmail, where a free Apps
 * Script (support/gmail-forwarder.gs) posts each new support mail to
 * /api/support/inbound every few minutes, in the shape Brevo's inbound parser
 * uses (MessageId, From, Subject, RawTextBody, Headers). A new conversation becomes ticket CS-1001, CS-1002…
 * and gets an automatic acknowledgement; anything carrying "#CS-<n>" in the
 * subject (our replies do) is added to that ticket instead. Admins answer from
 * the Support tab, and the answer goes out from support@.
 *
 * Loop safety: mail from our own domains is ignored, and nothing automatic is
 * ever sent in answer to automatic mail (Auto-Submitted, Precedence, bounce
 * senders) — two auto-responders would otherwise mail each other forever and
 * burn the Brevo quota. Each sender also gets at most AUTO_REPLY_DAILY_CAP
 * acknowledgements a day.
 */
import crypto from 'node:crypto'
import { pgQuery } from './db.js'
import { sendSupportEmail, sendAdminEmail } from './email.js'
import { alertRecipients } from './admin-alerts.js'

export const AUTO_REPLY_DAILY_CAP = 3
/*
 * Brevo's free plan sends 300 mails a day and login codes share them, so a
 * flood of spam (from many addresses) must not be able to use them up:
 * acknowledgements and admin notices both have a daily ceiling.
 */
export const autoReplyDailyMax = () => Number(process.env.SUPPORT_AUTO_REPLY_DAILY_MAX) || 60
export const adminNoticeDailyMax = () => Number(process.env.SUPPORT_ADMIN_NOTICE_DAILY_MAX) || 20
// Whole-domain blocks are refused for these: blocking gmail.com would block
// most members.
const PUBLIC_MAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'rediffmail.com', 'aol.com', 'proton.me', 'protonmail.com',
]
const OWN_DOMAINS = ['chaudharysamaj.com', 'reply.chaudharysamaj.com']
const MAX_BODY = 20000

export const ticketLabel = (number) => `CS-${number}`

/** "#CS-1042" anywhere in a subject, with or without brackets or the #. */
export function ticketNumberFromSubject(subject) {
  const m = String(subject || '').match(/#?\bCS-(\d{3,})\b/i)
  return m ? Number(m[1]) : null
}

function headerMap(headers) {
  const out = {}
  for (const [k, v] of Object.entries(headers || {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '')
  }
  return out
}

/** Bounces, out-of-office replies and mailing lists must never get an auto-reply. */
export function isAutomatedMail(item) {
  const h = headerMap(item?.Headers)
  const from = String(item?.From?.Address || '').toLowerCase()
  if (h['auto-submitted'] && h['auto-submitted'].toLowerCase() !== 'no') return true
  if (/\b(bulk|junk|list|auto_reply)\b/i.test(h['precedence'] || '')) return true
  if (h['x-autoreply'] || h['x-autorespond'] || h['x-auto-response-suppress'] || h['list-id']) return true
  return /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce)/.test(from)
}

export function isOwnAddress(address) {
  const domain = String(address || '').toLowerCase().split('@')[1] || ''
  return OWN_DOMAINS.includes(domain)
}

/**
 * Drops the quoted earlier mail from a reply ("On … wrote:" and the lines
 * after it, "> " lines, Outlook's "Original Message"), so the ticket shows
 * what the member actually wrote this time.
 */
export function stripQuoted(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const out = []
  for (const line of lines) {
    if (/^\s*On .{4,200}wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^\s*From:\s.+@/i.test(line) && out.length) break
    if (/^\s*>/.test(line)) continue
    out.push(line)
  }
  return out.join('\n').trim()
}

function messageText(item) {
  const text =
    item.ExtractedMarkdownMessage ||
    stripQuoted(item.RawTextBody) ||
    item.RawTextBody ||
    String(item.RawHtmlBody || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
  return String(text || '').replace(/\r/g, '').trim().slice(0, MAX_BODY) || '(empty message)'
}

const dayAgo = () => new Date(Date.now() - 864e5).toISOString()
const domainOf = (email) => String(email || '').toLowerCase().split('@')[1] || ''

export async function isBlockedSender(email) {
  const rows = await pgQuery(
    'SELECT 1 FROM support_blocked_senders WHERE pattern = $1 OR pattern = $2 LIMIT 1',
    [String(email).toLowerCase(), '@' + domainOf(email)]
  )
  return rows.length > 0
}

/**
 * Blocks the ticket's sender (or their whole domain) and closes their open
 * tickets. Refuses whole public-mail domains such as gmail.com.
 */
export async function blockTicketSender(ticketId, { domain = false, reason = null } = {}) {
  const [ticket] = await pgQuery('SELECT email FROM support_tickets WHERE id = $1 LIMIT 1', [ticketId])
  if (!ticket) return { error: 'Ticket not found', status: 404 }
  const email = ticket.email.toLowerCase()
  const dom = domainOf(email)
  if (domain && PUBLIC_MAIL_DOMAINS.includes(dom)) {
    return { error: `${dom} is used by many members; block the address instead`, status: 400 }
  }
  const pattern = domain ? '@' + dom : email
  await pgQuery(
    `INSERT INTO support_blocked_senders (pattern, reason, created_at) VALUES ($1, $2, $3)
     ON CONFLICT (pattern) DO NOTHING`,
    [pattern, reason, now()]
  )
  const closed = await pgQuery(
    `UPDATE support_tickets SET status = 'closed', updated_at = $3
      WHERE status <> 'closed' AND (lower(email) = $1 OR ($2::boolean AND lower(email) LIKE '%@' || $4))
      RETURNING id`,
    [email, domain, now(), dom]
  )
  return { pattern, closed: closed.length }
}

export const listBlockedSenders = () =>
  pgQuery('SELECT pattern, reason, created_at FROM support_blocked_senders ORDER BY created_at DESC')

export async function unblockSender(pattern) {
  const rows = await pgQuery('DELETE FROM support_blocked_senders WHERE pattern = $1 RETURNING pattern', [String(pattern).toLowerCase()])
  return rows.length > 0
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const now = () => new Date().toISOString()

const helpUrl = (lang) => `${process.env.SUPPORT_HELP_URL || 'https://www.chaudharysamaj.com/help'}?lang=${lang}`

const ACK = {
  en: {
    subject: (n) => `[#${n}] We have received your message`,
    body: (n, name) =>
      `Namaste${name ? ' ' + name : ''},\n\nThank you for writing to Chaudhary Samaj. Your ticket number is ${n}. ` +
      `We will reply within 48 hours.\n\nMost questions are already answered in our app guide and common questions:\n${helpUrl('en')}\n\nTo add anything, just reply to this email and keep "#${n}" in the subject.\n\n— Chaudhary Samaj Support`,
  },
  hi: {
    subject: (n) => `[#${n}] आपका संदेश हमें मिल गया है`,
    body: (n, name) =>
      `नमस्ते${name ? ' ' + name : ''},\n\nचौधरी समाज को लिखने के लिए धन्यवाद। आपका टिकट नंबर ${n} है। ` +
      `हम 48 घंटों के भीतर जवाब देंगे।\n\nज़्यादातर सवालों के जवाब हमारी ऐप गाइड और आम सवालों में पहले से हैं:\n${helpUrl('hi')}\n\nकुछ और जोड़ना हो तो इसी ईमेल का जवाब दें और विषय में "#${n}" रहने दें।\n\n— चौधरी समाज सहायता`,
  },
  gu: {
    subject: (n) => `[#${n}] તમારો સંદેશ અમને મળી ગયો છે`,
    body: (n, name) =>
      `નમસ્તે${name ? ' ' + name : ''},\n\nચૌધરી સમાજને લખવા બદલ આભાર. તમારો ટિકિટ નંબર ${n} છે. ` +
      `અમે 48 કલાકમાં જવાબ આપીશું.\n\nમોટા ભાગના પ્રશ્નોના જવાબ અમારી એપ ગાઇડ અને સામાન્ય પ્રશ્નોમાં પહેલેથી છે:\n${helpUrl('gu')}\n\nકંઈ ઉમેરવું હોય તો આ જ ઈમેલનો જવાબ આપો અને વિષયમાં "#${n}" રહેવા દો.\n\n— ચૌધરી સમાજ સહાય`,
  },
}

/**
 * The member's saved app language, or null when unknown. The app keeps the
 * chosen language on the phone and most members never save settings, so a
 * missing row means "unknown", not English — those get all three languages.
 */
async function languageFor(userId) {
  if (!userId) return null
  const rows = await pgQuery('SELECT language FROM user_settings WHERE user_id = $1 LIMIT 1', [userId])
  const lang = rows[0]?.language
  if (!lang) return null
  return lang.startsWith('hi') ? 'hi' : lang.startsWith('gu') ? 'gu' : 'en'
}

/** Gujarati or Hindi when the mail itself is written in that script. */
export function detectLanguage(text) {
  const s = String(text || '')
  const gu = (s.match(/[\u0A80-\u0AFF]/g) || []).length
  const hi = (s.match(/[\u0900-\u097F]/g) || []).length
  if (gu >= 3 && gu >= hi) return 'gu'
  if (hi >= 3) return 'hi'
  return null
}

/** Members get their own language; unknown senders get all three. */
export function acknowledgement(label, name, lang) {
  if (lang) return { subject: ACK[lang].subject(label), text: ACK[lang].body(label, name) }
  return {
    subject: ACK.en.subject(label),
    text: [ACK.en.body(label, name), ACK.hi.body(label, name), ACK.gu.body(label, name)].join('\n\n────────\n\n'),
  }
}

// Links stay clickable: the help link is the point of the acknowledgement.
const toHtml = (text) =>
  `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #1f2937; max-width: 600px;">${esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #791611;">$1</a>')
    .replace(/\n/g, '<br>')}</div>`

const replyTo = () => process.env.SUPPORT_REPLY_TO || 'support@chaudharysamaj.com'

async function recordMessage(ticketId, { direction, fromEmail, body, messageId = null, sent = true }) {
  await pgQuery(
    `INSERT INTO support_messages (id, ticket_id, direction, from_email, body, message_id, sent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [crypto.randomUUID(), ticketId, direction, fromEmail, body, messageId, sent, now()]
  )
}

/**
 * Handles one parsed mail from Brevo. Returns what happened, for logs and
 * tests: ignored (own address / duplicate), added to a ticket, or a new ticket.
 */
export async function handleInboundMail(item) {
  const fromEmail = String(item?.From?.Address || '').trim().toLowerCase()
  const fromName = String(item?.From?.Name || '').trim() || null
  const subject = String(item?.Subject || '').trim().slice(0, 300) || '(no subject)'
  if (!fromEmail || isOwnAddress(fromEmail)) return { action: 'ignored', reason: 'own or missing sender' }
  if (await isBlockedSender(fromEmail)) return { action: 'ignored', reason: 'blocked' }

  const messageId = item?.MessageId ? String(item.MessageId) : null
  if (messageId) {
    const seen = await pgQuery(`SELECT 1 FROM support_messages WHERE message_id = $1 AND direction = 'in' LIMIT 1`, [messageId])
    if (seen.length) return { action: 'ignored', reason: 'duplicate' }
  }
  const body = messageText(item)
  const automated = isAutomatedMail(item)

  // A reply to one of our mails carries the ticket number; it must come from
  // the ticket's own address, so nobody can write into someone else's ticket.
  const number = ticketNumberFromSubject(subject)
  if (number) {
    const rows = await pgQuery('SELECT id, email FROM support_tickets WHERE number = $1 LIMIT 1', [number])
    if (rows[0] && rows[0].email.toLowerCase() === fromEmail) {
      await recordMessage(rows[0].id, { direction: 'in', fromEmail, body, messageId })
      // A member writing back reopens a closed ticket and puts it back in the queue.
      await pgQuery(`UPDATE support_tickets SET status = 'open', updated_at = $2 WHERE id = $1`, [rows[0].id, now()])
      return { action: 'added', ticket: ticketLabel(number) }
    }
  }

  const member = (
    await pgQuery('SELECT id, full_name FROM users WHERE lower(email) = $1 LIMIT 1', [fromEmail])
  )[0]
  const ticketId = crypto.randomUUID()
  const [ticket] = await pgQuery(
    `INSERT INTO support_tickets (id, email, name, user_id, subject, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'open', $6, $6) RETURNING number`,
    [ticketId, fromEmail, fromName || member?.full_name || null, member?.id || null, subject, now()]
  )
  const label = ticketLabel(ticket.number)
  await recordMessage(ticketId, { direction: 'in', fromEmail, body, messageId })

  let acknowledged = false
  if (!automated) {
    const [{ n, total }] = await pgQuery(
      `SELECT COUNT(*) FILTER (WHERE lower(t.email) = $1)::int AS n, COUNT(*)::int AS total
         FROM support_messages m JOIN support_tickets t ON t.id = m.ticket_id
        WHERE m.direction = 'auto' AND m.created_at > $2`,
      [fromEmail, dayAgo()]
    )
    if (n < AUTO_REPLY_DAILY_CAP && total < autoReplyDailyMax()) {
      // What they wrote in wins; then their saved app language; else all three.
      const lang = detectLanguage(`${subject}\n${body}`) || (await languageFor(member?.id))
      const ack = acknowledgement(label, fromName || member?.full_name, lang)
      const sentId = await sendSupportEmail({
        to: fromEmail,
        subject: ack.subject,
        text: ack.text,
        html: toHtml(ack.text),
        replyTo: replyTo(),
        headers: messageId ? { 'In-Reply-To': messageId, References: messageId, 'Auto-Submitted': 'auto-replied' } : { 'Auto-Submitted': 'auto-replied' },
      })
      await recordMessage(ticketId, { direction: 'auto', fromEmail: 'support', body: ack.text, messageId: sentId, sent: Boolean(sentId) })
      acknowledged = Boolean(sentId)
    }
  }

  // Tell the admins once per sender per day, and at most a few dozen times a
  // day in all; the Support tab shows everything regardless. Best effort: a
  // failure must not lose the ticket.
  try {
    const [{ fromSender, notified }] = await pgQuery(
      `SELECT COUNT(*) FILTER (WHERE lower(email) = $1 AND id <> $3)::int AS "fromSender",
              COUNT(*) FILTER (WHERE admin_notified)::int AS notified
         FROM support_tickets WHERE created_at > $2`,
      [fromEmail, dayAgo(), ticketId]
    )
    if (fromSender > 0 || notified >= adminNoticeDailyMax()) throw new Error('skip')
    const html = toHtml(`New support ticket ${label} from ${fromName ? fromName + ' ' : ''}<${fromEmail}>${member ? ' (member)' : ''}\nSubject: ${subject}\n\n${body.slice(0, 1500)}\n\nAnswer it in the admin panel → Support.`)
    let sentAny = false
    for (const to of await alertRecipients()) {
      if (await sendAdminEmail({ to, subject: `New support ticket ${label}: ${subject}`, html })) sentAny = true
    }
    if (sentAny) await pgQuery('UPDATE support_tickets SET admin_notified = true WHERE id = $1', [ticketId])
  } catch (err) {
    if (err.message !== 'skip') console.error('[support] admin notice failed:', err.message)
  }

  console.log(`[support] new ticket ${label} from ${fromEmail}${automated ? ' (automated, no ack)' : ''}`)
  return { action: 'created', ticket: label, acknowledged, automated }
}

export async function listTickets(status) {
  const filter = ['open', 'waiting', 'closed'].includes(status) ? status : null
  return pgQuery(
    `SELECT t.id, t.number, t.email, t.name, t.user_id, t.subject, t.status, t.created_at, t.updated_at,
            (SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id) AS messages,
            (SELECT body FROM support_messages m WHERE m.ticket_id = t.id AND m.direction = 'in'
              ORDER BY created_at DESC LIMIT 1) AS last_in
       FROM support_tickets t
      WHERE ($1::text IS NULL OR t.status = $1)
      ORDER BY (t.status = 'open') DESC, t.updated_at DESC
      LIMIT 200`,
    [filter]
  )
}

export async function getTicket(id) {
  const [ticket] = await pgQuery('SELECT * FROM support_tickets WHERE id = $1 LIMIT 1', [id])
  if (!ticket) return null
  const messages = await pgQuery(
    `SELECT id, direction, from_email, body, sent, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at`,
    [id]
  )
  // Who the sender is in the app, so the admin sees plan and reports at a glance.
  let member = null
  const [u] = await pgQuery(
    `SELECT u.id, u.full_name, u.phone, u.created_at,
            (SELECT plan FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'active'
               AND s.expires_at::timestamptz > now() LIMIT 1) AS plan,
            (SELECT COUNT(*)::int FROM member_reports r WHERE r.reported_user_id = u.id) AS reports_against
       FROM users u WHERE lower(u.email) = lower($1) LIMIT 1`,
    [ticket.email]
  )
  if (u) member = u
  return { ticket: { ...ticket, label: ticketLabel(ticket.number) }, messages, member }
}

/** Sends the admin's answer from support@ and records it; `close` also closes the ticket. */
export async function replyToTicket(id, text, { close = false } = {}) {
  const found = await getTicket(id)
  if (!found) return null
  const { ticket, messages } = found
  const lastIn = [...messages].reverse().find((m) => m.direction === 'in')
  const lastInId = lastIn
    ? (await pgQuery('SELECT message_id FROM support_messages WHERE id = $1', [lastIn.id]))[0]?.message_id
    : null
  const body = String(text).trim().slice(0, MAX_BODY)
  const footer = `\n\n—\nChaudhary Samaj Support · Ticket ${ticket.label}\nReply to this email to add to your ticket.`
  const subject = `Re: ${ticket.subject.replace(/^(re:\s*)+/i, '')} [#${ticket.label}]`
  const sentId = await sendSupportEmail({
    to: ticket.email,
    subject,
    text: body + footer,
    html: toHtml(body + footer),
    replyTo: replyTo(),
    headers: lastInId ? { 'In-Reply-To': lastInId, References: lastInId } : undefined,
  })
  await recordMessage(id, { direction: 'out', fromEmail: 'support', body, messageId: sentId, sent: Boolean(sentId) })
  if (sentId) {
    await pgQuery('UPDATE support_tickets SET status = $2, updated_at = $3 WHERE id = $1', [id, close ? 'closed' : 'waiting', now()])
  }
  return { sent: Boolean(sentId) }
}

export async function setTicketStatus(id, status) {
  if (!['open', 'waiting', 'closed'].includes(status)) return null
  const rows = await pgQuery(
    'UPDATE support_tickets SET status = $2, updated_at = $3 WHERE id = $1 RETURNING id, status',
    [id, status, now()]
  )
  return rows[0] || null
}

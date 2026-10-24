import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'
import { ticketNumberFromSubject, isAutomatedMail, acknowledgement, isOwnAddress } from '../server/support.js'

const TOKEN = 'support-test-token-123'
let server
let admin
before(async () => {
  server = await startServer({ env: { SUPPORT_INBOUND_TOKEN: TOKEN } })
  admin = await signUpUser(server)
  await server.sql('UPDATE users SET is_admin = true WHERE id = $1', [admin.userId])
})
after(async () => { await server?.stop() })

let seq = 0
const mail = (over = {}) => ({
  MessageId: `<m${++seq}@example.com>`,
  From: { Address: 'asker@example.com', Name: 'Asha' },
  Subject: 'Cannot see profiles',
  ExtractedMarkdownMessage: 'Hello, I paid but profiles are locked.',
  Headers: {},
  ...over,
})
const inbound = (items, token = TOKEN) =>
  server.request('POST', `/api/support/inbound?token=${encodeURIComponent(token)}`, { body: { items } })
const ticketsFor = (email) =>
  server.sql('SELECT * FROM support_tickets WHERE lower(email) = $1 ORDER BY number', [email])
const messagesOf = (ticketId) =>
  server.sql('SELECT direction, body, sent FROM support_messages WHERE ticket_id = $1 ORDER BY created_at', [ticketId])

describe('support helpers', () => {
  test('finds the ticket number in a reply subject', () => {
    assert.equal(ticketNumberFromSubject('Re: Cannot see profiles [#CS-1042]'), 1042)
    assert.equal(ticketNumberFromSubject('[#CS-1001] We have received your message'), 1001)
    assert.equal(ticketNumberFromSubject('Help with my CS exam'), null)
  })

  test('recognises bounces and auto-replies', () => {
    assert.equal(isAutomatedMail({ From: { Address: 'a@b.com' }, Headers: { 'Auto-Submitted': 'auto-replied' } }), true)
    assert.equal(isAutomatedMail({ From: { Address: 'mailer-daemon@b.com' }, Headers: {} }), true)
    assert.equal(isAutomatedMail({ From: { Address: 'a@b.com' }, Headers: { Precedence: 'bulk' } }), true)
    assert.equal(isAutomatedMail({ From: { Address: 'a@b.com' }, Headers: { 'Auto-Submitted': 'no' } }), false)
  })

  test('acknowledges members in their language and strangers in all three', () => {
    assert.match(acknowledgement('CS-1001', 'Asha', 'gu').text, /ટિકિટ નંબર CS-1001/)
    const all = acknowledgement('CS-1001', null, null).text
    assert.match(all, /ticket number is CS-1001/)
    assert.match(all, /टिकट नंबर CS-1001/)
    assert.match(all, /ટિકિટ નંબર CS-1001/)
  })

  test('own addresses are ours', () => {
    assert.equal(isOwnAddress('support@chaudharysamaj.com'), true)
    assert.equal(isOwnAddress('x@reply.chaudharysamaj.com'), true)
    assert.equal(isOwnAddress('someone@gmail.com'), false)
  })
})

describe('inbound mail webhook', () => {
  test('refuses calls without the secret token', async () => {
    assert.equal((await inbound([mail()], 'wrong')).status, 403)
    assert.equal((await server.request('POST', '/api/support/inbound', { body: { items: [] } })).status, 403)
  })

  test('a new mail opens a ticket and records the automatic reply', async () => {
    const res = await inbound([mail({ From: { Address: 'new1@example.com', Name: 'New' } })])
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data[0].action, 'created')
    assert.match(res.body.data[0].ticket, /^CS-\d{4}$/)
    const [t] = await ticketsFor('new1@example.com')
    assert.equal(t.status, 'open')
    const msgs = await messagesOf(t.id)
    assert.deepEqual(msgs.map((m) => m.direction), ['in', 'auto'])
    // No Brevo key in tests, so the acknowledgement is recorded as not sent.
    assert.equal(msgs[1].sent, false)
  })

  test('a reply carrying the ticket number joins that ticket and reopens it', async () => {
    await inbound([mail({ From: { Address: 'thread@example.com' } })])
    const [t] = await ticketsFor('thread@example.com')
    await server.sql(`UPDATE support_tickets SET status = 'closed' WHERE id = $1`, [t.id])
    const res = await inbound([mail({ From: { Address: 'thread@example.com' }, Subject: `Re: Cannot see profiles [#CS-${t.number}]`, ExtractedMarkdownMessage: 'Still locked.' })])
    assert.equal(res.body.data[0].action, 'added')
    assert.equal((await ticketsFor('thread@example.com')).length, 1)
    const [after] = await ticketsFor('thread@example.com')
    assert.equal(after.status, 'open')
    assert.deepEqual((await messagesOf(t.id)).map((m) => m.direction), ['in', 'auto', 'in'])
  })

  test('someone else quoting a ticket number gets their own ticket', async () => {
    await inbound([mail({ From: { Address: 'owner@example.com' } })])
    const [t] = await ticketsFor('owner@example.com')
    const res = await inbound([mail({ From: { Address: 'intruder@example.com' }, Subject: `Re: [#CS-${t.number}]` })])
    assert.equal(res.body.data[0].action, 'created')
    assert.equal((await messagesOf(t.id)).filter((m) => m.direction === 'in').length, 1)
  })

  test('mail from our own domain and repeated deliveries are ignored', async () => {
    const own = await inbound([mail({ From: { Address: 'noreply@chaudharysamaj.com' } })])
    assert.equal(own.body.data[0].action, 'ignored')
    const once = mail({ From: { Address: 'dup@example.com' } })
    await inbound([once])
    const again = await inbound([once])
    assert.equal(again.body.data[0].action, 'ignored')
    assert.equal((await ticketsFor('dup@example.com')).length, 1)
  })

  test('automatic mail never gets an automatic reply', async () => {
    await inbound([mail({ From: { Address: 'ooo@example.com' }, Headers: { 'Auto-Submitted': 'auto-replied' } })])
    const [t] = await ticketsFor('ooo@example.com')
    assert.deepEqual((await messagesOf(t.id)).map((m) => m.direction), ['in'])
  })

  test('one sender gets at most three automatic replies a day', async () => {
    for (let i = 0; i < 5; i++) await inbound([mail({ From: { Address: 'flood@example.com' }, Subject: `Question ${i}` })])
    const [{ n }] = await server.sql(
      `SELECT COUNT(*)::int AS n FROM support_messages m JOIN support_tickets t ON t.id = m.ticket_id
        WHERE t.email = 'flood@example.com' AND m.direction = 'auto'`
    )
    assert.equal(n, 3)
  })

  test('a member is linked to their ticket', async () => {
    const member = await signUpUser(server)
    await inbound([mail({ From: { Address: member.email } })])
    const [t] = await ticketsFor(member.email.toLowerCase())
    assert.equal(t.user_id, member.userId)
  })
})

describe('admin support endpoints', () => {
  test('only admins can read tickets', async () => {
    const member = await signUpUser(server)
    assert.equal((await server.request('GET', '/api/admin/support/tickets', { token: member.token })).status, 403)
  })

  test('list, open, reply and close a ticket', async () => {
    await inbound([mail({ From: { Address: 'adminflow@example.com' } })])
    const list = await server.request('GET', '/api/admin/support/tickets?status=open', { token: admin.token })
    const t = list.body.data.find((x) => x.email === 'adminflow@example.com')
    assert.ok(t)
    const one = await server.request('GET', `/api/admin/support/tickets/${t.id}`, { token: admin.token })
    assert.equal(one.body.data.ticket.label, `CS-${t.number}`)
    assert.equal(one.body.data.member, null)

    // Without Brevo the reply cannot be sent: it is kept on the ticket, the
    // admin is told, and the status does not pretend it went out.
    const reply = await server.request('POST', `/api/admin/support/tickets/${t.id}/reply`, {
      token: admin.token, body: { message: 'Namaste, please restart the app.' },
    })
    assert.equal(reply.status, 502)
    const msgs = await messagesOf(t.id)
    assert.equal(msgs.at(-1).direction, 'out')
    assert.equal(msgs.at(-1).sent, false)

    const closed = await server.request('PUT', `/api/admin/support/tickets/${t.id}`, { token: admin.token, body: { status: 'closed' } })
    assert.equal(closed.body.data.status, 'closed')
    const bad = await server.request('PUT', `/api/admin/support/tickets/${t.id}`, { token: admin.token, body: { status: 'deleted' } })
    assert.equal(bad.status, 400)
  })

  test('an empty reply is refused', async () => {
    const res = await server.request('POST', '/api/admin/support/tickets/x/reply', { token: admin.token, body: { message: ' ' } })
    assert.equal(res.status, 400)
  })
})

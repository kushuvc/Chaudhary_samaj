import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, signUpUser } from './helpers/harness.mjs'
import { ticketNumberFromSubject, isAutomatedMail, acknowledgement, isOwnAddress, stripQuoted, detectLanguage, startOfDayIST } from '../server/support.js'

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

  test("the acknowledgement links the help page in the member's language", () => {
    assert.match(acknowledgement('CS-1001', 'Asha', 'hi').text, /\/help\?lang=hi/)
    const all = acknowledgement('CS-1001', null, null).text
    for (const l of ['en', 'hi', 'gu']) assert.match(all, new RegExp(`/help\\?lang=${l}`))
  })

  test('quoted earlier mail is dropped from a reply', () => {
    const text = 'Still locked, please check.\n\nOn Sat, 24 Oct 2026 at 5:21 PM Chaudhary Samaj <support@chaudharysamaj.com> wrote:\n> Namaste, please restart the app.'
    assert.equal(stripQuoted(text), 'Still locked, please check.')
    assert.equal(stripQuoted('> only quote'), '')
  })

  test('reads the language a mail is written in', () => {
    assert.equal(detectLanguage('મારું પેમેન્ટ થયું પણ પ્લાન ચાલુ નથી'), 'gu')
    assert.equal(detectLanguage('मेरा भुगतान हो गया लेकिन प्लान चालू नहीं'), 'hi')
    assert.equal(detectLanguage('My payment is done but plan is not active'), null)
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

  test('one ticket and one automatic reply per sender per day; more mail joins it', async () => {
    const results = []
    for (let i = 0; i < 5; i++) {
      results.push((await inbound([mail({ From: { Address: 'flood@example.com' }, Subject: `Question ${i}` })])).body.data[0])
    }
    assert.deepEqual(results.map((r) => r.action), ['created', 'added', 'added', 'added', 'added'])
    const tickets = await ticketsFor('flood@example.com')
    assert.equal(tickets.length, 1)
    const msgs = await messagesOf(tickets[0].id)
    assert.equal(msgs.filter((m) => m.direction === 'in').length, 5)
    assert.equal(msgs.filter((m) => m.direction === 'auto').length, 1)
    // The later mails keep their own subject so nothing is lost.
    assert.match(msgs.at(-1).body, /^Question 4/)
  })

  test('the day starts at midnight in India', () => {
    // 23:00 IST on 24 Oct is 17:30 UTC; that day began at 18:30 UTC on 23 Oct.
    assert.equal(startOfDayIST(Date.parse('2026-10-24T17:30:00Z')), '2026-10-23T18:30:00.000Z')
    // 00:30 IST on 25 Oct (19:00 UTC on 24 Oct) is already the next day.
    assert.equal(startOfDayIST(Date.parse('2026-10-24T19:00:00Z')), '2026-10-24T18:30:00.000Z')
  })

  test('a Gujarati mail gets a Gujarati reply; a member with no saved language gets all three', async () => {
    await inbound([mail({ From: { Address: 'gu-writer@example.com' }, ExtractedMarkdownMessage: 'મારું પેમેન્ટ થયું પણ પ્લાન ચાલુ નથી' })])
    const [g] = await ticketsFor('gu-writer@example.com')
    const gAuto = (await messagesOf(g.id)).find((m) => m.direction === 'auto')
    assert.match(gAuto.body, /ટિકિટ નંબર/)
    assert.doesNotMatch(gAuto.body, /ticket number/)

    const member = await signUpUser(server)
    await inbound([mail({ From: { Address: member.email } })])
    const [t] = await ticketsFor(member.email.toLowerCase())
    const auto = (await messagesOf(t.id)).find((m) => m.direction === 'auto')
    for (const re of [/ticket number/, /टिकट नंबर/, /ટિકિટ નંબર/]) assert.match(auto.body, re)
  })

  test('a member is linked to their ticket', async () => {
    const member = await signUpUser(server)
    await inbound([mail({ From: { Address: member.email } })])
    const [t] = await ticketsFor(member.email.toLowerCase())
    assert.equal(t.user_id, member.userId)
  })
})

describe('help page and Gmail script', () => {
  test('/help shows common questions and the guide in the chosen language', async () => {
    const res = await fetch(server.base + '/help?lang=gu')
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.match(html, /સામાન્ય પ્રશ્નો/)
    assert.match(html, /ખરીદી પુનઃસ્થાપિત કરો/)
    assert.match(html, /<html lang="gu">/)
    const en = await (await fetch(server.base + '/help?lang=xx')).text()
    assert.match(en, /Common questions/)
  })

  test('the Gmail script is served for the admin panel and holds no token', async () => {
    const res = await fetch(server.base + '/support/gmail-forwarder.gs')
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.match(text, /function forwardSupportMail/)
    assert.match(text, /PASTE_SUPPORT_INBOUND_TOKEN_HERE/)
    assert.doesNotMatch(text, new RegExp(TOKEN))
  })

  test('mail posted in the Gmail script shape becomes a ticket without the quoted part', async () => {
    const res = await inbound([{
      MessageId: '<gmail-1@mail.gmail.com>',
      From: { Address: 'gmailer@example.com', Name: 'Gmail User' },
      Subject: 'Plan question',
      RawTextBody: 'Is the yearly plan cheaper?\n\nOn Mon, 1 Jan 2026 someone wrote:\n> old text',
      Headers: { 'Auto-Submitted': '', Precedence: '' },
    }])
    assert.equal(res.body.data[0].action, 'created')
    const [t] = await ticketsFor('gmailer@example.com')
    const [first] = await messagesOf(t.id)
    assert.equal(first.body, 'Is the yearly plan cheaper?')
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

describe('spam protection', () => {
  test('a blocked sender is dropped and their open tickets are closed', async () => {
    await inbound([mail({ From: { Address: 'spammer@junkmail.biz' }, Subject: 'Buy now 1' })])
    const [t] = await ticketsFor('spammer@junkmail.biz')
    const res = await server.request('POST', `/api/admin/support/tickets/${t.id}/block`, { token: admin.token, body: {} })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.pattern, 'spammer@junkmail.biz')
    assert.equal(res.body.data.closed, 1)

    const again = await inbound([mail({ From: { Address: 'spammer@junkmail.biz' }, Subject: 'Buy now 2' })])
    assert.equal(again.body.data[0].action, 'ignored')
    assert.equal((await ticketsFor('spammer@junkmail.biz')).length, 1)
  })

  test('a whole domain can be blocked, but not gmail.com', async () => {
    await inbound([mail({ From: { Address: 'a@spamfarm.example' } })])
    const [t] = await ticketsFor('a@spamfarm.example')
    const ok = await server.request('POST', `/api/admin/support/tickets/${t.id}/block`, { token: admin.token, body: { domain: true } })
    assert.equal(ok.body.data.pattern, '@spamfarm.example')
    const other = await inbound([mail({ From: { Address: 'b@spamfarm.example' } })])
    assert.equal(other.body.data[0].action, 'ignored')

    await inbound([mail({ From: { Address: 'someone@gmail.com' } })])
    const [g] = await ticketsFor('someone@gmail.com')
    const refused = await server.request('POST', `/api/admin/support/tickets/${g.id}/block`, { token: admin.token, body: { domain: true } })
    assert.equal(refused.status, 400)
  })

  test('blocked senders can be listed and unblocked', async () => {
    const list = await server.request('GET', '/api/admin/support/blocked', { token: admin.token })
    assert.ok(list.body.data.some((b) => b.pattern === 'spammer@junkmail.biz'))
    const del = await server.request('DELETE', `/api/admin/support/blocked/${encodeURIComponent('spammer@junkmail.biz')}`, { token: admin.token })
    assert.equal(del.status, 200)
    // Unblocked mail flows again (today it joins their ticket from earlier).
    const back = await inbound([mail({ From: { Address: 'spammer@junkmail.biz' }, Subject: 'Real question' })])
    assert.equal(back.body.data[0].action, 'added')
  })
})

describe('daily ceiling on automatic replies', () => {
  let capped
  before(async () => { capped = await startServer({ env: { SUPPORT_INBOUND_TOKEN: TOKEN, SUPPORT_AUTO_REPLY_DAILY_MAX: '2' } }) })
  after(async () => { await capped?.stop() })

  test('many different senders cannot use up the mail quota', async () => {
    for (let i = 0; i < 4; i++) {
      await capped.request('POST', `/api/support/inbound?token=${TOKEN}`, {
        body: { items: [mail({ From: { Address: `flood${i}@example.org` } })] },
      })
    }
    const [{ tickets }] = await capped.sql('SELECT COUNT(*)::int AS tickets FROM support_tickets')
    const [{ acks }] = await capped.sql(`SELECT COUNT(*)::int AS acks FROM support_messages WHERE direction = 'auto'`)
    assert.equal(tickets, 4, 'every mail still becomes a ticket')
    assert.equal(acks, 2)
  })
})

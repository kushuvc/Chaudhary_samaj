/*
 * Chaudhary Samaj — support mail → tickets.
 *
 * Runs inside the Gmail account that support@chaudharysamaj.com forwards to
 * (script.google.com → New project, paste this, set TOKEN, run setup once).
 * Every 5 minutes it posts new mail sent to support@ to the server, which
 * turns it into tickets (admin panel → Support) and sends the auto-reply.
 * Free: well inside Google's limits (20,000 fetches/day, 90 min trigger time).
 */
const SERVER = 'https://www.chaudharysamaj.com/api/support/inbound?token=';
const TOKEN = 'PASTE_SUPPORT_INBOUND_TOKEN_HERE';
// in:anywhere also covers Spam, where forwarded mail often lands.
const SEARCH = 'in:anywhere to:support@chaudharysamaj.com newer_than:3d';
const SENT_KEY = 'sentMessageIds';

/** Run once: creates the 5-minute timer and asks for Gmail permission. */
function setup() {
  for (const t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('forwardSupportMail').timeBased().everyMinutes(5).create();
  forwardSupportMail();
}

function forwardSupportMail() {
  const props = PropertiesService.getScriptProperties();
  // Remembers what was already posted; the server ignores repeats anyway.
  const sent = JSON.parse(props.getProperty(SENT_KEY) || '[]');
  const seen = new Set(sent);
  const items = [];
  const threads = GmailApp.search(SEARCH, 0, 50);
  for (const thread of threads) {
    // A support mail in Spam is moved back to the inbox so you see it too.
    if (thread.isInSpam()) thread.moveToInbox();
    for (const m of thread.getMessages()) {
      if (m.isInTrash()) continue;
      const id = m.getHeader('Message-ID') || m.getId();
      if (seen.has(id)) continue;
      if (!/support@chaudharysamaj\.com/i.test(m.getTo() + ' ' + m.getCc())) continue;
      const from = m.getFrom();
      const match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
      items.push({
        MessageId: id,
        From: { Name: match ? match[1].trim() : '', Address: (match ? match[2] : from).trim() },
        Subject: m.getSubject(),
        RawTextBody: m.getPlainBody(),
        Headers: {
          'Auto-Submitted': m.getHeader('Auto-Submitted'),
          'Precedence': m.getHeader('Precedence'),
          'List-Id': m.getHeader('List-Id'),
          'X-Autoreply': m.getHeader('X-Autoreply'),
        },
      });
      sent.push(id);
    }
  }
  Logger.log('Support threads found: ' + threads.length + ', new messages to send: ' + items.length);
  if (!items.length) return;
  const res = UrlFetchApp.fetch(SERVER + encodeURIComponent(TOKEN), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ items: items }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    // Not marked as sent, so the next run tries again.
    throw new Error('Server answered ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }
  props.setProperty(SENT_KEY, JSON.stringify(sent.slice(-1500)));
  Logger.log('Sent to server: ' + res.getContentText().slice(0, 300));
}

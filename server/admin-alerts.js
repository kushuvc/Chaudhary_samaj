/*
 * Emails the operator when the app crosses a milestone (members, paying
 * members) or a free-tier limit gets close, so growth and the moment to
 * upgrade are noticed without watching dashboards. Checked hourly; each alert
 * goes out once and is recorded in admin_alerts_sent.
 *
 * Photo bandwidth (Supabase egress) cannot be read from the database, so it is
 * not covered here — check Supabase → Usage for that.
 */
import { pgQuery } from './db.js'
import { sendAdminEmail } from './email.js'

export const MEMBER_MILESTONES = [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]
export const PAID_MILESTONES = [5, 10, 15, 25, 50, 100, 250, 500, 1000, 2500, 5000]
export const CAPACITY_WARNINGS = [70, 90]
// Buyers of one plan. At 100 yearly buyers the operator planned to stop
// selling yearly before view limits arrive, so that one gets a reminder.
export const PLAN_MILESTONES = [10, 25, 50, 100, 250, 500, 1000]
export const YEARLY_REVIEW_AT = 100

/**
 * Plan limits in MB. The defaults are Supabase's free plan; after upgrading,
 * set DB_LIMIT_MB / STORAGE_LIMIT_MB (Pro: 8192 / 102400) so the warnings
 * follow the new limits instead of firing at once.
 */
export function capacityLimits(env = process.env) {
  return {
    dbMb: Number(env.DB_LIMIT_MB) || 500,
    storageMb: Number(env.STORAGE_LIMIT_MB) || 1024,
  }
}

const MB = 1024 * 1024

export async function collectStats() {
  const [counts] = await pgQuery(
    `SELECT
       (SELECT COUNT(*)::int FROM users) AS members,
       (SELECT COUNT(*)::int FROM users WHERE created_at::timestamptz > now() - interval '7 days') AS new_this_week,
       (SELECT COUNT(DISTINCT user_id)::int FROM user_subscriptions
         WHERE status = 'active' AND expires_at::timestamptz > now()
           -- Paid only: not the Play reviewer's access or test rows.
           AND (provider = 'google_play' OR payment_id LIKE 'pay\\_%')) AS paying,
       pg_database_size(current_database())::bigint AS db_bytes`
  )
  let storageBytes = 0
  try {
    const [row] = await pgQuery(
      `SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS bytes FROM storage.objects`
    )
    storageBytes = Number(row?.bytes || 0)
  } catch {
    // No storage schema outside Supabase (tests, local Postgres).
  }
  // Per plan: distinct people who ever bought it, and how many hold it now.
  let plans = []
  try {
    plans = (
      await pgQuery(
        `SELECT p.code, p.name, p.duration_days,
                (SELECT COUNT(DISTINCT b.user_id)::int FROM plan_purchases b WHERE b.plan = p.code) AS buyers,
                (SELECT COUNT(*)::int FROM user_subscriptions s
                  WHERE s.plan = p.code AND s.status = 'active' AND s.expires_at::timestamptz > now()
                    AND (s.provider = 'google_play' OR s.payment_id LIKE 'pay\\_%')) AS active
           FROM subscription_plans p
          ORDER BY p.duration_days, p.price_paise`
      )
    ).map((r) => ({ code: r.code, name: r.name, durationDays: Number(r.duration_days), buyers: Number(r.buyers), active: Number(r.active) }))
  } catch (err) {
    console.error('[admin-alerts] plan counts failed:', err.message)
  }
  return {
    members: Number(counts.members),
    newThisWeek: Number(counts.new_this_week),
    paying: Number(counts.paying),
    dbMb: Number(counts.db_bytes) / MB,
    storageMb: storageBytes / MB,
    plans,
  }
}

/** The alerts these numbers have earned that were not sent before. */
export function pendingAlerts(stats, sentKeys, limits = capacityLimits()) {
  const sent = new Set(sentKeys)
  const out = []
  for (const n of MEMBER_MILESTONES) {
    if (stats.members >= n && !sent.has(`members:${n}`)) {
      out.push({ key: `members:${n}`, line: `You have reached ${n} members.` })
    }
  }
  for (const n of PAID_MILESTONES) {
    if (stats.paying >= n && !sent.has(`paying:${n}`)) {
      out.push({ key: `paying:${n}`, line: `${n} members now have an active paid plan.` })
    }
  }
  for (const plan of stats.plans || []) {
    for (const n of PLAN_MILESTONES) {
      if (plan.buyers >= n && !sent.has(`plan:${plan.code}:${n}`)) {
        const yearly = plan.durationDays >= 365 && n >= YEARLY_REVIEW_AT
        out.push({
          key: `plan:${plan.code}:${n}`,
          warning: yearly,
          line: `${n} members have bought the ${plan.name} plan.` +
            (yearly
              ? ' You planned to review the yearly plan at this point: hide it in Admin → Plans (current buyers keep it) or relaunch it at a new price before adding view limits.'
              : ''),
        })
      }
    }
  }
  for (const [name, used, limit, label] of [
    ['db', stats.dbMb, limits.dbMb, 'Database'],
    ['storage', stats.storageMb, limits.storageMb, 'Photo storage'],
  ]) {
    for (const pct of CAPACITY_WARNINGS) {
      // Keyed by the limit too, so raising the limit after an upgrade re-arms it.
      const key = `${name}:${limit}:${pct}`
      if (used >= (limit * pct) / 100 && !sent.has(key)) {
        out.push({
          key,
          warning: true,
          line: `${label} is ${Math.round((used / limit) * 100)}% full (${used.toFixed(0)} of ${limit} MB). Time to upgrade the plan.`,
        })
      }
    }
  }
  return out
}

/** ADMIN_ALERT_EMAIL (comma-separated) if set, otherwise every admin account. */
export async function alertRecipients(env = process.env) {
  const configured = String(env.ADMIN_ALERT_EMAIL || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (configured.length) return configured
  const rows = await pgQuery(`SELECT email FROM users WHERE is_admin = true AND email IS NOT NULL`)
  return rows.map((r) => r.email).filter((e) => e && !e.endsWith('@phone.local'))
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function summaryHtml(stats, lines, limits = capacityLimits()) {
  const pct = (used, limit) => `${Math.round((used / limit) * 100)}%`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #334155;">
      <h2 style="color: #791611; margin-bottom: 8px;">Chaudhary Samaj update</h2>
      ${lines.map((l) => `<p style="font-size: 16px; margin: 6px 0;"><b>${esc(l)}</b></p>`).join('')}
      <table style="border-collapse: collapse; margin-top: 14px; font-size: 14px;">
        <tr><td style="padding: 4px 16px 4px 0;">Members</td><td><b>${stats.members}</b> (${stats.newThisWeek} new this week)</td></tr>
        <tr><td style="padding: 4px 16px 4px 0;">Paying members</td><td><b>${stats.paying}</b></td></tr>
        ${(stats.plans || []).filter((p) => p.buyers || p.active).map((p) => `<tr><td style="padding: 4px 16px 4px 0;">&nbsp;&nbsp;${esc(p.name)}</td><td>${p.active} active · ${p.buyers} bought so far</td></tr>`).join('')}
        <tr><td style="padding: 4px 16px 4px 0;">Database</td><td>${stats.dbMb.toFixed(0)} of ${limits.dbMb} MB (${pct(stats.dbMb, limits.dbMb)})</td></tr>
        <tr><td style="padding: 4px 16px 4px 0;">Photo storage</td><td>${stats.storageMb.toFixed(0)} of ${limits.storageMb} MB (${pct(stats.storageMb, limits.storageMb)})</td></tr>
      </table>
      <p style="font-size: 13px; color: #64748b; margin-top: 14px;">
        Photo bandwidth is not counted here: check Supabase → Usage → Egress.
      </p>
    </div>`
}

/**
 * Sends whatever is due. With `force`, sends a summary even if nothing is due
 * (the admin panel's "email me now" button). Alerts are marked sent only after
 * a mail actually went out, so a Brevo outage retries next hour.
 */
export async function runAdminAlerts({ force = false } = {}) {
  const stats = await collectStats()
  const limits = capacityLimits()
  const sentRows = await pgQuery('SELECT key FROM admin_alerts_sent')
  const due = pendingAlerts(stats, sentRows.map((r) => r.key), limits)
  if (!due.length && !force) return { stats, due: [], sent: false }

  const recipients = await alertRecipients()
  const lines = due.length ? due.map((a) => a.line) : ['Here is where the app stands today.']
  const subject = due.some((a) => a.warning && a.key.startsWith('plan:'))
    ? 'Chaudhary Samaj: time to review the yearly plan'
    : due.some((a) => a.warning)
    ? 'Chaudhary Samaj: a plan limit is getting close'
    : due.length
      ? `Chaudhary Samaj: ${due[0].line}`
      : 'Chaudhary Samaj: usage summary'
  const html = summaryHtml(stats, lines, limits)

  let sent = false
  for (const to of recipients) {
    if (await sendAdminEmail({ to, subject, html })) sent = true
  }
  if (sent) {
    const now = new Date().toISOString()
    for (const alert of due) {
      await pgQuery(
        'INSERT INTO admin_alerts_sent (key, sent_at) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [alert.key, now]
      )
    }
    console.log(`[admin-alerts] emailed ${recipients.length} admin(s): ${lines.join(' | ')}`)
  }
  return { stats, due: due.map((a) => a.line), sent, recipients: recipients.length }
}

/** Hourly, and once shortly after start. Off under test or with ADMIN_ALERTS=off. */
export function startAdminAlerts() {
  if (process.env.NODE_ENV === 'test' || process.env.ADMIN_ALERTS === 'off') return
  const run = () => runAdminAlerts().catch((err) => console.error('[admin-alerts] failed:', err.message))
  setTimeout(run, 3 * 60 * 1000).unref?.()
  setInterval(run, 60 * 60 * 1000).unref?.()
}

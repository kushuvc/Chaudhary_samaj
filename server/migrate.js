import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { sslConfigFor } from './pg-ssl.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: sslConfigFor(process.env.DATABASE_URL),
})

await client.connect()
console.log('Connected to Postgres')

/*
 * Apply the base schema before the incremental migrations below.
 *
 * Previously this file only ever added to a schema someone had already created
 * by hand in the Supabase dashboard, so `npm run server` could not stand up a
 * fresh database: the migrations that reference users and matrimony_profiles
 * ran against nothing. Every statement in schema.postgres.sql is IF NOT
 * EXISTS, so this is a no-op against an existing database.
 */
const baseSchemaPath = path.join(path.resolve('server'), 'schema.postgres.sql')
if (fs.existsSync(baseSchemaPath)) {
  await client.query(fs.readFileSync(baseSchemaPath, 'utf8'))
  console.log('OK: base schema (schema.postgres.sql)')
}

const migrations = [
  `CREATE TABLE IF NOT EXISTS matrimony_interests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    UNIQUE(sender_id, receiver_id)
  )`,
  `CREATE TABLE IF NOT EXISTS matrimony_matches (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user1_id, user2_id)
  )`,
  `CREATE TABLE IF NOT EXISTS matrimony_messages (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matrimony_interests_sender_id ON matrimony_interests(sender_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matrimony_interests_receiver_id ON matrimony_interests(receiver_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matrimony_matches_user1_id ON matrimony_matches(user1_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matrimony_matches_user2_id ON matrimony_matches(user2_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matrimony_messages_match_id ON matrimony_messages(match_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matrimony_messages_sender_id ON matrimony_messages(sender_id)`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS photos JSONB`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS physical_status TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS religion TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS dosh TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS eating_habit TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS horoscope_time TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS horoscope_place TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS village TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS hobbies JSONB`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS music JSONB`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS sports JSONB`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS cuisine JSONB`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS mother_tongue TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS profile_created_for TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS subcaste TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS open_to_any_subcaste BOOLEAN DEFAULT false`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS employment_type TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS income_currency TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS annual_income TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS nakshatra TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS raasi TEXT`,
  // Ported from the former POST /api/migrate-columns route, which was the only
  // place these were declared. Signup writes all of them, so a database built
  // purely from this file was missing them until now.
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS caste TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS country TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS state TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS native_city TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS native_village TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS family_status TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS family_type TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS family_wealth TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS father_name TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS mother_name TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS father_occupation TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS mother_occupation TEXT`,
  `ALTER TABLE matrimony_profiles ADD COLUMN IF NOT EXISTS siblings TEXT`,
  `CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium')),
    amount INTEGER NOT NULL,
    payment_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)`,
  // Widen the OTP purposes to admit password resets. The constraint is
  // recreated rather than altered because Postgres has no ALTER CHECK.
  `ALTER TABLE auth_email_otps DROP CONSTRAINT IF EXISTS auth_email_otps_purpose_check`,
  `ALTER TABLE auth_email_otps ADD CONSTRAINT auth_email_otps_purpose_check
     CHECK (purpose IN ('signup', 'login', 'reset'))`,
  `CREATE TABLE IF NOT EXISTS member_reports (
    id TEXT PRIMARY KEY,
    reporter_user_id TEXT NOT NULL,
    reported_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS member_reports_status_idx ON member_reports (status, created_at)`,
  // One member cannot file the same report twice; a second submission updates
  // the first rather than flooding the queue.
  `CREATE UNIQUE INDEX IF NOT EXISTS member_reports_pair_idx
     ON member_reports (reporter_user_id, reported_user_id)`,
  `CREATE TABLE IF NOT EXISTS member_blocks (
    blocker_user_id TEXT NOT NULL,
    blocked_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_user_id, blocked_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_rules (
    gender TEXT PRIMARY KEY,
    is_free BOOLEAN NOT NULL DEFAULT false,
    price_paise INTEGER NOT NULL DEFAULT 20000,
    free_profile_limit INTEGER NOT NULL DEFAULT 2,
    updated_at TEXT
  )`,
  // Seed both genders once. ON CONFLICT DO NOTHING so changing the rules later
  // in the admin screen is never undone by a redeploy running this again.
  `INSERT INTO subscription_rules (gender, is_free, price_paise, free_profile_limit, updated_at)
   VALUES ('male', false, 20000, 2, NOW()::text),
          ('female', true, 20000, 2, NOW()::text)
   ON CONFLICT (gender) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en-IN',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    public_profile BOOLEAN NOT NULL DEFAULT true,
    notif_community_announcements BOOLEAN NOT NULL DEFAULT true,
    notif_matrimony_matches BOOLEAN NOT NULL DEFAULT true,
    notif_event_reminders BOOLEAN NOT NULL DEFAULT true,
    notif_security_alerts BOOLEAN NOT NULL DEFAULT true,
    notif_marketing_updates BOOLEAN NOT NULL DEFAULT false,
    privacy_show_phone BOOLEAN NOT NULL DEFAULT false,
    privacy_show_location BOOLEAN NOT NULL DEFAULT true,
    privacy_searchable BOOLEAN NOT NULL DEFAULT true,
    updated_at TEXT
  )`,
  // Backs the auth rate limiter. In-memory counters are per-worker, so the
  // effective cap was multiplied by the worker count.
  `CREATE TABLE IF NOT EXISTS rate_limit_hits (
    key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_expires_at ON rate_limit_hits(expires_at)`,
  // Phone OTPs previously lived in a per-process Map, which breaks under the
  // clustered production entrypoint: a code issued by one worker is invisible
  // to the others. Mirrors auth_email_otps.
  `CREATE TABLE IF NOT EXISTS auth_phone_otps (
    phone TEXT PRIMARY KEY,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_phone_otps_expires_at ON auth_phone_otps(expires_at)`,
  // Gates /api/admin/*. Defaults to false, so granting access is an explicit
  // deliberate act: UPDATE users SET is_admin = true WHERE email = '...';
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`,
  // One phone number per account. A functional unique index rather than a
  // plain UNIQUE(phone) so it normalizes formatting differences (with/without
  // +91, spaces, dashes) before comparing, and so NULL/blank phones (accounts
  // created by email only) never collide with each other.
  // Run server/dedupe-phones.js --apply BEFORE this on a database that
  // predates the constraint, or existing duplicate phone numbers will make
  // this index creation fail.
  `CREATE UNIQUE INDEX IF NOT EXISTS users_phone_normalized_key
     ON users (right(regexp_replace(phone, '\\D', '', 'g'), 10))
     WHERE coalesce(phone, '') <> ''`,
  // Google Play subscriptions. The purchase token is Play's identifier for a
  // subscription and stays stable across renewals, so it is what a Real-time
  // Developer Notification is matched against. Unique so a token cannot be
  // replayed to grant a second account access.
  `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS play_purchase_token TEXT`,
  `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS play_product_id TEXT`,
  `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'razorpay'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_play_token_key
     ON user_subscriptions(play_purchase_token)
     WHERE play_purchase_token IS NOT NULL`,
  // Subscription plans, editable from the admin screen.
  //
  // What a member is offered used to be a constant in three places: the app's
  // plan card, the duration the server added on payment, and the one product
  // id the billing client asked Play for. Adding a quarterly plan meant a code
  // change and a store release. This is the list instead.
  //
  // `code` is what lands in user_subscriptions.plan, so it must stay stable
  // once anyone has bought it. `play_product_id` is the subscription's product
  // id in Play Console; leave it empty for a plan that only sells through the
  // Razorpay link.
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    price_paise INTEGER NOT NULL,
    play_product_id TEXT,
    badge TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_play_product_key
     ON subscription_plans(play_product_id)
     WHERE coalesce(play_product_id, '') <> ''`,
  // Seed the plan that was hardcoded, under the code and product id already in
  // use, so live subscriptions keep resolving. DO NOTHING because editing it in
  // the admin screen must survive the next deploy running this again.
  `INSERT INTO subscription_plans
     (code, name, duration_days, price_paise, play_product_id, badge, is_active, sort_order, updated_at)
   VALUES ('premium', 'Monthly', 30, 20000, 'premium_monthly', 'Most popular', true, 0, NOW()::text)
   ON CONFLICT (code) DO NOTHING`,
  // user_subscriptions.plan was fixed to ('basic', 'premium') by a CHECK, which
  // would reject every plan added in the admin screen — the row is written long
  // after the constraint was thought about. Postgres has no ALTER CHECK, so it
  // is dropped rather than widened: subscription_plans is what says which codes
  // exist now, and a constraint listing them would have to be rewritten on
  // every change.
  `ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check`,
  // What each plan actually unlocks, so one plan can open the directory while
  // another also hands over phone numbers. Every column defaults to true: a new
  // capability must never quietly take something away from a member who has
  // already paid for it, and the plans that exist today grant everything.
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_view_phone BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_send_interest BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_chat BOOLEAN NOT NULL DEFAULT true`,
  // The same three on the per-gender rules. Without them a gender set to free
  // would get more than the cheapest paid plan, which is not a rule anyone
  // means to write.
  `ALTER TABLE subscription_rules ADD COLUMN IF NOT EXISTS can_view_phone BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE subscription_rules ADD COLUMN IF NOT EXISTS can_send_interest BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE subscription_rules ADD COLUMN IF NOT EXISTS can_chat BOOLEAN NOT NULL DEFAULT true`,
  /*
   * Seed the per-gender switches to what the app actually did, once.
   *
   * Those switches used to apply only when a gender was set to free, and
   * neither was — so every one of them has been sitting at its default with no
   * effect. Now that they govern every non-subscriber, leaving them at `true`
   * would hand contact numbers to people who have not paid, which is not a
   * change anyone asked for. Interests and chat were always open to
   * non-payers; contact numbers never were.
   *
   * The marker column makes this run once per row rather than on every deploy,
   * which would otherwise undo the admin screen every time the service
   * restarted.
   */
  `ALTER TABLE subscription_rules ADD COLUMN IF NOT EXISTS caps_seeded BOOLEAN NOT NULL DEFAULT false`,
  `UPDATE subscription_rules
      SET can_view_phone = false,
          can_send_interest = true,
          can_chat = true,
          caps_seeded = true
    WHERE caps_seeded = false`,
  /*
   * Which profiles each free member was given.
   *
   * The free allowance used to mean "the first N of the current ordering",
   * and that ordering is newest-first — so every single registration handed
   * every free member two different profiles, for ever. Recording the grant
   * makes it what it always claimed to be: these N profiles, permanently.
   */
  `CREATE TABLE IF NOT EXISTS matrimony_free_allocations (
     viewer_user_id TEXT NOT NULL,
     profile_id TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (viewer_user_id, profile_id)
   )`,
  `CREATE INDEX IF NOT EXISTS matrimony_free_allocations_viewer_idx
     ON matrimony_free_allocations (viewer_user_id, created_at)`,
  // One row arrived as 'Male'. Reads all lowercase before comparing, so it
  // behaved — but the value should not vary, and this is idempotent.
  `UPDATE matrimony_profiles SET gender = lower(gender) WHERE gender <> lower(gender)`,
]

for (const sql of migrations) {
  try {
    await client.query(sql)
    console.log('OK:', sql.slice(0, 60).trim())
  } catch (e) {
    console.error('ERR:', e.message, '|', sql.slice(0, 60).trim())
  }
}

await client.end()
console.log('Migration complete')

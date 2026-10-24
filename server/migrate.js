import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { sslConfigFor } from './pg-ssl.js'
import { GUIDE_DEFAULTS } from './guide-defaults.js'

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
  // Set only when a code is entered correctly. consumed_at cannot stand in for
  // it: requesting a fresh code also marks the old one consumed, so it says a
  // code is spent, not that anyone proved they could read it.
  `ALTER TABLE auth_email_otps ADD COLUMN IF NOT EXISTS verified_at TEXT`,
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
  // Contact numbers without a match. Unlike the three above this defaults to
  // false: switching it on hands strangers' numbers to a plan's buyers, so it
  // has to be a deliberate choice in the admin panel, never a side effect of a
  // deploy.
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_view_phone_unmatched BOOLEAN NOT NULL DEFAULT false`,
  // Lets a plan's members hide their own number. Off by default for the same
  // reason: everyone agrees to share at signup, and hiding is what a plan sells.
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_hide_phone BOOLEAN NOT NULL DEFAULT false`,
  /*
   * Phone sharing is on unless a member turns it off.
   *
   * The column defaulted to false, but nothing read it, so "off" was never a
   * choice anyone made — it was what the settings screen showed before a
   * member touched it. Members now agree to share at signup, and the number
   * is withheld only when they switch it off on a plan that allows that.
   *
   * The marker makes the reset run once: rows that exist now start unmarked
   * and are reset, then the default flips so rows created later are marked
   * and keep whatever the member chose.
   */
  `ALTER TABLE user_settings ALTER COLUMN privacy_show_phone SET DEFAULT true`,
  `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS phone_share_seeded BOOLEAN NOT NULL DEFAULT false`,
  `UPDATE user_settings SET privacy_show_phone = true, phone_share_seeded = true WHERE phone_share_seeded = false`,
  `ALTER TABLE user_settings ALTER COLUMN phone_share_seeded SET DEFAULT true`,
  // Notifications. One row per device a member is signed in on, keyed by the
  // Expo push token; the token moves if another member signs in on the device.
  `CREATE TABLE IF NOT EXISTS push_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id)`,
  // The in-app list: what a member was told, whether or not the push arrived.
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data_json TEXT,
    created_at TEXT NOT NULL,
    read_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`,
  // Google's own subscription state (ACTIVE, CANCELED, ...). ACTIVE means it
  // renews by itself, so an "expiring" reminder would be wrong; CANCELED means
  // the member turned renewal off and the plan really will end.
  `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS play_state TEXT`,
  // One row per reminder sent, so the hourly check can run on every worker and
  // every restart without anyone being told twice about the same expiry.
  `CREATE TABLE IF NOT EXISTS plan_expiry_reminders (
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    PRIMARY KEY (user_id, expires_at, kind)
  )`,
  // One "viewed your profile" notice per viewer, per owner, per day — opening
  // a profile five times is one notice, not five.
  `CREATE TABLE IF NOT EXISTS profile_view_notices (
    viewer_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (viewer_id, owner_id, day)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_profile_view_notices_owner_day ON profile_view_notices(owner_id, day)`,
  // View notices no longer name the viewer; scrub the ones sent before that.
  `UPDATE notifications SET body = 'A member viewed your profile. Browse matches to find new profiles.'
   WHERE type = 'profile_viewed' AND body <> 'A member viewed your profile. Browse matches to find new profiles.'`,
  // What the admin sent, to whom, and how far it got.
  `CREATE TABLE IF NOT EXISTS notification_broadcasts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience TEXT NOT NULL,
    target TEXT,
    sent_by TEXT,
    recipients INTEGER NOT NULL DEFAULT 0,
    devices INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  // Who a plan is offered to: 'all', 'female' or 'male'. Defaults to 'all' so
  // every plan that exists today stays on sale to everyone it is now.
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all'`,
  `DO $$ BEGIN
     ALTER TABLE subscription_plans
       ADD CONSTRAINT subscription_plans_audience_check CHECK (audience IN ('all', 'female', 'male'));
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
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
  /*
   * The in-app guide.
   *
   * In the database rather than the app bundle so a section can be reworded,
   * added for a new feature, or hidden without shipping a release — the same
   * reason subscription_plans moved out of the code.
   *
   * One row per section carries all three languages side by side, which makes
   * a half-translated section obvious in the admin screen instead of it
   * silently falling back to English on someone's phone.
   */
  `CREATE TABLE IF NOT EXISTS app_guide_sections (
    key TEXT PRIMARY KEY,
    icon TEXT NOT NULL DEFAULT 'information-circle-outline',
    title_en TEXT NOT NULL,
    title_hi TEXT NOT NULL,
    title_gu TEXT NOT NULL,
    body_en TEXT NOT NULL,
    body_hi TEXT NOT NULL,
    body_gu TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
  )`,
  // When the account's email was last proved to belong to its holder: a
  // correctly entered signup, login or reset code. Phone-only accounts carry a
  // placeholder address and never get one.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT`,
  // Accounts made since signup started requiring a code already proved their
  // address; carry that over. Only verified_at counts — consumed_at is also
  // set when a fresh code replaces an unused one.
  `UPDATE users u SET email_verified_at = o.first_verified
     FROM (
       SELECT lower(email) AS email, min(verified_at) AS first_verified
       FROM auth_email_otps
       WHERE verified_at IS NOT NULL
       GROUP BY lower(email)
     ) o
    WHERE lower(u.email) = o.email AND u.email_verified_at IS NULL`,
  // Aadhaar verification, one row per member.
  //
  // Holds the result and the few signed details an admin needs to decide a
  // mismatch — never the Aadhaar number (only its last four digits are ever
  // seen), the address, the photo or the QR itself. `fingerprint` is an HMAC
  // of the card holder's details so one card cannot verify two accounts.
  `CREATE TABLE IF NOT EXISTS member_verifications (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'aadhaar_qr',
    status TEXT NOT NULL CHECK (status IN ('verified', 'review', 'rejected')),
    fingerprint TEXT NOT NULL,
    id_name TEXT,
    id_dob TEXT,
    id_gender TEXT,
    id_last4 TEXT,
    mismatches TEXT,
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT,
    review_note TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS member_verifications_fingerprint_key
     ON member_verifications (fingerprint)
     WHERE status IN ('verified', 'review')`,
  `CREATE INDEX IF NOT EXISTS member_verifications_status_idx
     ON member_verifications (status, submitted_at)`,
  // Members an admin removed for breaking the rules. Their account and data
  // are deleted; this row is all that stays, so the same email, phone or
  // Aadhaar cannot simply sign up again. Also lets the reports list still name
  // who a report was about.
  `CREATE TABLE IF NOT EXISTS removed_members (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    phone TEXT,
    aadhaar_fingerprint TEXT,
    full_name TEXT,
    reason TEXT,
    removed_by TEXT,
    removed_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS removed_members_email_idx ON removed_members (lower(email))`,
  `CREATE INDEX IF NOT EXISTS removed_members_phone_idx ON removed_members (phone)`,
  `CREATE INDEX IF NOT EXISTS removed_members_fingerprint_idx ON removed_members (aadhaar_fingerprint)`,
  // Which operator alerts (member milestones, capacity warnings) have been
  // emailed, so each goes out once.
  `CREATE TABLE IF NOT EXISTS admin_alerts_sent (
    key TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL
  )`,
  /*
   * Row-Level Security on every table in `public`.
   *
   * Supabase exposes a REST API over these tables at
   * https://<project>.supabase.co/rest/v1/. With RLS off, anyone holding the
   * project ref and the anon key can read, edit and delete every row through
   * it — members' details, phone numbers, messages, the lot. The project ref
   * is public by design and the anon key is treated as public too, so the
   * only thing standing in the way was that we happen never to have shipped
   * the key in the app.
   *
   * Nothing here uses that REST API: the server connects straight to Postgres
   * with the `pg` driver, and Supabase is used only for photo storage, which
   * lives in the `storage` schema and is untouched by this.
   *
   * So RLS with no policies is exactly right — it denies the `anon` and
   * `authenticated` roles everything, while the app keeps working because it
   * connects as `postgres`, which owns these tables and bypasses RLS. (That
   * bypass is why FORCE ROW LEVEL SECURITY is deliberately not used: it would
   * lock out the server itself.)
   *
   * Written as a loop over the catalogue rather than a list of names, and
   * kept last in this list, so a table created by any migration above — or
   * added later — is covered without anyone remembering to come back. A test
   * fails if one slips through.
   */
  `DO $$
   DECLARE t record;
   BEGIN
     FOR t IN
       SELECT tablename FROM pg_tables WHERE schemaname = 'public'
     LOOP
       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
     END LOOP;
   END $$`,
]

for (const sql of migrations) {
  try {
    await client.query(sql)
    console.log('OK:', sql.slice(0, 60).trim())
  } catch (e) {
    console.error('ERR:', e.message, '|', sql.slice(0, 60).trim())
  }
}

/*
 * Seed the guide.
 *
 * Parameterised rather than inlined into the migration list above, because the
 * text is three languages of prose and escaping it into SQL literals is how
 * a stray apostrophe takes down a deploy.
 *
 * DO NOTHING on conflict: a section reworded in the admin screen must survive
 * the next deploy running this again. Adding a section to guide-defaults.js
 * ships it to databases that have not seen it and leaves the rest untouched.
 */
for (const section of GUIDE_DEFAULTS) {
  try {
    await client.query(
      `INSERT INTO app_guide_sections
         (key, icon, title_en, title_hi, title_gu, body_en, body_hi, body_gu, is_active, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW()::text)
       ON CONFLICT (key) DO NOTHING`,
      [
        section.key,
        section.icon,
        section.title.en, section.title.hi, section.title.gu,
        section.body.en, section.body.hi, section.body.gu,
        section.sortOrder,
      ]
    )
    console.log('OK: guide section', section.key)
  } catch (e) {
    console.error('ERR: guide section', section.key, '|', e.message)
  }
}

await client.end()
console.log('Migration complete')

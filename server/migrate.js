import 'dotenv/config'
import { Client } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log('Connected to Postgres')

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
  // One phone number per account. A functional unique index rather than a
  // plain UNIQUE(phone) so it normalizes formatting differences (with/without
  // +91, spaces, dashes) before comparing, and so NULL/blank phones (accounts
  // created by email only) never collide with each other.
  // Run server/dedupe-phones.js --apply BEFORE this on a database that
  // predates the constraint, or existing duplicate phone numbers will make
  // this index creation fail.
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
  `CREATE UNIQUE INDEX IF NOT EXISTS users_phone_normalized_key
     ON users (right(regexp_replace(phone, '\\D', '', 'g'), 10))
     WHERE coalesce(phone, '') <> ''`,
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

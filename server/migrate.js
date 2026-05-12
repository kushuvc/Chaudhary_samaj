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

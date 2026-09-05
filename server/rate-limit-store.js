/**
 * A Postgres-backed store for express-rate-limit.
 *
 * The default store keeps counters in process memory. Under cluster.js each
 * worker therefore enforces its own copy of the limit, so the effective cap is
 * the configured number multiplied by the worker count. That is tolerable for a
 * coarse traffic brake but not for brute-force protection, where the limit is
 * the security control.
 *
 * Only the auth limiter uses this. Putting the global limiter here would add a
 * database round-trip to every request, which against a pooler in another
 * region costs more than the precision is worth.
 */
import { pgQuery } from './db.js'

export class PostgresRateLimitStore {
  constructor({ prefix = 'rl' } = {}) {
    this.prefix = prefix
    this.windowMs = 60000
    this.cleanupTimer = null
  }

  init(options) {
    this.windowMs = options.windowMs

    // Expired rows are never read, but without this they accumulate forever.
    // unref so the timer cannot hold the process open on shutdown.
    this.cleanupTimer = setInterval(() => {
      pgQuery('DELETE FROM rate_limit_hits WHERE expires_at <= NOW()').catch(() => {})
    }, 10 * 60 * 1000)
    this.cleanupTimer.unref?.()
  }

  key(key) {
    return `${this.prefix}:${key}`
  }

  /**
   * Count one hit and return the running total for the current window.
   *
   * The upsert both increments and rolls the window over in a single
   * statement, so concurrent requests across workers cannot interleave into a
   * lost update the way a read-then-write would.
   */
  async increment(key) {
    const rows = await pgQuery(
      `INSERT INTO rate_limit_hits (key, hits, expires_at)
       VALUES ($1, 1, NOW() + ($2 || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE
           WHEN rate_limit_hits.expires_at <= NOW() THEN 1
           ELSE rate_limit_hits.hits + 1
         END,
         expires_at = CASE
           WHEN rate_limit_hits.expires_at <= NOW()
             THEN NOW() + ($2 || ' milliseconds')::interval
           ELSE rate_limit_hits.expires_at
         END
       RETURNING hits, expires_at`,
      [this.key(key), String(this.windowMs)]
    )

    const row = rows[0]
    return {
      totalHits: Number(row.hits),
      resetTime: new Date(row.expires_at),
    }
  }

  async decrement(key) {
    await pgQuery(
      'UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = $1 AND expires_at > NOW()',
      [this.key(key)]
    )
  }

  async resetKey(key) {
    await pgQuery('DELETE FROM rate_limit_hits WHERE key = $1', [this.key(key)])
  }

  shutdown() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
  }
}

/*
 * Render's free plan stops the service after 15 minutes without inbound
 * traffic, and the next member then waits 30–60 seconds for a cold start
 * (Google's purchase notifications arrive late too). Calling our own public
 * URL comes back in through Render's proxy, which counts as inbound traffic,
 * so pinging every 10 minutes keeps the instance awake.
 *
 * One always-on service uses ~744 of the 750 free instance hours a month, so
 * this only fits while it is the sole free service in the Render workspace.
 * Remove it (or set KEEP_ALIVE=off) after moving to a paid plan, which never
 * sleeps.
 */

export const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000

/**
 * KEEP_ALIVE_URL overrides; otherwise Render's own RENDER_EXTERNAL_URL. Off
 * under test, with KEEP_ALIVE=off, and anywhere neither is set (a laptop).
 */
export function keepAliveUrl(env = process.env) {
  if (env.NODE_ENV === 'test' || env.KEEP_ALIVE === 'off') return null
  if (env.KEEP_ALIVE_URL) return env.KEEP_ALIVE_URL
  if (env.RENDER_EXTERNAL_URL) return `${env.RENDER_EXTERNAL_URL.replace(/\/+$/, '')}/api/health`
  return null
}

export function startKeepAlive(env = process.env) {
  const url = keepAliveUrl(env)
  if (!url) return null
  const ping = () =>
    fetch(url, { signal: AbortSignal.timeout(30 * 1000) })
      .then((res) => { if (!res.ok) console.warn(`[keep-alive] ${url} returned ${res.status}`) })
      .catch((err) => console.warn('[keep-alive] ping failed:', err.message))
  const timer = setInterval(ping, KEEP_ALIVE_INTERVAL_MS)
  timer.unref?.()
  console.log(`[keep-alive] pinging ${url} every ${KEEP_ALIVE_INTERVAL_MS / 60000} minutes`)
  return timer
}

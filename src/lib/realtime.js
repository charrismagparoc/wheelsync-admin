// Live updates by polling. Every 15 seconds, while the page is visible, each open screen reloads its data
// through the normal REST endpoints. Works on Vercel, where WebSockets are not available.
const POLL_MS = 15000

const listeners = new Set()
let timer = null

function tick() {
  if (document.visibilityState !== 'visible') return
  listeners.forEach((l) => { try { l.callback({ table: '*' }) } catch { /* ignore */ } })
}

function start() {
  if (!timer && listeners.size > 0) timer = setInterval(tick, POLL_MS)
}

function stop() {
  clearInterval(timer)
  timer = null
}

// Refresh straight away when the user comes back to this tab.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && listeners.size > 0) tick()
})

/** `tables` is kept for compatibility: every listener is refreshed on each poll. */
export function subscribe(tables, callback) {
  const listener = { tables: Array.isArray(tables) ? tables : [tables], callback }
  listeners.add(listener)
  start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}

/** Call after sign-in / sign-out. Polling uses the current token on every request, so only the timer restarts. */
export function resetRealtime() {
  stop()
  if (listeners.size > 0) start()
}

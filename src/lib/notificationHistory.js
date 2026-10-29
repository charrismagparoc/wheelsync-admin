// What the admin has cleared from the notifications screen. This only hides notifications in this
// browser; the records stay in the database. Every week (from Monday) notifications older than
// RETENTION_DAYS are cleared from view automatically.
const RETENTION_DAYS = 3
const DAY_MS = 86400000
export const HISTORY_EVENT = 'wheelsync-notification-history'

const key = (userId, name) => `wheelsync-notifications-${name}-${userId}`

function read(name, userId) {
  try { return localStorage.getItem(key(userId, name)) } catch { return null }
}

function write(name, userId, value) {
  try {
    if (value == null) localStorage.removeItem(key(userId, name))
    else localStorage.setItem(key(userId, name), String(value))
  } catch { /* storage unavailable: clearing simply won't be remembered */ }
}

// Monday 00:00 of the current week, as a date string such as "2026-10-12".
export function startOfWeek(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

// Timestamp (ms) before which notifications are hidden; runs the weekly cleanup when a new week starts.
export function hiddenBefore(userId) {
  if (!userId) return 0
  let cutoff = Number(read('hidden-before', userId)) || 0
  const week = startOfWeek().toDateString()
  if (read('cleanup-week', userId) !== week) {
    cutoff = Math.max(cutoff, Date.now() - RETENTION_DAYS * DAY_MS)
    write('hidden-before', userId, cutoff)
    write('cleanup-week', userId, week)
  }
  return cutoff
}

export function isShown(item, cutoff) {
  return new Date(item.created_at).getTime() > cutoff
}

function announce() {
  window.dispatchEvent(new Event(HISTORY_EVENT))
}

export function clearHistory(userId) {
  write('hidden-before', userId, Date.now())
  announce()
}

// Show everything again (the next weekly cleanup still applies).
export function restoreHistory(userId) {
  write('hidden-before', userId, 0)
  announce()
}

export { RETENTION_DAYS }

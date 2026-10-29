import { AlarmClock, Bell, CalendarCheck, CalendarPlus, CalendarX, CarFront, ClipboardCheck, FileText, Sparkles, UserRoundCog } from 'lucide-react'

// Matches Notification.kind from the API. `group` drives the filter tabs on the Notifications page.
export const KINDS = {
  return_reminder_2h: { label: 'Due back in 2 hours', icon: AlarmClock, tone: 'warning', group: 'returns' },
  return_reminder_30m: { label: 'Due back in 30 minutes', icon: AlarmClock, tone: 'danger', group: 'returns' },
  vehicle_returned: { label: 'Vehicle returned', icon: CarFront, tone: 'success', group: 'returns' },
  booking_request: { label: 'Booking request', icon: CalendarPlus, tone: 'info', group: 'bookings' },
  booking_accepted: { label: 'Booking accepted', icon: CalendarCheck, tone: 'success', group: 'bookings' },
  booking_rejected: { label: 'Booking rejected', icon: CalendarX, tone: 'danger', group: 'bookings' },
  booking_status: { label: 'Booking update', icon: CalendarCheck, tone: 'info', group: 'bookings' },
  inspection: { label: 'Inspection', icon: ClipboardCheck, tone: 'info', group: 'operations' },
  cleaning: { label: 'Cleaning', icon: Sparkles, tone: 'info', group: 'operations' },
  task_assigned: { label: 'Staff task', icon: UserRoundCog, tone: 'info', group: 'operations' },
  task_reassigned: { label: 'Staff task', icon: UserRoundCog, tone: 'info', group: 'operations' },
  requirements: { label: 'Customer requirements', icon: FileText, tone: 'info', group: 'operations' },
  general: { label: 'Update', icon: Bell, tone: 'muted', group: 'operations' },
}

export const TONES = {
  warning: { color: 'var(--warning)', background: 'rgba(251,191,36,0.14)' },
  danger: { color: 'var(--danger)', background: 'rgba(251,113,133,0.14)' },
  success: { color: 'var(--success)', background: 'rgba(74,222,128,0.14)' },
  info: { color: 'var(--nebula-3)', background: 'rgba(56,189,248,0.14)' },
  muted: { color: 'var(--text-muted)', background: 'var(--bg-surface-2)' },
}

export function kindOf(notification) {
  return KINDS[notification.kind] ?? KINDS.general
}

export const isReturnReminder = (notification) => notification.kind?.startsWith('return_reminder_')

export function formatDue(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function timeLeft(minutes) {
  if (minutes < 0) return `${formatDuration(-minutes)} overdue`
  return `${formatDuration(minutes)} left`
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export const SERVICE_LABELS = { self_drive: 'Self-drive', with_driver: 'With driver', pickup_dropoff: 'Pickup / drop-off' }

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

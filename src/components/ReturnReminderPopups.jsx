import { useCallback, useEffect, useState } from 'react'
import { AlarmClock, Check, Copy, Phone, X } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import { SERVICE_LABELS, TONES, copyText, formatDue, isReturnReminder } from '../lib/notificationKinds'

const SEEN_KEY = 'wheelsync-admin-seen-return-reminders'

function readSeen() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function writeSeen(seen) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)))
  } catch {
    // private window: pop-ups may show again after a reload, which is harmless
  }
}

// Pop-up in the corner when a 2-hour or 30-minute return reminder arrives, with the name and number to call.
export default function ReturnReminderPopups() {
  const [popups, setPopups] = useState([])
  const [copied, setCopied] = useState('')

  const check = useCallback(async () => {
    try {
      const latest = await api.get('/notifications', { limit: 20 })
      const seen = readSeen()
      const fresh = latest.filter((item) => isReturnReminder(item) && !item.is_read && !seen.has(item.id))
      if (!fresh.length) return
      fresh.forEach((item) => seen.add(item.id))
      writeSeen(seen)
      setPopups((current) => [...fresh.filter((item) => !current.some((shown) => shown.id === item.id)), ...current].slice(0, 4))
    } catch {
      // the bell badge and Notifications page still show reminders
    }
  }, [])

  useEffect(() => {
    check()
    return subscribe('notifications', check)
  }, [check])

  function dismiss(id) {
    setPopups((current) => current.filter((item) => item.id !== id))
  }

  async function acknowledge(item) {
    dismiss(item.id)
    try {
      await api.post(`/notifications/${item.id}/read`)
    } catch {
      // stays unread on the Notifications page
    }
  }

  async function copy(item) {
    if (item.data?.customer_phone && await copyText(item.data.customer_phone)) {
      setCopied(item.id)
      setTimeout(() => setCopied(''), 1500)
    }
  }

  if (!popups.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" role="region" aria-label="Return reminders">
      {popups.map((item) => {
        const urgent = item.kind === 'return_reminder_30m'
        const tone = TONES[urgent ? 'danger' : 'warning']
        const data = item.data || {}
        return (
          <article key={item.id} role="alert" className="card overflow-hidden shadow-2xl" style={{ border: `1px solid ${tone.color}` }}>
            <header className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ background: tone.background }}>
              <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: tone.color }}>
                <AlarmClock size={16} /> {urgent ? 'Vehicle due back in 30 minutes' : 'Vehicle due back in 2 hours'}
              </p>
              <button onClick={() => dismiss(item.id)} className="p-1" aria-label="Close reminder"><X size={16} /></button>
            </header>
            <div className="flex flex-col gap-2 p-4">
              <p className="font-display text-lg font-semibold leading-tight">{data.customer_name || 'Customer'}</p>
              <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface-2)' }}>
                <a href={data.customer_phone ? `tel:${data.customer_phone}` : undefined} className="flex items-center gap-2 text-lg font-semibold tabular-nums select-all">
                  <Phone size={16} style={{ color: 'var(--nebula-3)' }} /> {data.customer_phone || 'No mobile number'}
                </a>
                {data.customer_phone && (
                  <button onClick={() => copy(item)} className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs">
                    {copied === item.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {data.vehicle} · {data.plate_number}<br />
                Due {data.due_at ? formatDue(data.due_at) : 'soon'} · {SERVICE_LABELS[data.service_type] ?? data.service_type}
                {data.service_type === 'pickup_dropoff' && data.pickup_location ? <><br />Pickup at {data.pickup_location}</> : null}
              </p>
              <button onClick={() => acknowledge(item)} className="btn-primary mt-1 px-3 py-2 text-sm">Got it, I will call</button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

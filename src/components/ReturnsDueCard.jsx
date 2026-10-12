import { useCallback, useEffect, useState } from 'react'
import { AlarmClock, Check, Copy, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import { SERVICE_LABELS, TONES, copyText, formatDue, timeLeft } from '../lib/notificationKinds'

function urgency(minutes) {
  if (minutes < 0) return { tone: 'danger', label: 'Overdue' }
  if (minutes <= 30) return { tone: 'danger', label: 'Due in 30 min' }
  if (minutes <= 120) return { tone: 'warning', label: 'Due in 2 hours' }
  return { tone: 'muted', label: 'Later today' }
}

// Dashboard card: rentals due back soon, with the customer's name and number so the admin can call.
export default function ReturnsDueCard() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await api.get('/bookings/returns-due', { hours: 24 }))
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load returns due.')
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000) // keep the countdown current
    const unsubscribe = subscribe(['bookings', 'notifications'], load)
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [load])

  async function copy(row) {
    if (row.customer_phone && await copyText(row.customer_phone)) {
      setCopied(row.booking_id)
      setTimeout(() => setCopied(''), 1500)
    }
  }

  return (
    <section className="card p-5 mb-8" aria-labelledby="returns-due-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 id="returns-due-title" className="font-display font-semibold flex items-center gap-2"><AlarmClock size={18} style={{ color: 'var(--warning)' }} /> Returns due</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Rented-out vehicles whose return time is within the next 24 hours. Before each return time, the customer and you get two reminders: one 2 hours before and one 30 minutes before. Use the number shown to call the customer.</p>
        </div>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{rows.length} {rows.length === 1 ? 'rental' : 'rentals'}</span>
      </div>
      {error && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm py-4 text-center rounded-xl" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>No vehicles are due back in the next 24 hours.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const state = urgency(row.minutes_left)
            return (
              <article key={row.booking_id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-surface-2)', border: `1px solid ${state.tone === 'muted' ? 'var(--border-soft)' : TONES[state.tone].color}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{row.customer_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.vehicle} · {row.plate_number}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={TONES[state.tone]}>{state.label}</span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface)' }}>
                  <a href={row.customer_phone ? `tel:${row.customer_phone}` : undefined} className="flex items-center gap-2 font-display text-lg font-semibold tabular-nums select-all">
                    <Phone size={16} style={{ color: 'var(--nebula-3)' }} /> {row.customer_phone || 'No mobile number'}
                  </a>
                  {row.customer_phone && (
                    <button onClick={() => copy(row)} className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs" aria-label={`Copy ${row.customer_name}'s number`}>
                      {copied === row.booking_id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt style={{ color: 'var(--text-muted)' }}>Due back</dt><dd className="text-right font-medium">{formatDue(row.due_at)}</dd>
                  <dt style={{ color: 'var(--text-muted)' }}>Time</dt><dd className="text-right font-medium" style={{ color: state.tone === 'muted' ? undefined : TONES[state.tone].color }}>{timeLeft(row.minutes_left)}</dd>
                  <dt style={{ color: 'var(--text-muted)' }}>Service</dt><dd className="text-right">{SERVICE_LABELS[row.service_type] ?? row.service_type}</dd>
                  {row.service_type === 'pickup_dropoff' && <><dt style={{ color: 'var(--text-muted)' }}>Pickup at</dt><dd className="text-right">{row.pickup_location || '—'}</dd></>}
                  <dt style={{ color: 'var(--text-muted)' }}>Staff in charge</dt><dd className="text-right">{row.staff_name || '—'}</dd>
                </dl>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full px-2 py-0.5" style={row.reminder_2h_sent_at ? TONES.success : TONES.muted}>{row.reminder_2h_sent_at ? '✓ ' : ''}2-hour reminder</span>
                  <span className="rounded-full px-2 py-0.5" style={row.reminder_30m_sent_at ? TONES.success : TONES.muted}>{row.reminder_30m_sent_at ? '✓ ' : ''}30-minute reminder</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

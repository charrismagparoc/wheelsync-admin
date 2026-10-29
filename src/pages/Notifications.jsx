import { useEffect, useState } from 'react'
import { CheckCheck, History, Phone, RotateCcw, Trash2, Volume2, VolumeX } from 'lucide-react'
import { playChime, setSoundEnabled, soundEnabled } from '../lib/sound'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'
import { TONES, formatDue, isReturnReminder, kindOf } from '../lib/notificationKinds'
import { useAuth } from '../context/AuthContext'
import { HISTORY_EVENT, RETENTION_DAYS, clearHistory, hiddenBefore, isShown, restoreHistory, startOfWeek } from '../lib/notificationHistory'

const TABS = [
  ['all', 'All'],
  ['returns', 'Return reminders'],
  ['bookings', 'Bookings'],
  ['operations', 'Staff and inspections'],
]

const CATEGORY_ORDER = TABS.slice(1)

const VIEWS = [
  ['current', 'Current'],
  ['history', 'Full history'],
]

const PERIODS = [
  ['all', 'All time'],
  ['recent', 'Recent'],
  ['today', 'Today'],
  ['week', 'This week'],
]

const DAY_MS = 86400000
const startOfToday = () => { const day = new Date(); day.setHours(0, 0, 0, 0); return day.getTime() }

function inPeriod(item, period) {
  const time = new Date(item.created_at).getTime()
  if (period === 'recent') return time > Date.now() - DAY_MS // last 24 hours
  if (period === 'today') return time >= startOfToday()
  if (period === 'week') return time >= startOfWeek().getTime()
  return true
}

// Date heading a notification is listed under: Today, Yesterday, then the exact day.
function dayOf(item) {
  const created = new Date(item.created_at)
  const time = created.getTime()
  const today = startOfToday()
  if (time >= today) return 'Today'
  if (time >= today - DAY_MS) return 'Yesterday'
  return created.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Newest first, one section per day, and inside each day one block per category (same order as the tabs).
function arrange(list) {
  const days = []
  ;[...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach((item) => {
    const label = dayOf(item)
    let day = days.find((entry) => entry.label === label)
    if (!day) days.push(day = { label, items: [] })
    day.items.push(item)
  })
  return days.map((day) => ({
    ...day,
    categories: CATEGORY_ORDER
      .map(([key, label]) => ({ key, label, items: day.items.filter((item) => kindOf(item).group === key) }))
      .filter((category) => category.items.length),
  }))
}

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Notifications() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('all')
  const [sound, setSound] = useState(soundEnabled)
  const [view, setView] = useState('current')
  const [period, setPeriod] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [cutoff, setCutoff] = useState(() => hiddenBefore(profile?.id))

  async function load() {
    try {
      setItems(await api.get('/notifications'))
    } catch (error) {
      console.error('Unable to load notifications:', error.message)
    }
  }

  useEffect(() => {
    load()
    return subscribe('notifications', load)
  }, [])

  // Re-read what is cleared when the user changes or the history is cleared or restored.
  useEffect(() => {
    const refresh = () => setCutoff(hiddenBefore(profile?.id))
    refresh()
    window.addEventListener(HISTORY_EVENT, refresh)
    return () => window.removeEventListener(HISTORY_EVENT, refresh)
  }, [profile?.id])

  async function markRead(item) {
    if (item.is_read) return
    try {
      await api.post(`/notifications/${item.id}/read`)
    } catch (error) {
      console.error('Unable to mark notification read:', error.message)
    }
    load()
  }

  async function markAllRead() {
    await Promise.allSettled(tabItems.filter((item) => !item.is_read).map((item) => api.post(`/notifications/${item.id}/read`)))
    load()
  }

  function clearAll() {
    if (!window.confirm('Clear all notifications from this screen? They stay saved in the system and can be restored.')) return
    clearHistory(profile?.id)
  }

  // Current = what is still on screen after clearing; Full history = every notification ever received.
  const shown = view === 'history' ? items : items.filter((item) => isShown(item, cutoff))
  const hiddenCount = items.filter((item) => !isShown(item, cutoff)).length
  const countFor = (key) => shown.filter((item) => !item.is_read && (key === 'all' || kindOf(item).group === key)).length
  const tabItems = shown.filter((item) => tab === 'all' || kindOf(item).group === tab)
  const unreadVisible = tabItems.filter((item) => !item.is_read).length
  const visible = tabItems.filter((item) => inPeriod(item, period) && (!unreadOnly || !item.is_read)
    && matchesSearch(search, item.title, item.body, kindOf(item).label, item.data?.customer_name, item.data?.customer_phone, item.data?.vehicle, item.data?.plate_number))
  const days = arrange(visible)
  const filtered = Boolean(search.trim()) || period !== 'all' || unreadOnly

  return (
    <Layout>
      {/* Title row: what you are looking at (Current / Full history) and the actions for it. */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">Notifications</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Return reminders, booking updates and staff activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { const next = !sound; setSound(next); setSoundEnabled(next); if (next) playChime() }}
            aria-pressed={sound}
            className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"
            title={sound ? 'A chime plays when a new notification arrives' : 'New notifications arrive silently'}
          >
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound {sound ? 'on' : 'off'}
          </button>
          {unreadVisible > 0 && (
            <button onClick={markAllRead} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><CheckCheck size={15} /> Mark {unreadVisible} as read</button>
          )}
          {view === 'current' && shown.length > 0 && (
            <button onClick={clearAll} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><Trash2 size={15} /> Clear screen</button>
          )}
          <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-surface-2)' }} role="group" aria-label="Which notifications">
            {VIEWS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ background: view === key ? 'var(--gradient-primary)' : 'transparent', color: view === key ? 'white' : 'var(--text-muted)' }}
              >
                {key === 'history' && <History size={14} />} {label}
                {key === 'history' && <span className="text-xs opacity-80">({items.length})</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* One filter panel: category tabs on top, then search + time + unread on one line. */}
      <div className="card p-4 mb-3 grid gap-3">
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Category">
          {TABS.map(([key, label]) => {
            const unread = countFor(key)
            return (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: tab === key ? 'var(--gradient-primary)' : 'var(--bg-surface-2)', color: tab === key ? 'white' : 'var(--text-muted)' }}
              >
                {label}
                {unread > 0 && <span className="rounded-full px-1.5 text-xs font-bold text-white" style={{ background: 'var(--danger)' }}>{unread}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search title, customer, phone, vehicle, or plate" />
          <select aria-label="Time period" value={period} onChange={(event) => setPeriod(event.target.value)} className="px-3 py-2 text-sm">
            {PERIODS.map(([key, label]) => <option key={key} value={key}>{key === 'recent' ? 'Last 24 hours' : label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only
          </label>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-5 px-1" style={{ color: 'var(--text-faint)' }}>
        <span className="flex items-center gap-1.5"><History size={13} /> {view === 'history'
          ? 'Every notification ever received, newest first, sorted by day and then by category.'
          : `Notifications older than ${RETENTION_DAYS} days are cleared from this screen every week. Full history keeps them all.`}</span>
        {view === 'current' && hiddenCount > 0 && (
          <button type="button" onClick={() => restoreHistory(profile?.id)} className="flex items-center gap-1 font-medium" style={{ color: 'var(--nebula-3)' }}>
            <RotateCcw size={12} /> {hiddenCount} cleared · Restore
          </button>
        )}
      </p>

      <div className="grid gap-6">
        {days.map((day) => (
          <section key={day.label} className="grid gap-3" aria-label={day.label}>
            <h2 className="flex items-center gap-3 text-sm font-semibold">
              {day.label}
              <span className="text-xs font-normal" style={{ color: 'var(--text-faint)' }}>{day.items.length} notification{day.items.length === 1 ? '' : 's'}</span>
              <span className="h-px flex-1" style={{ background: 'var(--border-soft)' }} />
            </h2>
            {day.categories.map((category) => (
            <div key={category.key} className="grid gap-2 pl-3" style={{ borderLeft: '2px solid var(--border-soft)' }}>
              {tab === 'all' && <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{category.label} · {category.items.length}</h3>}
            {category.items.map((item) => {
              const kind = kindOf(item)
              const Icon = kind.icon
              const tone = TONES[kind.tone]
              return (
                <button key={item.id} onClick={() => markRead(item)} className="card p-4 text-left flex gap-4" style={{ borderColor: item.is_read ? 'var(--border-soft)' : tone.color }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={tone}><Icon size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={tone}>{kind.label}</span>
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }} title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)} · {new Date(item.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                      {!item.is_read && <span className="badge badge-ongoing ml-auto">New</span>}
                    </div>
                    <p className="font-medium mt-1.5">{item.title}</p>
                    {isReturnReminder(item) && item.data?.customer_name ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="font-semibold">{item.data.customer_name}</span>
                        <span className="flex items-center gap-1.5 font-semibold tabular-nums select-all" style={{ color: 'var(--nebula-3)' }}><Phone size={14} /> {item.data.customer_phone || 'No mobile number'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{item.data.vehicle} · {item.data.plate_number}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Due {formatDue(item.data.due_at)}</span>
                      </div>
                    ) : (
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{item.body}</p>
                    )}
                  </div>
                </button>
              )
            })}
            </div>
            ))}
          </section>
        ))}
        {visible.length === 0 && (
          <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            {filtered && tabItems.length
              ? 'No notifications match these filters.'
              : view === 'current' && hiddenCount && !shown.length
                ? 'This screen was cleared. Open Full history to see older notifications.'
                : 'No notifications here yet.'}
          </div>
        )}
      </div>
    </Layout>
  )
}

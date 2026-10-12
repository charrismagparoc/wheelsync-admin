import { useEffect, useState } from 'react'
import { CheckCheck, History, Phone, RotateCcw, Trash2 } from 'lucide-react'
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

// Heading a notification is listed under.
function groupOf(item) {
  const time = new Date(item.created_at).getTime()
  const today = startOfToday()
  if (time >= today) return 'Today'
  if (time >= today - DAY_MS) return 'Yesterday'
  if (time >= startOfWeek().getTime()) return 'Earlier this week'
  return 'Older'
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

  const shown = items.filter((item) => isShown(item, cutoff))
  const hiddenCount = items.length - shown.length
  const countFor = (key) => shown.filter((item) => !item.is_read && (key === 'all' || kindOf(item).group === key)).length
  const tabItems = shown.filter((item) => tab === 'all' || kindOf(item).group === tab)
  const unreadVisible = tabItems.filter((item) => !item.is_read).length
  const visible = tabItems.filter((item) => inPeriod(item, period) && (!unreadOnly || !item.is_read)
    && matchesSearch(search, item.title, item.body, kindOf(item).label, item.data?.customer_name, item.data?.customer_phone, item.data?.vehicle, item.data?.plate_number))
  const groups = visible.reduce((list, item) => {
    const label = groupOf(item)
    const group = list.find((entry) => entry.label === label)
    if (group) group.items.push(item)
    else list.push({ label, items: [item] })
    return list
  }, [])
  const filtered = Boolean(search.trim()) || period !== 'all' || unreadOnly

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">Notifications</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Return reminders, booking updates and staff activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadVisible > 0 && (
            <button onClick={markAllRead} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><CheckCheck size={15} /> Mark {unreadVisible} as read</button>
          )}
          {shown.length > 0 && (
            <button onClick={clearAll} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><Trash2 size={15} /> Clear history</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap" role="tablist">
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search title, customer, phone, vehicle, or plate" />
        <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-surface-2)' }} role="group" aria-label="Time period">
          {PERIODS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              title={key === 'recent' ? 'Last 24 hours' : undefined}
              className="rounded-full px-3 py-1.5 text-sm font-medium"
              style={{ background: period === key ? 'var(--gradient-primary)' : 'transparent', color: period === key ? 'white' : 'var(--text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only
        </label>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-5" style={{ color: 'var(--text-faint)' }}>
        <span className="flex items-center gap-1.5"><History size={13} /> Every week, notifications older than {RETENTION_DAYS} days are cleared from this screen. Records stay saved in the system.</span>
        {hiddenCount > 0 && (
          <button type="button" onClick={() => restoreHistory(profile?.id)} className="flex items-center gap-1 font-medium" style={{ color: 'var(--nebula-3)' }}>
            <RotateCcw size={12} /> {hiddenCount} cleared · Restore
          </button>
        )}
      </p>

      <div className="grid gap-5">
        {groups.map((group) => (
          <section key={group.label} className="grid gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{group.label}</h2>
            {group.items.map((item) => {
              const kind = kindOf(item)
              const Icon = kind.icon
              const tone = TONES[kind.tone]
              return (
                <button key={item.id} onClick={() => markRead(item)} className="card p-4 text-left flex gap-4" style={{ borderColor: item.is_read ? 'var(--border-soft)' : tone.color }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={tone}><Icon size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={tone}>{kind.label}</span>
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{timeAgo(item.created_at)}</span>
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
          </section>
        ))}
        {visible.length === 0 && (
          <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            {filtered && tabItems.length ? 'No notifications match these filters.' : hiddenCount && !shown.length ? 'Notification history cleared.' : 'No notifications here yet.'}
          </div>
        )}
      </div>
    </Layout>
  )
}

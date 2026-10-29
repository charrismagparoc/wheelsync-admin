import { useEffect, useState } from 'react'
import { CalendarClock, Car, Users, TrendingUp, CalendarDays, CalendarRange, Calendar } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import ReturnsDueCard from '../components/ReturnsDueCard'
import FleetCalendar from '../components/FleetCalendar'
import MonthlyRentalsChart from '../components/MonthlyRentalsChart'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'

export default function Dashboard() {
  const [stats, setStats] = useState({ pending: 0, vehicles: 0, customers: 0, revenue: 0 })
  const [revenue, setRevenue] = useState({ today: 0, month: 0, year: 0, total: 0 })
  const [recent, setRecent] = useState([])
  const [monthlyRentals, setMonthlyRentals] = useState([])
  const [chartYear, setChartYear] = useState(new Date().getFullYear())
  const [statsError, setStatsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setStatsError('')
    try {
      const data = await api.get('/admin/dashboard', { year: new Date().getFullYear() })
      setStats({ pending: data.pending, vehicles: data.vehicles, customers: data.customers, current_renters: data.current_renters ?? 0, revenue: data.revenue })
      setRevenue(data.revenue_breakdown ?? { today: 0, month: 0, year: 0, total: data.revenue })
      setRecent(data.recent ?? [])
      setChartYear(data.year)
      setMonthlyRentals(data.monthly_rentals.map(({ month, count }) => ({
        month: new Date(data.year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' }),
        count,
      })))
    } catch (error) {
      setStatsError(error.message || 'Unable to load dashboard statistics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
  }, [])

  const visibleRecent = recent.filter((b) => matchesSearch(search, b.profiles?.full_name, b.vehicles?.make, b.vehicles?.model, b.vehicles?.plate_number, b.start_date, b.end_date, b.status))
  const busiestMonth = monthlyRentals.reduce((busiest, month) => month.count > busiest.count ? month : busiest, { month: 'No rentals yet', count: 0 })
  const peso = (amount) => `₱${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  const now = new Date()

  const revenuePeriods = [
    { label: 'Today', hint: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: revenue.today, icon: CalendarDays },
    { label: 'This month', hint: now.toLocaleDateString(undefined, { month: 'long' }), value: revenue.month, icon: CalendarRange },
    { label: 'This year', hint: String(now.getFullYear()), value: revenue.year, icon: Calendar },
    { label: 'All time', hint: 'Since the start', value: revenue.total, icon: TrendingUp },
  ]

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Live overview of Pardz Car Rental bookings and fleet.</p>
        </div>
      </div>
      {statsError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{statsError}</p>}

      {/* 1. At a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending requests" value={stats.pending} icon={CalendarClock} />
        <StatCard label="Fleet size" value={stats.vehicles} icon={Car} />
        <StatCard label="Current Renters" value={stats.current_renters} icon={Users} hint="Customers with a car out right now" />
      </div>

      {/* 2. Revenue, all periods in one panel */}
      <section className="card p-5 mb-6" aria-labelledby="revenue-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h2 id="revenue-heading" className="font-display font-semibold">Completed revenue</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Money recorded on the Transactions page (prices are agreed at the office).</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {revenuePeriods.map(({ label, hint, value, icon: Icon }, index) => (
            <div key={label} className="rounded-xl p-4" style={{ background: index === 3 ? 'var(--gradient-primary)' : 'var(--bg-surface-2)', color: index === 3 ? 'white' : undefined }}>
              <p className="flex items-center gap-2 text-sm" style={{ color: index === 3 ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}><Icon size={15} /> {label}</p>
              <p className="font-display text-2xl font-semibold mt-1.5 break-words">{peso(value)}</p>
              <p className="text-xs mt-0.5" style={{ color: index === 3 ? 'rgba(255,255,255,0.75)' : 'var(--text-faint)' }}>{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Returns due in the middle, highlighted: who to call before a car comes back. */}
      <ReturnsDueCard className="mb-6" style={{ borderColor: 'var(--warning)', borderWidth: 2 }} />

      {/* Fleet calendar: which car is free, pending or rented on each day (live). */}
      <FleetCalendar />

      {/* 4. Rentals per month */}
      <section className="card p-5 mb-6" aria-labelledby="rentals-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 id="rentals-heading" className="font-display font-semibold">Rentals per month · {chartYear}</h2>
          <p className="text-sm">{busiestMonth.count ? <>Busiest: <strong>{busiestMonth.month}</strong> · {busiestMonth.count} rental{busiestMonth.count === 1 ? '' : 's'}</> : 'No rentals yet this year.'}</p>
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Accepted, ongoing and completed bookings plus recorded transactions, by start month. Hover a column for the exact number.</p>
        <MonthlyRentalsChart months={monthlyRentals} year={chartYear} />
      </section>

      {/* 5. Latest bookings */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-semibold">Recent bookings</h2>
          <SearchBar value={search} onChange={setSearch} placeholder="Search customer, vehicle, plate, or status" className="max-w-md" />
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : visibleRecent.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{recent.length ? 'No recent bookings match this search.' : 'No bookings yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 font-medium">Vehicle</th>
                  <th className="py-2 pr-4 font-medium">Dates</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecent.map((b) => (
                  <tr key={b.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                    <td className="py-2.5 pr-4">{b.profiles?.full_name ?? '—'}</td>
                    <td className="py-2.5 pr-4">{b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : '—'}</td>
                    <td className="py-2.5 pr-4">{b.start_date} {b.pickup_time?.slice(0, 5) || ''} → {b.end_date} {b.return_time?.slice(0, 5) || ''}</td>
                    <td className="py-2.5 pr-4"><Badge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}

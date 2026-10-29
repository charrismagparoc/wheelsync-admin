import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { PageHeader, FilterBar } from '../components/PageParts'
import SearchBar from '../components/SearchBar'

const AREA_LABELS = {
  booking: 'Booking', inspection: 'Inspection', cleaning: 'Cleaning', vehicle: 'Vehicle', customer: 'Customer',
  staff: 'Staff', transaction: 'Transaction', location: 'Location', auth: 'Sign-in',
}

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Search on the server (debounced) so older entries are found too, not only the latest page.
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await api.get('/admin/audit-logs', { q: search.trim(), limit: 500 })
        if (active) setEntries(rows)
      } catch (loadError) {
        if (active) setError(`Could not load the audit log: ${loadError.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }, search ? 300 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [search])

  return (
    <Layout>
      <PageHeader title="Audit log" description="Every change made in the admin console and by staff: who did it, what changed, and when. Entries can't be edited or deleted." />
      <FilterBar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search person, action, customer, or plate" />
      </FilterBar>
      {error && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-5 font-medium">When</th>
              <th className="py-3 px-5 font-medium">Who</th>
              <th className="py-3 px-5 font-medium">Area</th>
              <th className="py-3 px-5 font-medium">What happened</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const area = entry.action.split('.')[0]
              return (
                <tr key={entry.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-5 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="py-3 px-5">{entry.actor_name}<p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{entry.actor_role}</p></td>
                  <td className="py-3 px-5"><span className="badge badge-ongoing">{AREA_LABELS[area] || area}</span></td>
                  <td className="py-3 px-5">{entry.summary}</td>
                </tr>
              )
            })}
            {!loading && entries.length === 0 && !error && (
              <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{search ? 'No entries match this search.' : 'No actions recorded yet. New actions appear here from now on.'}</td></tr>
            )}
            {loading && <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

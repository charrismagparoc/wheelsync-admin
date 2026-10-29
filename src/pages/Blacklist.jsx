import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { PageHeader, FilterBar } from '../components/PageParts'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'

const AREAS = { CDO: 'Cagayan de Oro', CEB: 'Cebu', DVO: 'Davao' }
const SOURCES = { RN: 'RN (as written on the list)', FB: 'Facebook' }
const REASONS = ['Bad Renter', 'Payment Issue', 'Scammer', 'Rent Sangla', 'Rent Tangay', 'Sub-Lease', 'Identity Theft', 'Drug Related']
const EMPTY_RECORD = { full_name: '', area: 'CDO', source: 'RN', reason: 'Bad Renter', notes: '' }

export default function Blacklist() {
  const [customers, setCustomers] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = adding, record = editing
  const [form, setForm] = useState(EMPTY_RECORD)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [blocked, list] = await Promise.all([
        api.get('/admin/customers', { blacklisted: true }),
        api.get('/admin/blacklist-records'),
      ])
      setCustomers(blocked)
      setRecords(list)
    } catch (loadError) {
      console.error('Unable to load blacklist:', loadError.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function removeFromBlacklist(id) {
    try {
      await api.patch(`/admin/customers/${id}/blacklist`, { is_blacklisted: false })
    } catch (updateError) {
      console.error('Unable to update blacklist:', updateError.message)
    }
    load()
  }

  function openForm(record = null) {
    setEditing(record || {})
    setForm(record ? { full_name: record.full_name, area: record.area || '', source: record.source || '', reason: record.reason, notes: record.notes || '' } : EMPTY_RECORD)
    setError('')
  }

  async function saveRecord(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (editing.id) await api.patch(`/admin/blacklist-records/${editing.id}`, form)
      else await api.post('/admin/blacklist-records', form)
    } catch (saveError) {
      setBusy(false)
      setError(saveError.message)
      return
    }
    setBusy(false)
    setEditing(null)
    load()
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Remove ${record.full_name} from the blacklist records?`)) return
    try {
      await api.delete(`/admin/blacklist-records/${record.id}`)
    } catch (deleteError) {
      console.error('Unable to remove blacklist record:', deleteError.message)
    }
    load()
  }

  const reasons = [...new Set([...REASONS, ...records.map((record) => record.reason)])]
  const visibleRecords = records
    .filter((record) => !reasonFilter || record.reason === reasonFilter)
    .filter((record) => matchesSearch(search, record.full_name, record.reason, record.area, AREAS[record.area], record.source, record.notes))
  const visibleCustomers = customers.filter((customer) => matchesSearch(search, customer.full_name, customer.email, customer.phone))

  return (
    <Layout>
      <PageHeader
        title="Blacklist"
        description="Pardz's list of renters not to transact with, and customer accounts that are blocked from logging in. Customers whose name matches a record are flagged on the Customers page."
        actions={(
          <button onClick={() => openForm()} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <Plus size={16} /> Add to list
          </button>
        )}
      />

      {editing && (
        <Modal
          title={editing.id ? `Edit · ${editing.full_name}` : 'Add to blacklist'}
          description="Customers whose name matches this record are flagged for review."
          onClose={() => { if (!busy) setEditing(null) }}
          size="max-w-lg"
        >
          <form onSubmit={saveRecord} className="flex flex-col gap-3">
            {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            <label className="flex flex-col gap-1 text-sm">Full name<input required autoFocus className="px-3 py-2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">Area
                <select className="px-3 py-2" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                  <option value="">—</option>
                  {Object.entries(AREAS).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">Source
                <select className="px-3 py-2" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="">—</option>
                  {Object.keys(SOURCES).map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">Reason
              <select className="px-3 py-2" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {reasons.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Notes (optional)<textarea rows={3} className="px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="modal-actions flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">{busy ? 'Saving…' : editing.id ? 'Save changes' : 'Add to list'}</button>
            </div>
          </form>
        </Modal>
      )}

      <FilterBar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, reason, or area" />
        <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className="px-3 py-2 text-sm" aria-label="Filter by reason">
          <option value="">All reasons</option>
          {reasons.map((reason) => <option key={reason}>{reason}</option>)}
        </select>
      </FilterBar>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Blacklist records ({visibleRecords.length}{visibleRecords.length !== records.length ? ` of ${records.length}` : ''})</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="py-3 px-5 font-medium">#</th>
                  <th className="py-3 px-5 font-medium">Name</th>
                  <th className="py-3 px-5 font-medium">Area</th>
                  <th className="py-3 px-5 font-medium">Source</th>
                  <th className="py-3 px-5 font-medium">Reason</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {visibleRecords.map((record, index) => (
                    <tr key={record.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                      <td className="py-3 px-5" style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                      <td className="py-3 px-5 font-medium">{record.full_name}{record.notes && <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{record.notes}</span>}</td>
                      <td className="py-3 px-5" title={AREAS[record.area]}>{record.area || '—'}</td>
                      <td className="py-3 px-5" title={SOURCES[record.source]}>{record.source || '—'}</td>
                      <td className="py-3 px-5"><span className="badge badge-rejected">{record.reason}</span></td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <button onClick={() => openForm(record)} className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Pencil size={13} /> Edit</button>
                        <button onClick={() => deleteRecord(record)} className="btn-ghost ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs" style={{ color: 'var(--danger)' }}><Trash2 size={13} /> Remove</button>
                      </td>
                    </tr>
                  ))}
                  {visibleRecords.length === 0 && <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{records.length ? 'No records match this search.' : 'No blacklist records yet.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Blocked customer accounts ({visibleCustomers.length})</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="py-3 px-5 font-medium">Name</th>
                  <th className="py-3 px-5 font-medium">Email</th>
                  <th className="py-3 px-5 font-medium">Phone</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr></thead>
                <tbody>
                  {visibleCustomers.map((customer) => (
                    <tr key={customer.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                      <td className="py-3 px-5">{customer.full_name}</td>
                      <td className="py-3 px-5">{customer.email || '—'}</td>
                      <td className="py-3 px-5">{customer.phone || '—'}</td>
                      <td className="py-3 px-5 text-right"><button onClick={() => removeFromBlacklist(customer.id)} className="btn-ghost px-3 py-1.5 text-xs">Unblock</button></td>
                    </tr>
                  ))}
                  {visibleCustomers.length === 0 && <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{customers.length ? 'No blocked accounts match this search.' : 'No customer accounts are blocked. Use Blacklist on the Customers page to block one.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Layout>
  )
}

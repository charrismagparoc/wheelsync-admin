import { useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import { PageHeader, FilterBar } from '../components/PageParts'
import { matchesSearch } from '../lib/search'

// Destinations customers can pick when booking. Every destination here shows in the customer site.
export default function Locations() {
  const [locations, setLocations] = useState([])
  const [names, setNames] = useState({}) // id -> name being edited in the table
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    try {
      const rows = await api.get('/admin/locations')
      setLocations(rows)
      setNames(Object.fromEntries(rows.map((row) => [row.id, row.name])))
    } catch (loadError) {
      setError(`Could not load the destinations: ${loadError.message}`)
    }
  }

  useEffect(() => { load() }, [])

  async function addLocation(event) {
    event.preventDefault()
    setFormError('')
    setBusyId('new')
    try {
      const nextOrder = locations.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1
      await api.post('/admin/locations', { name: newName.trim(), sort_order: nextOrder })
      setShowForm(false)
      setNotice(`${newName.trim()} was added. Customers can choose it now.`)
      load()
    } catch (createError) {
      setFormError(createError.message)
    } finally {
      setBusyId('')
    }
  }

  async function renameLocation(location) {
    setError('')
    setBusyId(location.id)
    try {
      await api.put(`/admin/locations/${location.id}`, { name: names[location.id].trim(), sort_order: location.sort_order })
      setNotice(`${location.name} was renamed to ${names[location.id].trim()}.`)
      load()
    } catch (saveError) {
      setError(`Could not rename ${location.name}: ${saveError.message}`)
    } finally {
      setBusyId('')
    }
  }

  async function removeLocation(location) {
    if (!window.confirm(`Remove ${location.name}? Customers won't be able to choose it any more. Existing bookings keep it.`)) return
    setError('')
    try {
      await api.delete(`/admin/locations/${location.id}`)
      setNotice(`${location.name} was removed.`)
      load()
    } catch (deleteError) {
      setError(`Could not remove ${location.name}: ${deleteError.message}`)
    }
  }

  const visible = locations.filter((row) => matchesSearch(search, row.name))

  return (
    <Layout>
      <PageHeader
        title="Destinations"
        description={`The places customers can choose when booking (${locations.length}). Every destination here appears in the customer site.`}
        actions={(
          <button onClick={() => { setNewName(''); setFormError(''); setShowForm(true) }} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <Plus size={16} /> Add destination
          </button>
        )}
      />

      {showForm && (
        <Modal title="Add destination" description="Customers can choose it in the booking form right away." onClose={() => setShowForm(false)} size="max-w-md">
          <form onSubmit={addLocation} className="flex flex-col gap-3">
            {formError && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
            <label className="flex flex-col gap-1 text-sm">Destination<input required autoFocus maxLength={200} className="px-3 py-2" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Bukidnon" /></label>
            <div className="modal-actions flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busyId === 'new'} className="btn-primary px-5 py-2 text-sm">{busyId === 'new' ? 'Adding…' : 'Add destination'}</button>
            </div>
          </form>
        </Modal>
      )}

      {error && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
      {notice && !error && <p role="status" className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{notice}</p>}

      <FilterBar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search destination" />
      </FilterBar>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-5 font-medium w-12">#</th>
              <th className="py-3 px-5 font-medium">Destination</th>
              <th className="py-3 px-5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((location) => {
              const renamed = (names[location.id] ?? '').trim()
              const changed = renamed && renamed !== location.name
              return (
                <tr key={location.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-2.5 px-5" style={{ color: 'var(--text-faint)' }}>{locations.indexOf(location) + 1}</td>
                  <td className="py-2.5 px-5">
                    <input aria-label={`Name of ${location.name}`} maxLength={200} className="px-3 py-1.5 w-full max-w-sm" value={names[location.id] ?? ''} onChange={(e) => setNames({ ...names, [location.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && changed) renameLocation(location) }} />
                  </td>
                  <td className="py-2.5 px-5">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => renameLocation(location)} disabled={!changed || busyId === location.id} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"><Save size={13} /> {busyId === location.id ? 'Saving…' : 'Save name'}</button>
                      <button onClick={() => removeLocation(location)} className="btn-ghost p-2" aria-label={`Remove ${location.name}`} title="Remove"><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{locations.length ? 'No destination matches this search.' : 'No destinations yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, HandCoins, Undo2 } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { PageHeader, FilterBar } from '../components/PageParts'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'

const PAGE_SIZE = 50
const PAYMENT_LABELS = { cash: 'Cash', gcash: 'GCash', bank_transfer: 'Bank transfer', card: 'Card', other: 'Other' }
const SERVICE_LABELS = { self_drive: 'Self-drive', with_driver: 'With driver', pickup_dropoff: 'Pickup / drop-off' }
const OTHER_VEHICLE = '__other__'
const OTHER_DESTINATION = '__other_destination__'
const today = () => new Date().toLocaleDateString('en-CA')
const emptyForm = () => ({
  customer_name: '', customer_phone: '', vehicle_id: '', vehicle_label: '', start_date: today(), end_date: today(),
  destination: '', service_type: 'self_drive', amount: '', payment_method: 'cash', notes: '',
})
const emptyExtension = () => ({ new_end_date: '', amount: '', payment_method: 'cash', notes: '' })
const peso = (amount) => `₱${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const dayAfter = (iso) => {
  const next = new Date(`${iso}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return next.toLocaleDateString('en-CA')
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [locations, setLocations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // transaction being edited; null = recording a new one
  const [otherDestination, setOtherDestination] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [extending, setExtending] = useState(null) // transaction getting an added payment
  const [extension, setExtension] = useState(emptyExtension)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  useEffect(() => { setShown(PAGE_SIZE) }, [search, from, to])

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setTransactions(await api.get('/admin/transactions', { start_from: from, start_to: to }))
    } catch (loadFailure) {
      setLoadError(`Could not load the transaction history: ${loadFailure.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // The form's dropdowns; the page still works (type the vehicle) if these fail.
    api.get('/vehicles').then(setVehicles).catch((failure) => console.error('Unable to load vehicles:', failure.message))
    api.get('/admin/locations').then((rows) => setLocations(rows.filter((row) => row.is_active))).catch((failure) => console.error('Unable to load locations:', failure.message))
  }, [])

  // Put an updated transaction back into the table without reloading everything.
  const replaceRow = (updated) => setTransactions((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))

  function openForm() {
    setEditing(null)
    setForm(emptyForm())
    setOtherDestination(false)
    setError('')
    setShowForm(true)
  }

  function openEdit(row) {
    const knownVehicle = row.vehicle_id && vehicles.some((vehicle) => vehicle.id === row.vehicle_id)
    const knownDestination = !row.destination || locations.some((location) => location.name === row.destination)
    setEditing(row)
    setForm({
      customer_name: row.customer_name, customer_phone: row.customer_phone || '',
      vehicle_id: knownVehicle ? row.vehicle_id : OTHER_VEHICLE, vehicle_label: knownVehicle ? '' : row.vehicle_label,
      start_date: row.start_date, end_date: row.end_date, destination: row.destination || '',
      service_type: row.service_type, amount: String(row.amount), payment_method: row.payment_method, notes: row.notes || '',
    })
    setOtherDestination(!knownDestination)
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    if (!busy) setShowForm(false)
  }

  async function saveTransaction(event) {
    event.preventDefault()
    setError('')
    if (form.end_date < form.start_date) return setError('The return date must be on or after the release date.')
    setBusy(true)
    const otherVehicle = form.vehicle_id === OTHER_VEHICLE
    const payload = {
      ...form,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      vehicle_id: otherVehicle || !form.vehicle_id ? null : form.vehicle_id,
      vehicle_label: otherVehicle ? form.vehicle_label.trim() : null,
      destination: form.destination.trim() || null,
      amount: Number(form.amount),
      notes: form.notes.trim() || null,
    }
    try {
      if (editing) replaceRow(await api.put(`/admin/transactions/${editing.id}`, payload))
      else await api.post('/admin/transactions', payload)
    } catch (saveError) {
      setError(saveError.message)
      setBusy(false)
      return
    }
    setBusy(false)
    setShowForm(false)
    if (!editing) load()
  }

  function openExtend(row) {
    setExtending(row)
    setExtension({ ...emptyExtension(), payment_method: row.payment_method })
    setError('')
  }

  async function saveExtension(event) {
    event.preventDefault()
    setError('')
    if (extension.new_end_date && extension.new_end_date <= extending.end_date) return setError(`The new return date must be after ${extending.end_date}, or leave it empty.`)
    setBusy(true)
    try {
      const updated = await api.post(`/admin/transactions/${extending.id}/extensions`, {
        ...extension, new_end_date: extension.new_end_date || null, amount: Number(extension.amount), notes: extension.notes.trim() || null,
      })
      replaceRow(updated)
      setExtending(null)
    } catch (extendError) {
      setError(extendError.message)
    } finally {
      setBusy(false)
    }
  }

  async function undoExtension(row, latest) {
    if (!window.confirm(`Remove the latest added payment (${peso(latest.amount)}) from ${row.customer_name}'s rental?${latest.new_end_date > latest.previous_end_date ? ` The return date goes back to ${latest.previous_end_date}.` : ''}`)) return
    setError('')
    try {
      const updated = await api.delete(`/admin/transactions/${row.id}/extensions/${latest.id}`)
      replaceRow(updated)
      setExtending(updated)
    } catch (undoError) {
      setError(undoError.message)
    }
  }

  async function removeTransaction(transaction) {
    if (!window.confirm(`Delete the transaction of ${transaction.customer_name} (${peso(transaction.total_paid)} paid in total)? This is recorded in the audit log.`)) return
    try {
      await api.delete(`/admin/transactions/${transaction.id}`)
      setTransactions((rows) => rows.filter((row) => row.id !== transaction.id))
    } catch (deleteError) {
      setLoadError(`Could not delete the transaction: ${deleteError.message}`)
    }
  }

  const visible = transactions.filter((row) => matchesSearch(search, row.customer_name, row.customer_phone, row.vehicle_label, row.destination, row.start_date, PAYMENT_LABELS[row.payment_method]))
  const visibleTotal = visible.reduce((total, row) => total + Number(row.total_paid ?? row.amount ?? 0), 0)
  // Thousands of past records would make the page slow, so rows are shown a page at a time.
  const shownRows = visible.slice(0, shown)

  return (
    <Layout>
      <PageHeader title="Transactions" description="Record rentals so every transaction has a history. Edit a record, or add a payment when the customer pays more (for example, when they keep the car longer)." actions={(
        <button onClick={openForm} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> Record transaction
        </button>
      )} />

      {showForm && (
        <Modal
          title={editing ? 'Edit transaction' : 'Record transaction'}
          description={editing ? 'Fix any detail. Added payments stay as they are.' : 'Enter the rental details and the amount paid.'}
          onClose={closeForm}
        >
        <form onSubmit={saveTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {error && <p role="alert" className="sm:col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <label className="flex flex-col gap-1 text-sm">Customer name<input required maxLength={200} className="px-3 py-2" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Phone (optional)<input maxLength={50} className="px-3 py-2" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Vehicle
            <select required className="px-3 py-2" value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">Choose vehicle</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plate_number}</option>)}
              <option value={OTHER_VEHICLE}>Other (type it)</option>
            </select>
          </label>
          {form.vehicle_id === OTHER_VEHICLE
            ? <label className="flex flex-col gap-1 text-sm">Which vehicle<input required maxLength={200} className="px-3 py-2" placeholder="e.g. Toyota Vios ABC 1234" value={form.vehicle_label} onChange={(e) => setForm({ ...form, vehicle_label: e.target.value })} /></label>
            : <span className="hidden sm:block" />}
          <label className="flex flex-col gap-1 text-sm">Release date<input required type="date" className="px-3 py-2" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Return date<input required type="date" min={form.start_date} className="px-3 py-2" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">Destination
              <select className="px-3 py-2" value={otherDestination ? OTHER_DESTINATION : form.destination} onChange={(e) => {
                const other = e.target.value === OTHER_DESTINATION
                setOtherDestination(other)
                setForm({ ...form, destination: other ? '' : e.target.value })
              }}>
                <option value="">Not specified</option>
                {locations.map((location) => <option key={location.id} value={location.name}>{location.name}</option>)}
                <option value={OTHER_DESTINATION}>Other (type it in)</option>
              </select>
            </label>
            {otherDestination && <input required autoFocus maxLength={200} aria-label="Destination not on the list" className="px-3 py-2" placeholder="Type the destination, e.g. Bukidnon" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />}
          </div>
          <label className="flex flex-col gap-1 text-sm">Service type
            <select className="px-3 py-2" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
              {Object.entries(SERVICE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">{editing?.extensions?.length ? 'First payment (₱)' : 'Amount paid (₱)'}<input required type="number" min="0" step="0.01" className="px-3 py-2" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Payment method
            <select className="px-3 py-2" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">Notes (optional)<textarea maxLength={2000} rows={2} className="px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="modal-actions sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">{busy ? 'Saving…' : editing ? 'Save changes' : 'Save transaction'}</button>
          </div>
        </form>
        </Modal>
      )}

      {extending && (
        <Modal
          title={`Added payment · ${extending.customer_name}`}
          description={`${extending.vehicle_label} · due back ${extending.end_date}. Record the extra amount paid. Set a new return date only if they keep the car longer.`}
          onClose={() => { if (!busy) setExtending(null) }}
          size="max-w-lg"
        >
          <form onSubmit={saveExtension} className="grid grid-cols-2 gap-3">
            {error && <p role="alert" className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            <label className="flex flex-col gap-1 text-sm">New return date (optional)<input type="date" min={dayAfter(extending.end_date)} className="px-3 py-2" value={extension.new_end_date} onChange={(e) => setExtension({ ...extension, new_end_date: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-sm">Amount paid (₱)<input required autoFocus type="number" min="0" step="0.01" className="px-3 py-2" value={extension.amount} onChange={(e) => setExtension({ ...extension, amount: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-sm">Payment method
              <select className="px-3 py-2" value={extension.payment_method} onChange={(e) => setExtension({ ...extension, payment_method: e.target.value })}>
                {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Note (optional)<input maxLength={2000} className="px-3 py-2" placeholder="e.g. 2 more days, or balance" value={extension.notes} onChange={(e) => setExtension({ ...extension, notes: e.target.value })} /></label>

            <div className="col-span-2 rounded-xl p-3 text-sm" style={{ background: 'var(--bg-surface-2)' }}>
              <p className="font-medium mb-1.5">Payment history</p>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>First payment · {extending.start_date} → {extending.extensions?.[0]?.previous_end_date ?? extending.end_date}</span><span>{peso(extending.amount)}</span></div>
              {(extending.extensions || []).map((item, index, list) => (
                <div key={item.id} className="flex justify-between items-center gap-2 mt-1">
                  <span style={{ color: 'var(--text-muted)' }}>Added payment {index + 1} · paid {item.paid_on}{item.new_end_date > item.previous_end_date ? ` · return moved to ${item.new_end_date}` : ''}</span>
                  <span className="flex items-center gap-2">
                    {peso(item.amount)}
                    {index === list.length - 1 && (
                      <button type="button" onClick={() => undoExtension(extending, item)} className="btn-ghost p-1" title="Remove this added payment" aria-label="Remove the latest added payment"><Undo2 size={13} /></button>
                    )}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-semibold mt-2 pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}><span>Paid so far</span><span>{peso(extending.total_paid)}</span></div>
            </div>

            <div className="modal-actions col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setExtending(null)} disabled={busy} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">{busy ? 'Saving…' : 'Save payment'}</button>
            </div>
          </form>
        </Modal>
      )}

      <FilterBar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search customer, vehicle, destination, or payment" />
        <input type="date" aria-label="From date" title="From" className="px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>to</span>
        <input type="date" aria-label="To date" title="To" className="px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        <button onClick={load} className="btn-ghost px-4 py-2 text-sm">Apply dates</button>
      </FilterBar>
      {loadError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{loadError}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-5 font-medium">Customer</th>
              <th className="py-3 px-5 font-medium">Vehicle</th>
              <th className="py-3 px-5 font-medium">Dates</th>
              <th className="py-3 px-5 font-medium">Destination</th>
              <th className="py-3 px-5 font-medium">Payment</th>
              <th className="py-3 px-5 font-medium text-right">Amount</th>
              <th className="py-3 px-5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row) => {
              const extensions = row.extensions || []
              const pastReturn = row.notes?.startsWith('Imported past rental') ? row.notes.match(/returned (.+)$/)?.[1] : null
              return (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-5">{row.customer_name}<p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.customer_phone || 'No phone'}</p></td>
                  <td className="py-3 px-5">{row.vehicle_label}<p className="text-xs" style={{ color: 'var(--text-muted)' }}>{SERVICE_LABELS[row.service_type] || row.service_type}</p></td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    {row.start_date} → {row.end_date}
                    {extensions.length > 0 && extensions[0].previous_end_date !== row.end_date && <p className="text-xs" style={{ color: 'var(--nebula-3)' }}>Return moved · first due {extensions[0].previous_end_date}</p>}
                    {pastReturn && <p className="text-xs" style={{ color: pastReturn.includes('late') ? 'var(--warning)' : 'var(--text-muted)' }}>Returned {pastReturn}</p>}
                  </td>
                  <td className="py-3 px-5">{row.destination || '—'}</td>
                  <td className="py-3 px-5">{PAYMENT_LABELS[row.payment_method] || row.payment_method}</td>
                  <td className="py-3 px-5 text-right">
                    <span className="font-medium">{peso(row.total_paid ?? row.amount)}</span>
                    {extensions.length > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{peso(row.amount)} + {peso(row.total_paid - row.amount)} added</p>}
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openExtend(row)} className="btn-ghost px-2.5 py-1.5 text-xs flex items-center gap-1" title="The customer paid more on this rental"><HandCoins size={13} /> Added payment</button>
                      <button onClick={() => openEdit(row)} className="btn-ghost px-2.5 py-1.5 text-xs flex items-center gap-1"><Pencil size={13} /> Edit</button>
                      <button onClick={() => removeTransaction(row)} className="btn-ghost p-2" aria-label={`Delete transaction of ${row.customer_name}`} title="Delete"><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{transactions.length ? 'No transactions match this search.' : 'No transactions recorded yet.'}</td></tr>
            )}
            {loading && <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border-soft)' }}>
                <td colSpan={5} className="py-3 px-5 font-medium">Total of {visible.length} transaction{visible.length === 1 ? '' : 's'}</td>
                <td className="py-3 px-5 text-right font-semibold">{peso(visibleTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {visible.length > shown && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Showing {shown} of {visible.length}</span>
          <button onClick={() => setShown((count) => count + PAGE_SIZE)} className="btn-ghost px-4 py-2 text-sm">Show {Math.min(PAGE_SIZE, visible.length - shown)} more</button>
          <button onClick={() => setShown(visible.length)} className="btn-ghost px-4 py-2 text-sm">Show all</button>
        </div>
      )}
    </Layout>
  )
}

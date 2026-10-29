import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import SearchBar from '../components/SearchBar'
import { PageHeader, FilterBar } from '../components/PageParts'
import Modal from '../components/Modal'

const EMPTY_VEHICLE = { make: '', model: '', year: '', plate_number: '', description: '', image: null, image_url: '' }

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [rentalBookings, setRentalBookings] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_VEHICLE })
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('availability')

  async function load() {
    try {
      const [fleet, activeBookings] = await Promise.all([
        api.get('/vehicles'),
        api.get('/bookings', { status: 'accepted,ongoing', sort: 'start_asc' }),
      ])
      setError('')
      setVehicles(fleet)
      setRentalBookings(activeBookings)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load fleet rental dates.')
    }
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
  }, [])

  const visibleVehicles = vehicles
    .filter((vehicle) => `${vehicle.make} ${vehicle.model} ${vehicle.plate_number} ${vehicle.status}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'name') return `${first.make} ${first.model}`.localeCompare(`${second.make} ${second.model}`)
      return (first.status === 'available' ? 0 : 1) - (second.status === 'available' ? 0 : 1)
    })

  async function addVehicle(e) {
    e.preventDefault()
    setError('')
    const vehicleData = {
      make: form.make.trim(), model: form.model.trim(), plate_number: form.plate_number.trim(),
      description: form.description.trim(),
      year: form.year ? Number(form.year) : null, // optional
      image_url: form.image_url || null,
    }
    try {
      if (editingVehicle) await api.patch(`/vehicles/${editingVehicle.id}`, vehicleData)
      else await api.post('/vehicles', vehicleData)
    } catch (saveError) {
      setError(saveError.message)
      return
    }
    setForm({ ...EMPTY_VEHICLE })
    setEditingVehicle(null)
    setShowForm(false)
    load()
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/vehicles/${id}`, { status })
    } catch (statusError) {
      setError(statusError.message)
    }
    load()
  }

  async function deleteVehicle(vehicle) {
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model} (${vehicle.plate_number})? This cannot be undone.`)) return
    try {
      await api.delete(`/vehicles/${vehicle.id}`)
    } catch (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

  function closeForm() {
    setShowForm(false)
    setEditingVehicle(null)
    setError('')
  }

  function startEditing(vehicle) {
    setEditingVehicle(vehicle)
    setForm({
      make: vehicle.make, model: vehicle.model, year: vehicle.year ?? '', plate_number: vehicle.plate_number,
      description: vehicle.description || '',
      image: null, image_url: vehicle.image_url || '',
    })
    setError('')
    setShowForm(true)
  }

  return (
    <Layout>
      <PageHeader title="Fleet" description="Manage the vehicles customers can book and their status. Customers see the name, type, photo and details only." actions={(
        <button onClick={() => { setEditingVehicle(null); setForm({ ...EMPTY_VEHICLE }); setShowForm(true); setError('') }} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> Add vehicle
        </button>
      )} />

      {showForm && (
        <Modal
          title={editingVehicle ? `Edit ${editingVehicle.make} ${editingVehicle.model}` : 'Add vehicle'}
          description={editingVehicle ? editingVehicle.plate_number : 'Add a car to the fleet. Customers see it once it is Available.'}
          onClose={closeForm}
          size="max-w-3xl"
        >
        <form onSubmit={addVehicle} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {error && <p className="sm:col-span-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <label className="flex flex-col gap-1 text-sm">Brand<input required placeholder="Vios" className="px-3 py-2" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Model (optional)<input placeholder="e.g. G 1.5" className="px-3 py-2" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Year (optional)<input type="number" min="1900" max="2100" placeholder="2024" className="px-3 py-2" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Plate number<input required placeholder="CDO-1005" className="px-3 py-2" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-3">Details customers see<textarea rows={3} maxLength={4000} placeholder="Describe comfort, luggage space, features, and important vehicle notes." className="px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Vehicle photo<input type="file" accept="image/*" className="px-3 py-2" onChange={async (e) => {
            const image = e.target.files?.[0]
            if (!image) return
            try {
              const body = new FormData()
              body.append('file', image)
              const { image_url } = await api.upload('/vehicles/images', body)
              setForm({ ...form, image, image_url })
            } catch (uploadError) {
              setError(`Image upload failed: ${uploadError.message}`)
            }
          }} /><span className="text-xs" style={{ color: 'var(--text-faint)' }}>{form.image_url ? 'Photo ready to save.' : 'Optional. Any photo type (JPG, PNG, HEIC from iPhone, WEBP…).'}</span></label>
          <div className="modal-actions sm:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button type="submit" className="btn-primary px-5 py-2 text-sm">{editingVehicle ? 'Update vehicle' : 'Save vehicle'}</button>
          </div>
        </form>
        </Modal>
      )}

      {error && !showForm && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}

      <FilterBar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search make, model, plate, or status" />
        <select aria-label="Sort vehicles" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="px-3 py-2 text-sm">
          <option value="availability">Available first</option>
          <option value="name">Name: A to Z</option>
        </select>
      </FilterBar>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-4 font-medium">Vehicle</th>
              <th className="py-3 px-4 font-medium">Plate</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Rental period</th>
              <th className="py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleVehicles.map((vehicle) => (
              <tr key={vehicle.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {vehicle.image_url && <img src={vehicle.image_url} alt="" className="w-14 h-10 rounded object-cover" />}
                    <div><p className="font-medium">{vehicle.make} {vehicle.model}</p>{vehicle.year && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{vehicle.year}</p>}{vehicle.description && <p className="mt-1 max-w-56 whitespace-normal text-xs" style={{ color: 'var(--text-muted)' }}>{vehicle.description}</p>}</div>
                  </div>
                </td>
                <td className="py-3 px-4">{vehicle.plate_number}</td>
                <td className="py-3 px-4">
                  <select value={vehicle.status} onChange={(event) => updateStatus(vehicle.id, event.target.value)} className="px-2 py-1.5 text-xs">
                    <option value="available">Available</option>
                    <option value="rented">Rented</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="cleaning">Cleaning / inspection</option>
                  </select>
                </td>
                <td className="py-3 px-4 align-top">
                  {rentalBookings.filter((booking) => booking.vehicle_id === vehicle.id).length > 0 ? (
                    <div className="grid gap-2">
                      {rentalBookings.filter((booking) => booking.vehicle_id === vehicle.id).map((booking) => (
                        <div key={booking.id} className="whitespace-nowrap">
                          <p className="text-xs font-medium">{booking.status === 'ongoing' ? 'Rented now' : 'Upcoming'}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{booking.start_date} → {booking.end_date}</p>
                          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{booking.profiles?.full_name || 'Customer'}</p>
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No rental scheduled</span>}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditing(vehicle)} className="btn-ghost px-3 py-1.5 text-xs">Edit</button>
                    <button onClick={() => deleteVehicle(vehicle)} aria-label={`Delete ${vehicle.make} ${vehicle.model}`} className="btn-ghost p-2" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleVehicles.length === 0 && <tr><td colSpan={5} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No vehicles match this search.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import Modal from './Modal'

const SERVICE_LABELS = { self_drive: 'Self-drive', with_driver: 'With driver', pickup_dropoff: 'Pickup / drop-off' }
const CUSTOM_DESTINATION = '__custom__'
const CUSTOMER_FIELDS = ['full_name', 'phone', 'age', 'address', 'id_type', 'id_number', 'second_id_type', 'second_id_number']

// The admin corrects a booking and the customer's details, e.g. when the customer changes plans or brings
// a different ID at the office. Only fields that changed are sent; both changes are kept in the audit log.
export default function EditBookingModal({ booking, onClose, onSaved }) {
  const customer = booking.profiles || {}
  const [vehicles, setVehicles] = useState([])
  const [destinations, setDestinations] = useState([])
  const [form, setForm] = useState({
    vehicle_id: booking.vehicle_id,
    start_date: booking.start_date, pickup_time: booking.pickup_time?.slice(0, 5) || '',
    end_date: booking.end_date, return_time: booking.return_time?.slice(0, 5) || '',
    service_type: booking.service_type || 'self_drive', pickup_location: booking.pickup_location || '',
    destination_to: booking.destination_to || '', notes: booking.notes || '',
  })
  const [customDestination, setCustomDestination] = useState(false)
  const [person, setPerson] = useState(Object.fromEntries(CUSTOMER_FIELDS.map((key) => [key, customer[key] ?? ''])))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/vehicles').then(setVehicles).catch((failure) => setError(`Could not load the vehicles: ${failure.message}`))
    api.get('/admin/locations').then((rows) => {
      setDestinations(rows.map((row) => row.name))
      setCustomDestination(Boolean(booking.destination_to) && !rows.some((row) => row.name === booking.destination_to))
    }).catch((failure) => console.error('Unable to load destinations:', failure.message))
  }, [booking.destination_to])

  const carOut = booking.status === 'ongoing'

  async function save(event) {
    event.preventDefault()
    setError('')
    if (form.end_date < form.start_date) return setError('The end date must be on or after the start date.')
    const bookingChanges = {}
    const original = {
      vehicle_id: booking.vehicle_id, start_date: booking.start_date, pickup_time: booking.pickup_time?.slice(0, 5) || '',
      end_date: booking.end_date, return_time: booking.return_time?.slice(0, 5) || '', service_type: booking.service_type || 'self_drive',
      pickup_location: booking.pickup_location || '', destination_to: booking.destination_to || '', notes: booking.notes || '',
    }
    Object.entries(form).forEach(([key, value]) => {
      if (String(value) !== String(original[key])) bookingChanges[key] = value === '' ? null : value
    })
    const customerChanges = {}
    CUSTOMER_FIELDS.forEach((key) => {
      const before = customer[key] ?? ''
      if (String(person[key]).trim() !== String(before)) customerChanges[key] = key === 'age' ? (person.age ? Number(person.age) : null) : person[key]
    })
    if (!Object.keys(bookingChanges).length && !Object.keys(customerChanges).length) return onClose()

    setBusy(true)
    try {
      if (Object.keys(customerChanges).length) await api.patch(`/admin/customers/${customer.id}`, customerChanges)
      if (Object.keys(bookingChanges).length) await api.patch(`/bookings/${booking.id}`, bookingChanges)
      onSaved()
    } catch (saveError) {
      setError(saveError.message)
      setBusy(false)
    }
  }

  const field = (label, key, props = {}) => (
    <label className="flex flex-col gap-1 text-sm">{label}
      <input className="px-3 py-2" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </label>
  )
  const personField = (label, key, props = {}) => (
    <label className="flex flex-col gap-1 text-sm">{label}
      <input className="px-3 py-2" value={person[key]} onChange={(e) => setPerson({ ...person, [key]: e.target.value })} {...props} />
    </label>
  )

  return (
    <Modal title={`Edit booking · ${customer.full_name || 'Customer'}`} description="Change what the customer asked for at the office. The customer is notified, and every change is kept in the audit log." onClose={() => { if (!busy) onClose() }} size="max-w-3xl">
      <form onSubmit={save} className="grid gap-5">
        {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Booking</legend>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">Vehicle
            <select className="px-3 py-2" value={form.vehicle_id} disabled={carOut} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              {!vehicles.some((vehicle) => vehicle.id === form.vehicle_id) && <option value={form.vehicle_id}>{booking.vehicles?.make} {booking.vehicles?.model} · {booking.vehicles?.plate_number}</option>}
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plate_number}{vehicle.status !== 'available' ? ` (${vehicle.status})` : ''}</option>)}
            </select>
            {carOut && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>The car is already out, so the vehicle can't be changed.</span>}
          </label>
          {field('Start date', 'start_date', { type: 'date', required: true })}
          {field('Pickup time', 'pickup_time', { type: 'time' })}
          {field('End date', 'end_date', { type: 'date', required: true, min: form.start_date })}
          {field('Return time', 'return_time', { type: 'time' })}
          <label className="flex flex-col gap-1 text-sm">Service type
            <select className="px-3 py-2" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
              {Object.entries(SERVICE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">Destination
              <select className="px-3 py-2" value={customDestination ? CUSTOM_DESTINATION : form.destination_to} onChange={(e) => {
                const custom = e.target.value === CUSTOM_DESTINATION
                setCustomDestination(custom)
                setForm({ ...form, destination_to: custom ? '' : e.target.value })
              }}>
                <option value="">Not specified</option>
                {destinations.map((name) => <option key={name} value={name}>{name}</option>)}
                <option value={CUSTOM_DESTINATION}>Custom destination</option>
              </select>
            </label>
            {customDestination && <input required maxLength={200} aria-label="Custom destination" className="px-3 py-2" placeholder="Type the destination" value={form.destination_to} onChange={(e) => setForm({ ...form, destination_to: e.target.value })} />}
          </div>
          {form.service_type === 'pickup_dropoff' && <div className="sm:col-span-2">{field('Pickup / drop-off location', 'pickup_location', { required: true, maxLength: 500 })}</div>}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">Notes<textarea rows={2} maxLength={2000} className="px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <legend className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Customer details &amp; IDs</legend>
          {personField('Full name', 'full_name', { required: true, maxLength: 200 })}
          {personField('Phone', 'phone', { maxLength: 50 })}
          {personField('Age', 'age', { type: 'number', min: 1, max: 120 })}
          {personField('Home address', 'address', { maxLength: 500 })}
          {personField('Primary ID type', 'id_type', { maxLength: 100, placeholder: "e.g. Driver's License" })}
          {personField('Primary ID number', 'id_number', { maxLength: 100 })}
          {personField('Second ID type', 'second_id_type', { maxLength: 100 })}
          {personField('Second ID number', 'second_id_number', { maxLength: 100 })}
          <p className="text-xs sm:col-span-2" style={{ color: 'var(--text-faint)' }}>ID photos are changed by the customer in their account, or reviewed on the Customers page.</p>
        </fieldset>

        <div className="modal-actions flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

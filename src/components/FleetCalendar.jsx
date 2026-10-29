import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Modal from './Modal'

// Month calendar of the fleet; each day's border is filled with its colour:
//   one car:      green = free, orange = a pending request, red = rented, grey = under maintenance
//   all vehicles: red = every car is taken, orange = a pending request to review, green = cars are free
// Click a day to see which cars are rented, pending or free. Live: reloads whenever bookings change.
const COLORS = {
  available: { border: 'rgb(34,197,94)', fill: 'rgba(34,197,94,0.12)' },
  pending: { border: 'rgb(249,115,22)', fill: 'rgba(249,115,22,0.16)' },
  rented: { border: 'rgb(239,68,68)', fill: 'rgba(239,68,68,0.18)' },
  maintenance: { border: 'rgb(148,163,184)', fill: 'rgba(148,163,184,0.12)' },
}
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SERVICES = { self_drive: 'Self-drive', with_driver: 'With driver', pickup_dropoff: 'Pickup / drop-off' }
const STATUS = { pending: 'Pending request', accepted: 'Accepted (not released yet)', ongoing: 'Ongoing (car is out)', completed: 'Completed', recorded: 'Walk-in rental (Transactions)' }
const time = (t) => (t ? new Date(`2000-01-01T${t}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '')
const longDate = (d) => new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

function Row({ label, children }) {
  if (children == null || children === '' || children === false) return null
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm" style={{ borderTop: '1px solid var(--border-soft)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

// Details of one car on the chosen day: the rental (customer, schedule, service, staff) and the car itself.
function CarDetails({ detail, entries, onClose }) {
  const navigate = useNavigate()
  const { vehicle, entry, kind } = detail
  const color = COLORS[kind]
  const others = entries
    .filter((e) => e.vehicle_id === vehicle.id && e !== entry)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  return (
    <Modal
      title={`${vehicle.name} · ${vehicle.plate_number}`}
      description={entry ? STATUS[entry.status] : kind === 'maintenance' ? 'Under maintenance on this day' : 'Available on this day'}
      onClose={onClose}
      size="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <span className="self-start rounded-full px-3 py-1 text-xs font-semibold" style={{ border: `2px solid ${color.border}`, background: color.fill }}>
          {kind === 'rented' ? 'Rented' : kind === 'pending' ? 'Pending request' : kind === 'maintenance' ? 'Maintenance' : 'Available'}
        </span>

        {entry && (
          <section>
            <h3 className="text-sm font-semibold mb-1">Rental</h3>
            <Row label="Customer">{entry.customer}</Row>
            <Row label="Phone">{entry.phone && <a href={`tel:${entry.phone}`} className="inline-flex items-center gap-1" style={{ color: 'var(--nebula-3)' }}><Phone size={13} />{entry.phone}</a>}</Row>
            <Row label="Email">{entry.email}</Row>
            <Row label="ID verification">{entry.verification}</Row>
            <Row label="Release">{`${longDate(entry.start_date)} ${time(entry.pickup_time)}`.trim()}</Row>
            <Row label="Return">{`${longDate(entry.end_date)} ${time(entry.return_time)}`.trim()}</Row>
            <Row label="Returned">{entry.actual_return_date && `${longDate(entry.actual_return_date)}${entry.late_return ? ' · late' : ''}`}</Row>
            <Row label="Service">{SERVICES[entry.service_type] ?? entry.service_type}</Row>
            <Row label="Pickup location">{entry.pickup_location}</Row>
            <Row label="Destination">{entry.destination}</Row>
            <Row label="Assigned staff">{entry.booking_id ? entry.staff ?? 'Not assigned yet' : null}</Row>
            <Row label="Amount">{entry.amount != null && `₱${Number(entry.amount).toLocaleString()} · ${entry.payment_method}`}</Row>
            <Row label="Requested">{entry.requested_at && new Date(entry.requested_at).toLocaleString()}</Row>
            <Row label="Notes">{entry.notes}</Row>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold mb-1">Vehicle</h3>
          {vehicle.image_url && <img src={vehicle.image_url} alt={vehicle.name} className="mb-2 h-36 w-full rounded-xl object-cover" />}
          <Row label="Plate">{vehicle.plate_number}</Row>
          <Row label="Year">{vehicle.year}</Row>
          <Row label="Type">{vehicle.category}</Row>
          <Row label="Fleet status">{vehicle.status}</Row>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-1">Other bookings of this car this month</h3>
          {others.length ? (
            <ul className="flex flex-col gap-1">
              {others.map((e) => (
                <li key={`${e.booking_id ?? e.transaction_id}`} className="rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--bg-surface-2)', borderLeft: `3px solid ${COLORS[e.kind].border}` }}>
                  <span className="font-medium">{e.customer}</span> · {e.start_date} → {e.end_date} · {STATUS[e.status]}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None.</p>}
        </section>

        <div className="modal-actions flex justify-end gap-2">
          {entry && (
            <button onClick={() => navigate(entry.booking_id ? '/bookings' : '/transactions')} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm">
              <ExternalLink size={14} /> Open in {entry.booking_id ? 'Bookings' : 'Transactions'}
            </button>
          )}
          <button onClick={onClose} className="btn-primary px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    </Modal>
  )
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function FleetCalendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [vehicleId, setVehicleId] = useState('all')
  const [selectedDay, setSelectedDay] = useState(() => iso(new Date()))
  const [data, setData] = useState({ vehicles: [], entries: [] })
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null) // { vehicle, entry, kind } of the clicked card

  const days = Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))
  const start = iso(days[0])
  const end = iso(days[days.length - 1])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await api.get('/admin/calendar', { start, end })
        if (active) { setData(result); setError('') }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load the calendar.')
      }
    }
    load()
    const unsubscribe = subscribe('bookings', load)
    return () => { active = false; unsubscribe() }
  }, [start, end])

  const today = iso(new Date())

  // One car on one day: a rental beats a pending request.
  function carDay(vehicle, key) {
    const here = data.entries.filter((e) => e.vehicle_id === vehicle.id && e.start_date <= key && e.end_date >= key)
    const rented = here.find((e) => e.kind === 'rented')
    if (rented) return { kind: 'rented', entry: rented }
    const pending = here.find((e) => e.kind === 'pending')
    if (pending) return { kind: 'pending', entry: pending }
    return { kind: vehicle.status === 'maintenance' ? 'maintenance' : 'available' }
  }

  function dayInfo(key) {
    const cars = data.vehicles.map((vehicle) => ({ vehicle, ...carDay(vehicle, key) }))
    const count = (kind) => cars.filter((c) => c.kind === kind).length
    const free = count('available') + count('pending') // a pending request does not hold the car yet
    if (vehicleId !== 'all') {
      const car = cars.find((c) => c.vehicle.id === vehicleId)
      const kind = car?.kind ?? 'available'
      return { kind, cars, free, rented: count('rented'), pending: count('pending'), dots: [kind] }
    }
    const kind = data.vehicles.length && free === 0 ? 'rented' : count('pending') ? 'pending' : 'available'
    // One dot per kind of car that day, in this order: red rented, orange pending, green available, grey maintenance.
    // Maintenance is the car's status now, so its dot only shows from today on.
    const dots = ['rented', 'pending', 'available', 'maintenance'].filter((k) => count(k) > 0 && (k !== 'maintenance' || key >= today))
    return { kind, cars, free, rented: count('rented'), pending: count('pending'), dots }
  }

  const selected = dayInfo(selectedDay)
  const selectedCars = vehicleId === 'all' ? selected.cars : selected.cars.filter((c) => c.vehicle.id === vehicleId)
  const groups = [
    ['rented', 'Rented'], ['pending', 'Pending request'], ['available', 'Available'], ['maintenance', 'Under maintenance'],
  ].map(([kind, title]) => ({ kind, title, cars: selectedCars.filter((c) => c.kind === kind) })).filter((g) => g.cars.length)

  const legend = vehicleId === 'all'
    ? [['rented', 'Rented'], ['pending', 'Pending request'], ['available', 'Available'], ['maintenance', 'Maintenance']]
    : [['available', 'Available'], ['pending', 'Pending request'], ['rented', 'Rented / occupied'], ['maintenance', 'Maintenance']]

  return (
    <div className="card p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><CalendarDays size={18} /> Fleet calendar</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Updates live when bookings change. Click a day to see the cars, then a car for its details.</p>
        </div>
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="px-3 py-2 text-sm" aria-label="Vehicle">
          <option value="all">All vehicles ({data.vehicles.length})</option>
          {data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.plate_number}</option>)}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" className="btn-ghost p-2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <button type="button" className="text-base font-semibold" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDay(iso(d)) }} title="Back to today">
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </button>
            <button type="button" className="btn-ghost p-2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            {DAY_NAMES.map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: days[0].getDay() }, (_, i) => <span key={`blank-${i}`} />)}
            {days.map((day) => {
              const key = iso(day)
              const info = dayInfo(key)
              const isSelected = key === selectedDay
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  title={vehicleId === 'all' ? `${info.free} free · ${info.rented} rented · ${info.pending} pending` : info.kind}
                  className="relative flex flex-col items-center justify-center rounded-xl py-1.5 text-sm transition-transform hover:scale-105"
                  style={{
                    // Today and upcoming days stand out; past days stay plain and dim.
                    border: `1px solid ${isSelected ? 'var(--nebula-3)' : key >= today ? 'rgba(96,165,250,0.45)' : 'var(--border-soft)'}`,
                    background: isSelected ? 'rgba(96,165,250,0.22)' : key >= today ? 'var(--bg-surface-2)' : 'transparent',
                    color: 'var(--text-primary)',
                    opacity: key < today && !isSelected ? 0.4 : 1,
                    fontWeight: key === today ? 700 : 500,
                    boxShadow: key === today ? '0 0 0 2px var(--bg-surface), 0 0 0 4px var(--nebula-3)' : undefined,
                  }}
                >
                  {/* Status dots: red rented, orange pending, green available, grey under maintenance */}
                  <span className="absolute left-1.5 top-1.5 flex gap-0.5" aria-hidden="true">
                    {info.dots.map((k) => <span key={k} className="h-2 w-2 rounded-full" style={{ background: COLORS[k].border }} />)}
                  </span>
                  {day.getDate()}
                  {vehicleId === 'all' && data.vehicles.length > 0 && <span className="text-[10px] leading-3 font-normal opacity-80">{info.free} free</span>}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {legend.map(([kind, label]) => (
              <span key={kind} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[kind].border }} />{label}
              </span>
            ))}
          </div>
          {error && <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">
            {new Date(`${selectedDay}T00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {vehicleId === 'all' && <span className="font-normal" style={{ color: 'var(--text-muted)' }}> · {selected.free} of {data.vehicles.length} cars free</span>}
          </p>
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.kind}>
                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: COLORS[group.kind].border }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[group.kind].border }} />{group.title} ({group.cars.length})
                </p>
                <ul className="flex flex-col gap-1">
                  {group.cars.map(({ vehicle, entry, kind }) => (
                    <li key={vehicle.id}>
                      <button
                        type="button"
                        onClick={() => setDetail({ vehicle, entry, kind })}
                        className="w-full rounded-lg px-3 py-1.5 text-left text-xs transition hover:brightness-125"
                        style={{ background: 'var(--bg-surface-2)', borderLeft: `3px solid ${COLORS[kind].border}` }}
                        title="See details"
                      >
                        <span className="font-medium">{vehicle.name}</span> <span style={{ color: 'var(--text-muted)' }}>{vehicle.plate_number}</span>
                        {entry && (
                          <span className="block" style={{ color: 'var(--text-muted)' }}>
                            {entry.customer} · {entry.start_date} → {entry.end_date}{entry.status === 'recorded' ? ' · walk-in' : ''}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!groups.length && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No vehicles yet.</p>}
          </div>
        </div>
      </div>
      {detail && <CarDetails detail={detail} entries={data.entries} onClose={() => setDetail(null)} />}
    </div>
  )
}

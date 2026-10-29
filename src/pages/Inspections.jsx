import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Car, Check, ChevronLeft, ChevronRight, ClipboardCheck, Eye, Printer, ShieldCheck, Sparkles, UserRoundCog, X } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import { PageHeader, FilterBar, Tabs } from '../components/PageParts'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'
import { printRentalPack } from '../lib/print'

const VIEWS = [['open', 'Needs attention'], ['done', 'Back on fleet']]
const INSPECTIONS = [['pre_rental', 'Pre-rental inspection'], ['post_rental', 'Post-rental inspection']]
const TONES = {
  success: { color: 'var(--success)', background: 'rgba(74,222,128,0.14)' },
  info: { color: 'var(--nebula-3)', background: 'rgba(56,189,248,0.16)' },
  warning: { color: 'var(--warning)', background: 'rgba(251,191,36,0.15)' },
  muted: { color: 'var(--text-faint)', background: 'var(--bg-surface-2)' },
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function Pill({ tone = 'muted', children }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={TONES[tone]}>{children}</span>
}

function progressOf(booking) {
  const pre = booking.inspections.find((item) => item.type === 'pre_rental')
  const post = booking.inspections.find((item) => item.type === 'post_rental')
  const returned = booking.status === 'completed'
  const verified = booking.inspections.length > 0 && booking.inspections.every((item) => item.verified_at)
  const steps = [
    { label: 'Pre-rental check', done: Boolean(pre) },
    { label: 'Rented out', done: booking.status === 'ongoing' || returned },
    { label: 'Post-rental check', done: Boolean(post) },
    { label: 'Cleaning', done: Boolean(booking.cleaning_done_at) },
    { label: 'Back on fleet', done: returned && verified && Boolean(booking.cleaning_done_at) },
  ]
  let summary
  if (booking.status === 'accepted') summary = pre ? { tone: 'info', text: 'Ready for release' } : { tone: 'warning', text: 'Waiting for pre-rental inspection' }
  else if (booking.status === 'ongoing') summary = { tone: 'info', text: post ? 'Post-rental done, waiting for return' : 'Rented out' }
  else if (!booking.cleaning_done_at && !verified) summary = { tone: 'warning', text: 'Returned: verify inspection and check cleaning' }
  else if (!booking.cleaning_done_at) summary = { tone: 'warning', text: 'Returned: waiting for cleaning' }
  else if (!verified) summary = { tone: 'warning', text: 'Cleaned: verify the inspection to release' }
  else summary = { tone: 'success', text: 'Available for booking again' }
  return { steps, summary }
}

function Stepper({ steps }) {
  const current = steps.findIndex((step) => !step.done)
  return (
    <ol className="flex items-start">
      {steps.map((step, index) => {
        const state = step.done ? 'done' : index === current ? 'current' : 'todo'
        return (
          <li key={step.label} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className="h-0.5 flex-1" style={{ background: index === 0 ? 'transparent' : steps[index - 1].done ? 'var(--success)' : 'var(--border-soft)' }} />
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: state === 'done' ? 'var(--success)' : state === 'current' ? 'rgba(251,191,36,0.18)' : 'var(--bg-surface-2)',
                  color: state === 'done' ? '#06281a' : state === 'current' ? 'var(--warning)' : 'var(--text-faint)',
                  border: state === 'current' ? '1.5px solid var(--warning)' : 'none',
                }}
              >
                {state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="h-0.5 flex-1" style={{ background: index === steps.length - 1 ? 'transparent' : step.done ? 'var(--success)' : 'var(--border-soft)' }} />
            </div>
            <span className="mt-1.5 px-1 text-[11px] leading-tight" style={{ color: state === 'todo' ? 'var(--text-faint)' : 'var(--text-muted)' }}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

// Swaps between a button and an inline select + save.
function StaffPicker({ currentId, staff, busy, onSave }) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')
  const options = staff.filter((member) => member.id !== currentId)

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setChoice('') }}
        disabled={options.length === 0}
        title={options.length === 0 ? 'Add another staff member first' : undefined}
        className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
      >
        <UserRoundCog size={13} /> Change
      </button>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select aria-label="New staff in charge" value={choice} onChange={(event) => setChoice(event.target.value)} className="px-2 py-1 text-xs">
        <option value="">Choose staff…</option>
        {options.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
      </select>
      <button onClick={async () => { if (await onSave(choice)) setOpen(false) }} disabled={!choice || busy} className="btn-primary px-2.5 py-1 text-xs">{busy ? 'Saving…' : 'Save'}</button>
      <button onClick={() => setOpen(false)} className="btn-ghost px-2.5 py-1 text-xs">Cancel</button>
    </span>
  )
}

function Detail({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-xs">
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function Panel({ icon: Icon, title, status, children, action }) {
  return (
    <section className="flex flex-col rounded-xl p-4" style={{ background: 'var(--bg-surface-2)' }}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} style={{ color: 'var(--nebula-3)' }} /> {title}</h3>
        {status}
      </header>
      <div className="flex-1">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </section>
  )
}

function PhotoViewer({ photos, index, onClose, onMove }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onMove(1)
      if (event.key === 'ArrowLeft') onMove(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onMove])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Damage photo">
      <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><X size={20} /></button>
      {photos.length > 1 && <button onClick={(event) => { event.stopPropagation(); onMove(-1) }} className="absolute left-4 rounded-full bg-white/10 p-2 text-white" aria-label="Previous photo"><ChevronLeft size={24} /></button>}
      <figure className="flex max-h-full flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <img src={photos[index]} alt={`Damage photo ${index + 1}`} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
        <figcaption className="mt-3 text-sm text-white/80">Photo {index + 1} of {photos.length}</figcaption>
      </figure>
      {photos.length > 1 && <button onClick={(event) => { event.stopPropagation(); onMove(1) }} className="absolute right-4 rounded-full bg-white/10 p-2 text-white" aria-label="Next photo"><ChevronRight size={24} /></button>}
    </div>
  )
}

export default function Inspections() {
  const [view, setView] = useState('open')
  const [bookings, setBookings] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [viewer, setViewer] = useState(null) // { photos, index }
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const [queue, staffList] = await Promise.all([
        api.get('/bookings/inspection-queue', { view }),
        api.get('/admin/staff'),
      ])
      setBookings(queue)
      setStaff(staffList)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load inspections.')
    }
    setLoading(false)
  }, [view])

  useEffect(() => {
    setLoading(true)
    load()
    return subscribe('bookings', load)
  }, [load])

  const closeViewer = useCallback(() => setViewer(null), [])
  const moveViewer = useCallback((step) => setViewer((current) => current && {
    ...current, index: (current.index + step + current.photos.length) % current.photos.length,
  }), [])

  const staffName = (id) => staff.find((member) => member.id === id)?.full_name ?? 'Staff member'

  async function run(key, request, success) {
    setBusy(key)
    setError('')
    setMessage('')
    let ok = true
    try {
      await request()
      setMessage(success)
    } catch (actionError) {
      setError(actionError.message)
      ok = false
    }
    await load()
    setBusy('')
    return ok
  }

  // mode: 'view' opens the rental pack, 'print' opens it with the print dialog.
  async function printPack(booking, mode = 'print') {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return setError('Allow pop-ups for this admin site to print documents.')
    try {
      printRentalPack(await api.get(`/bookings/${booking.id}/print-pack`), printWindow, mode)
    } catch (printError) {
      printWindow.close()
      setError(`Could not prepare the print pack: ${printError.message}`)
    }
  }

  function inspectionPanel(booking, type, title) {
    const inspection = booking.inspections.find((item) => item.type === type)
    if (!inspection) {
      return (
        <Panel key={type} icon={ClipboardCheck} title={title} status={<Pill>Not done</Pill>}>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {type === 'pre_rental' ? 'The staff in charge does this before releasing the vehicle.' : 'The staff in charge does this when the vehicle comes back.'}
          </p>
        </Panel>
      )
    }
    const account = staffName(inspection.staff_id)
    const toolIssues = Object.values(inspection.tools || {}).filter((value) => value && value !== 'present').length
    const photos = inspection.photo_urls || []
    const verifyKey = `verify-${inspection.id}`
    return (
      <Panel
        key={type}
        icon={ClipboardCheck}
        title={title}
        status={inspection.verified_at ? <Pill tone="success"><BadgeCheck size={12} /> Verified</Pill> : <Pill tone="warning">To verify</Pill>}
        action={inspection.verified_at ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Verified {formatDateTime(inspection.verified_at)}</p>
        ) : (
          <button onClick={() => run(verifyKey, () => api.post(`/bookings/${booking.id}/inspections/${inspection.id}/verify`), `${title} verified.`)} disabled={busy === verifyKey} className="btn-primary flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs">
            <ShieldCheck size={14} /> {busy === verifyKey ? 'Verifying…' : 'Verify inspection'}
          </button>
        )}
      >
        <dl>
          <Detail label="Done by">{account}{inspection.staff_name && inspection.staff_name !== account ? <span className="block font-normal" style={{ color: 'var(--text-faint)' }}>signed as {inspection.staff_name}</span> : null}</Detail>
          <Detail label="Date">{formatDateTime(inspection.created_at)}</Detail>
          <Detail label="Fuel">{inspection.fuel_level || '—'}</Detail>
          <Detail label="Odometer">{inspection.odometer_reading != null ? `${Number(inspection.odometer_reading).toLocaleString()} km` : '—'}</Detail>
          <Detail label="Damage marks">{inspection.damage_marks?.length || 0}</Detail>
          <Detail label="Tools missing / damaged"><span style={{ color: toolIssues ? 'var(--warning)' : undefined }}>{toolIssues}</span></Detail>
          {Number(inspection.damage_fee) > 0 && <Detail label="Damage fee"><span style={{ color: 'var(--warning)' }}>₱{Number(inspection.damage_fee).toLocaleString()}</span></Detail>}
        </dl>
        {inspection.damage_notes && <p className="mt-2 rounded-lg px-3 py-2 text-xs italic" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>&quot;{inspection.damage_notes}&quot;</p>}
        {photos.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Damage photos ({photos.length})</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, index) => (
                <button key={url} onClick={() => setViewer({ photos, index })} className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-soft)' }} aria-label={`Open damage photo ${index + 1}`}>
                  <img src={url} alt="" loading="lazy" className="h-14 w-14 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>
    )
  }

  function cleaningPanel(booking) {
    const returned = booking.status === 'completed'
    const cleanKey = `clean-${booking.id}`
    const status = !returned ? <Pill>After return</Pill> : booking.cleaning_done_at ? <Pill tone="success">Clean</Pill> : <Pill tone="warning">Waiting</Pill>
    return (
      <Panel
        icon={Sparkles}
        title="Cleaning"
        status={status}
        action={returned && !booking.cleaning_done_at ? (
          <button onClick={() => run(cleanKey, () => api.post(`/bookings/${booking.id}/cleaning-done`), 'Cleaning marked as done.')} disabled={busy === cleanKey} className="btn-ghost flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs">
            <Sparkles size={14} /> {busy === cleanKey ? 'Saving…' : 'Mark cleaning done'}
          </button>
        ) : null}
      >
        {!returned ? (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Starts once the vehicle is returned. The staff in charge checks that it is cleaned.</p>
        ) : (
          <dl>
            <Detail label="Staff in charge">
              {booking.cleaning_staff_id ? staffName(booking.cleaning_staff_id) : 'Not assigned'}
              {!booking.cleaning_done_at && (
                <span className="mt-1 block">
                  <StaffPicker
                    currentId={booking.cleaning_staff_id} staff={staff} busy={busy === `cleaner-${booking.id}`}
                    onSave={(staffId) => run(`cleaner-${booking.id}`, () => api.post(`/bookings/${booking.id}/cleaner`, { staff_id: staffId }), `${staffName(staffId)} is now in charge of the cleaning check.`)}
                  />
                </span>
              )}
            </Detail>
            <Detail label="Returned">{booking.actual_return_date || '—'}</Detail>
            {booking.cleaning_done_at && <Detail label="Confirmed clean">{formatDateTime(booking.cleaning_done_at)}</Detail>}
          </dl>
        )}
      </Panel>
    )
  }

  const visibleBookings = bookings.filter((booking) => matchesSearch(search, booking.vehicles?.make, booking.vehicles?.model, booking.vehicles?.plate_number, booking.profiles?.full_name, booking.start_date, booking.end_date))

  return (
    <Layout>
      <PageHeader
        title="Inspections"
        description="Verify the staff's inspections and follow each returned vehicle until it is back on the fleet: post-rental inspection verified and cleaning confirmed."
      />

      {error && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
      {message && <p role="status" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{message}</p>}

      <FilterBar tabs={<Tabs label="Inspection view" value={view} onChange={setView} options={VIEWS.map(([key, label]) => ({ key, label }))} />}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search vehicle, plate, or customer" />
      </FilterBar>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : visibleBookings.length === 0 && bookings.length > 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>No inspections match this search.</div>
      ) : bookings.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
          {view === 'open' ? 'Nothing to inspect, verify or clean right now.' : 'No returned vehicles have been released yet.'}
        </div>
      ) : (
        <div className="grid gap-5">
          {visibleBookings.map((booking) => {
            const { steps, summary } = progressOf(booking)
            const returned = booking.status === 'completed'
            return (
              <article key={booking.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="pardz-logo flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"><Car size={20} /></div>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold leading-tight">
                        {booking.vehicles?.make} {booking.vehicles?.model}
                        <span className="ml-2 rounded-md px-2 py-0.5 align-middle text-xs font-medium" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>{booking.vehicles?.plate_number}</span>
                      </h2>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{booking.profiles?.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{booking.start_date} → {booking.end_date}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Pill tone={summary.tone}>{summary.text}</Pill>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Staff in charge:</span>
                      <span className="font-semibold">{booking.assigned_staff_id ? staffName(booking.assigned_staff_id) : 'Not assigned'}</span>
                      {!returned && (
                        <StaffPicker
                          currentId={booking.assigned_staff_id} staff={staff} busy={busy === `assign-${booking.id}`}
                          onSave={(staffId) => run(`assign-${booking.id}`, () => api.post(`/bookings/${booking.id}/assign`, { staff_id: staffId }), `${staffName(staffId)} is now in charge of this booking. Both staff members were notified.`)}
                        />
                      )}
                      <button onClick={() => printPack(booking, 'view')} title="Open the rental pack" className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"><Eye size={13} /> View</button>
                      <button onClick={() => printPack(booking, 'print')} title="Print the rental pack" className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"><Printer size={13} /> Print</button>
                    </div>
                  </div>
                </div>

                <div className="px-5 pt-5"><Stepper steps={steps} /></div>

                <div className="grid gap-4 p-5 lg:grid-cols-3">
                  {INSPECTIONS.map(([type, title]) => inspectionPanel(booking, type, title))}
                  {cleaningPanel(booking)}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {viewer && <PhotoViewer photos={viewer.photos} index={viewer.index} onClose={closeViewer} onMove={moveViewer} />}
    </Layout>
  )
}

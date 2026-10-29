import { useEffect, useState } from 'react'
import { Check, CircleCheck, Clock, Eye, Mail, Pencil, Printer, UserRoundCog, X } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import SearchBar from '../components/SearchBar'
import { PageHeader, FilterBar, Tabs } from '../components/PageParts'
import Badge from '../components/Badge'
import EditBookingModal from '../components/EditBookingModal'

const FILTERS = ['all', 'pending', 'accepted', 'ongoing', 'completed', 'rejected', 'cancelled']
const INSPECTION_STEPS = [['pre_rental', 'Pre-rental'], ['post_rental', 'Post-rental']]
const EDITABLE = ['pending', 'rejected', 'accepted', 'ongoing']

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function Bookings() {
  const [bookings, setBookings] = useState([])
  const [staff, setStaff] = useState([])
  const [filter, setFilter] = useState('pending')
  const [assignFor, setAssignFor] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('upcoming')
  const [loading, setLoading] = useState(true)
  const [busyBooking, setBusyBooking] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [rejectFor, setRejectFor] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [reassignFor, setReassignFor] = useState(null)
  const [reassignStaff, setReassignStaff] = useState('')
  const [editFor, setEditFor] = useState(null)
  const [blacklistMatches, setBlacklistMatches] = useState({}) // customer id -> matching record on Pardz's blacklist

  async function load() {
    setLoading(true)
    try {
      const [bookingList, staffList, matches] = await Promise.all([
        api.get('/bookings', { status: filter, sort: 'created_desc' }),
        api.get('/admin/staff'),
        api.get('/admin/customers/blacklist-matches'),
      ])
      setBookings(bookingList)
      setStaff(staffList)
      setBlacklistMatches(Object.fromEntries(matches.map((match) => [match.customer_id, { ...match.record, matched_by: match.matched_by }])))
    } catch (error) {
      setActionError(error.message || 'Unable to load bookings.')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    return subscribe('bookings', load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const visibleBookings = bookings
    .filter((booking) => `${booking.profiles?.full_name ?? ''} ${booking.profiles?.email ?? ''} ${booking.profiles?.phone ?? ''} ${booking.vehicles?.make ?? ''} ${booking.vehicles?.model ?? ''} ${booking.vehicles?.plate_number ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((first, second) => {
      if (sortBy === 'customer') return (first.profiles?.full_name ?? '').localeCompare(second.profiles?.full_name ?? '')
      if (sortBy === 'newest') return second.start_date.localeCompare(first.start_date)
      return first.start_date.localeCompare(second.start_date)
    })

  async function reject(booking, reason) {
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    try {
      await api.post(`/bookings/${booking.id}/reject`, { reason })
      setRejectFor(null)
      setRejectionReason('')
    } catch (error) {
      setActionError(error.message)
    }
    await load()
    setBusyBooking('')
  }

  // mode: 'view' opens the agreement in a new tab, 'print' opens it with the print dialog.
  async function openAgreement(booking, mode) {
    setActionError('')
    // Open the tab right away (browsers only allow pop-ups straight after a click), then fill it in.
    const tab = window.open('', '_blank')
    if (tab) tab.document.title = 'Rental agreement'
    try {
      const pack = await api.get(`/bookings/${booking.id}/print-pack`)
      const { downloadAgreementPdf } = await import('../lib/agreementPdf') // loaded only when needed
      downloadAgreementPdf(pack, mode, tab)
    } catch (error) {
      tab?.close()
      setActionError(`Could not create the rental agreement: ${error.message}`)
    }
  }

  async function sendApprovalEmail(booking) {
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    try {
      await api.post(`/bookings/${booking.id}/send-approval-email`)
      setActionMessage(`Approval email sent to ${booking.profiles?.email || 'the customer'}.`)
    } catch (error) {
      setActionError(`Booking is accepted, but email delivery failed: ${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`)
    } finally {
      setBusyBooking('')
    }
  }

  async function confirmReassign(booking) {
    if (!reassignStaff) return
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')
    try {
      await api.post(`/bookings/${booking.id}/assign`, { staff_id: reassignStaff })
      const name = staff.find((member) => member.id === reassignStaff)?.full_name ?? 'the new staff member'
      setActionMessage(`Inspection reassigned to ${name}. Both staff members were notified.`)
      setReassignFor(null)
      setReassignStaff('')
    } catch (error) {
      setActionError(error.message)
    }
    await load()
    setBusyBooking('')
  }

  function staffName(id) {
    return staff.find((member) => member.id === id)?.full_name ?? 'Staff member'
  }

  async function confirmAccept(booking) {
    if (!selectedStaff || booking.profiles?.verification_status !== 'verified') return
    setBusyBooking(booking.id)
    setActionError('')
    setActionMessage('')

    try {
      await api.post(`/bookings/${booking.id}/accept`, { staff_id: selectedStaff })
    } catch (error) {
      const message = error.message || ''
      if (error.status === 409 && /no longer pending/i.test(message)) {
        setActionError('This booking is no longer pending. The list has been refreshed.')
        setAssignFor(null)
        setSelectedStaff('')
        await load()
      } else {
        setActionError(message.toLowerCase().includes('already reserved')
          ? 'This booking overlaps an accepted or ongoing rental, so it remains Pending. Resolve the conflicting booking or request different dates before accepting.'
          : message)
      }
      setBusyBooking('')
      return
    }

    await sendApprovalEmail(booking)

    setAssignFor(null)
    setSelectedStaff('')
    await load()
    setBusyBooking('')
  }

  return (
    <Layout>
      <PageHeader title="Bookings" description="Review requests from customers, accept them, and assign a staff member." />

      {actionError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{actionError}</p>}
      {actionMessage && <p role="status" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{actionMessage}</p>}

      <FilterBar tabs={<Tabs label="Booking status" value={filter} onChange={setFilter} options={FILTERS.map((status) => ({ key: status, label: status[0].toUpperCase() + status.slice(1) }))} />}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search customer, vehicle, or plate" />
        <select aria-label="Sort bookings" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="px-3 py-2 text-sm">
          <option value="upcoming">Date: upcoming first</option>
          <option value="newest">Date: latest first</option>
          <option value="customer">Customer: A to Z</option>
        </select>
      </FilterBar>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : visibleBookings.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>No bookings in this view.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium">Vehicle</th>
                <th className="py-3 px-4 font-medium">Schedule</th>
                <th className="py-3 px-4 font-medium">Request</th>
                <th className="py-3 px-4 font-medium">Verification</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="w-[220px] py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBookings.map((booking) => (
                <tr key={booking.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-4 align-top">
                    <p className="font-medium">{booking.profiles?.full_name}</p>
                    {booking.profiles?.is_blacklisted && <span className="badge badge-rejected mt-1">Blacklisted</span>}
                    {!booking.profiles?.is_blacklisted && blacklistMatches[booking.profiles?.id] && (
                      blacklistMatches[booking.profiles?.id].matched_by === 'id_number' ? (
                        <span className="badge badge-rejected mt-1" title={`ID number ${blacklistMatches[booking.profiles?.id].id_number} is on Pardz's blacklist (${blacklistMatches[booking.profiles?.id].full_name}). This booking can't be accepted.`}>
                          Blacklisted ID · {blacklistMatches[booking.profiles?.id].reason}
                        </span>
                      ) : (
                        <span className="badge badge-pending mt-1" title={`Name matches "${blacklistMatches[booking.profiles?.id].full_name}" on Pardz's blacklist. Check the ID before accepting.`}>
                          Name on blacklist · {blacklistMatches[booking.profiles?.id].reason}
                        </span>
                      )
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.profiles?.phone} · Age {booking.profiles?.age ?? 'Not provided'}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.profiles?.email}</p>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p className="font-medium">{booking.vehicles?.make} {booking.vehicles?.model}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.vehicles?.plate_number}</p>
                    {(booking.destination_from || booking.destination_to) && (
                      <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--nebula-3)' }}>{booking.destination_from ? `${booking.destination_from} → ${booking.destination_to || '—'}` : booking.destination_to}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <p>{booking.start_date} · {booking.pickup_time?.slice(0, 5) || '—'}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>to {booking.end_date} · {booking.return_time?.slice(0, 5) || '—'}</p>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p className="capitalize">{String(booking.service_type || 'self_drive').replaceAll('_', ' ')}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{booking.pickup_location || 'No pickup required'}</p>
                    {booking.notes && <p className="text-xs mt-1 italic max-w-56 whitespace-normal" style={{ color: 'var(--text-faint)' }}>&quot;{booking.notes}&quot;</p>}
                    {booking.rejection_reason && <p className="text-xs mt-1 max-w-56 whitespace-normal" style={{ color: 'var(--danger)' }}>Reason: {booking.rejection_reason}</p>}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p style={{ color: booking.profiles?.verification_status === 'verified' ? 'var(--success)' : 'var(--warning)' }}>{booking.profiles?.verification_status ?? 'unsubmitted'}</p>
                    {booking.profiles?.id_type && <p className="text-xs mt-1 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{booking.profiles.id_type} {booking.profiles.id_number}</p>}
                    {booking.profiles?.second_id_type && <p className="text-xs mt-1 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{booking.profiles.second_id_type} {booking.profiles.second_id_number}</p>}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <Badge status={booking.status} />
                    {['accepted', 'ongoing', 'completed'].includes(booking.status) && (
                      <div className="mt-3 grid gap-2">
                        {INSPECTION_STEPS.map(([type, label]) => {
                          const inspection = booking.inspections?.find((item) => item.type === type)
                          return inspection ? (
                            <div key={type} className="text-xs whitespace-nowrap">
                              <p className="flex items-center gap-1 font-medium" style={{ color: 'var(--success)' }}><CircleCheck size={13} /> {label} done</p>
                              <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>{inspection.staff_name || staffName(inspection.staff_id)} · {formatDateTime(inspection.created_at)}</p>
                              {Number(inspection.damage_fee) > 0 && <p className="mt-0.5" style={{ color: 'var(--warning)' }}>Damage fee ₱{Number(inspection.damage_fee).toLocaleString()}</p>}
                            </div>
                          ) : (
                            <p key={type} className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: 'var(--text-faint)' }}><Clock size={13} /> {label} pending</p>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  <td className="w-[220px] py-3 px-4 align-top">
                    {(booking.status === 'pending' || booking.status === 'rejected') && (assignFor === booking.id ? (
                      <div className="grid min-w-40 gap-2">
                        <select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} className="px-2 py-2 text-xs">
                          <option value="">Assign staff…</option>
                          {staff.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                        </select>
                        <button onClick={() => confirmAccept(booking)} disabled={!selectedStaff || booking.profiles?.verification_status !== 'verified' || busyBooking === booking.id} className="btn-primary w-full px-3 py-2 text-xs">
                          {busyBooking === booking.id ? 'Accepting…' : booking.status === 'rejected' ? 'Confirm accept again' : 'Confirm accept'}
                        </button>
                        {booking.profiles?.verification_status !== 'verified' && <span className="text-xs" style={{ color: 'var(--warning)' }}>Verify customer first.</span>}
                        <button onClick={() => { setAssignFor(null); setSelectedStaff('') }} className="btn-ghost w-full px-3 py-2 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <button onClick={() => setAssignFor(booking.id)} disabled={busyBooking === booking.id} className="btn-primary flex items-center justify-center gap-1.5 px-2 py-2 text-xs whitespace-nowrap"><Check size={14} /> {booking.status === 'rejected' ? 'Accept again' : 'Accept'}</button>
                        <button onClick={() => { setRejectFor(booking); setRejectionReason('') }} disabled={busyBooking === booking.id} className="btn-ghost flex items-center justify-center gap-1.5 px-2 py-2 text-xs whitespace-nowrap"><X size={14} /> {booking.status === 'rejected' ? 'Again' : 'Reject'}</button>
                      </div>
                    ))}
                    {(EDITABLE.includes(booking.status) || booking.status === 'accepted') && (
                      <div className="mb-3 flex gap-1.5">
                        {EDITABLE.includes(booking.status) && <button type="button" onClick={() => setEditFor(booking)} title="Edit booking" className="btn-ghost flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs"><Pencil size={14} /> Edit</button>}
                        {booking.status === 'accepted' && <button type="button" onClick={() => sendApprovalEmail(booking)} disabled={busyBooking === booking.id} title="Resend the approval email to the customer" className="btn-ghost flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs whitespace-nowrap"><Mail size={14} /> {busyBooking === booking.id ? 'Sending…' : 'Resend'}</button>}
                      </div>
                    )}
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Rental agreement</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button type="button" onClick={() => openAgreement(booking, 'view')} title="Open the rental agreement in a new tab" className="btn-ghost flex items-center justify-center gap-1.5 px-2 py-2 text-xs"><Eye size={14} /> View</button>
                      <button type="button" onClick={() => openAgreement(booking, 'print')} title="Print the rental agreement" className="btn-ghost flex items-center justify-center gap-1.5 px-2 py-2 text-xs"><Printer size={14} /> Print</button>
                    </div>
                    {booking.assigned_staff_id && <p className="mt-3 text-xs" style={{ color: 'var(--text-faint)' }}>Assigned: {staffName(booking.assigned_staff_id)}</p>}
                    {(booking.status === 'accepted' || booking.status === 'ongoing') && reassignFor !== booking.id && (
                      <button
                        type="button"
                        onClick={() => { setReassignFor(booking.id); setReassignStaff('') }}
                        disabled={staff.length < 2}
                        title={staff.length < 2 ? 'Add another staff member first' : 'Assign this booking to another staff member'}
                        className="btn-ghost mt-1.5 flex w-full items-center justify-center gap-1.5 px-2 py-2 text-xs"
                      >
                        <UserRoundCog size={14} /> Change staff
                      </button>
                    )}
                    {(booking.status === 'accepted' || booking.status === 'ongoing') && reassignFor === booking.id && (
                      <div className="mt-2 grid gap-2">
                        <select aria-label="New staff member" value={reassignStaff} onChange={(event) => setReassignStaff(event.target.value)} className="px-2 py-2 text-xs">
                          <option value="">Choose staff…</option>
                          {staff.filter((member) => member.id !== booking.assigned_staff_id).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                        </select>
                        <button onClick={() => confirmReassign(booking)} disabled={!reassignStaff || busyBooking === booking.id} className="btn-primary w-full px-3 py-2 text-xs">{busyBooking === booking.id ? 'Saving…' : 'Save new staff'}</button>
                        <button onClick={() => { setReassignFor(null); setReassignStaff('') }} className="btn-ghost w-full px-3 py-2 text-xs">Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editFor && (
        <EditBookingModal
          booking={editFor}
          onClose={() => setEditFor(null)}
          onSaved={() => { setEditFor(null); setActionMessage('Booking updated. The customer was notified.'); load() }}
        />
      )}
      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setRejectFor(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="reject-booking-title" className="card w-full max-w-lg p-5" onClick={(event) => event.stopPropagation()}>
            <h2 id="reject-booking-title" className="font-display text-lg font-semibold">{rejectFor.status === 'rejected' ? 'Reject booking again' : 'Reject booking'}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Give the customer a reason and explain what they can update. This note will replace the previous rejection note.</p>
            <label className="mt-4 flex flex-col gap-1 text-sm">Reason<textarea rows={4} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={2000} required placeholder="For example, please upload a clear, unexpired ID." className="px-3 py-2" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectFor(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => reject(rejectFor, rejectionReason.trim())} disabled={!rejectionReason.trim() || busyBooking === rejectFor.id} className="btn-primary px-4 py-2 text-sm">{busyBooking === rejectFor.id ? 'Sending…' : rejectFor.status === 'rejected' ? 'Reject again and notify' : 'Reject and notify'}</button>
            </div>
          </section>
        </div>
      )}
    </Layout>
  )
}

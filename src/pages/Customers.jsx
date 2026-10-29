import { useEffect, useState } from 'react'
import { Info, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/realtime'
import Layout from '../components/Layout'
import { PageHeader, FilterBar, Tabs } from '../components/PageParts'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'
import ChurnExplainer from '../components/ChurnExplainer'
import { printCustomerDocuments } from '../lib/print'

const AT_RISK = 'At Risk of Churn'

// Sort menu. Churn risk: highest percentage first; customers not rated yet go last.
const risk = (customer) => customer.churn?.probability ?? -1
const SORTS = {
  risk: { label: 'Churn risk: highest first', compare: (a, b) => risk(b) - risk(a) || a.full_name.localeCompare(b.full_name) },
  risk_low: { label: 'Churn risk: lowest first', compare: (a, b) => (risk(a) < 0) - (risk(b) < 0) || risk(a) - risk(b) || a.full_name.localeCompare(b.full_name) },
  name: { label: 'Name A–Z', compare: (a, b) => a.full_name.localeCompare(b.full_name) },
  newest: { label: 'Newest customers first', compare: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
}

// Churn prediction dropdown on the filter bar.
const CHURN_FILTERS = {
  all: { label: 'All churn predictions', match: () => true },
  at_risk: { label: 'At Risk of Churn (all)', match: (churn) => churn?.label === AT_RISK },
  valuable: { label: 'Valuable – At Risk', match: (churn) => Boolean(churn?.valuable) },
  likely: { label: 'Likely to Return', match: (churn) => churn?.label === 'Likely to Return' },
  not_rated: { label: 'New Customer – Not Yet Rated', match: (churn) => churn?.probability == null },
}
const NOT_RATED = { label: 'New Customer - Not Yet Rated', probability: null, valuable: false, rentals: 0 }

function churnDetails(features) {
  return `Last rental: ${features.days_since_last_rental} days ago; rentals: ${features.total_rentals_completed}; average gap: ${features.avg_days_between_rentals} days; late-return rate: ${Math.round(features.late_return_rate * 100)}%; preferred service: ${features.preferred_service_type.replace('_', ' ')}; customer for ${features.customer_tenure_days} days`
}

// Blacklisted = the account is blocked. An ID number on Pardz's blacklist can't book;
// a name-only match is flagged for the admin to review.
function standing(customer) {
  if (customer.is_blacklisted) return { label: 'Blacklisted', badge: 'badge-rejected' }
  if (customer.blacklistMatch?.matched_by === 'id_number') return { label: 'Blacklisted ID', badge: 'badge-rejected' }
  if (customer.blacklistMatch) return { label: 'Name on blacklist', badge: 'badge-pending' }
  return { label: 'Good standing', badge: 'badge-accepted' }
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [documents, setDocuments] = useState({})
  const [documentLoading, setDocumentLoading] = useState(false)
  const [rejectingCustomer, setRejectingCustomer] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [savingVerification, setSavingVerification] = useState(false)
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [churnFilter, setChurnFilter] = useState('all') // churn prediction dropdown
  const [sortBy, setSortBy] = useState('risk') // risk = highest churn risk first
  const [search, setSearch] = useState('')
  const [showChurnInfo, setShowChurnInfo] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [customerList, predictions, matches] = await Promise.all([
        api.get('/admin/customers'),
        api.get('/admin/churn/predictions'), // Random Forest results from the backend
        api.get('/admin/customers/blacklist-matches'),
      ])
      const matchByCustomer = Object.fromEntries(matches.map((match) => [match.customer_id, { ...match.record, matched_by: match.matched_by }]))
      const churnByCustomer = Object.fromEntries(predictions.map((prediction) => [prediction.customer_id, prediction]))
      setCustomers(customerList.map((customer) => {
        const churn = churnByCustomer[customer.id] || NOT_RATED
        return { ...customer, churn, churnFeatures: churn.features, blacklistMatch: matchByCustomer[customer.id] || null }
      }))
    } catch (error) {
      console.error('Unable to load customers:', error.message)
      setCustomers([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    return subscribe('notifications', load)
  }, [])

  const pendingReviews = customers.filter((customer) => customer.verification_status === 'pending').length
  const visibleCustomers = (needsReviewOnly
    ? customers.filter((customer) => customer.verification_status === 'pending')
    : customers
  ).filter((customer) => CHURN_FILTERS[churnFilter].match(customer.churn))
    .sort(SORTS[sortBy].compare)
    .filter((customer) => matchesSearch(search, customer.full_name, customer.email, customer.phone, customer.verification_status, customer.churn?.label, customer.churn?.valuable ? 'valuable at risk' : '', standing(customer).label, customer.blacklistMatch?.reason))

  async function deleteCustomer(customer) {
    if (!window.confirm(`Delete ${customer.full_name} and all of their booking history? This can't be undone.`)) return
    try {
      await api.delete(`/admin/customers/${customer.id}`)
    } catch (error) {
      window.alert(error.message || 'Unable to delete this customer.')
      return
    }
    load()
  }

  async function toggleBlacklist(id, current) {
    try {
      await api.patch(`/admin/customers/${id}/blacklist`, { is_blacklisted: !current })
    } catch (error) {
      console.error('Unable to update blacklist:', error.message)
    }
    load()
  }

  async function reviewVerification(customer, status) {
    const reason = rejectionReason.trim()
    if (status === 'rejected' && !reason) {
      setVerificationError('Enter a reason so the customer knows what to correct.')
      return
    }
    setSavingVerification(true)
    setVerificationError('')
    try {
      // For a rejection the server also sends the customer their "Requirements need correction" notification.
      await api.post(`/admin/customers/${customer.id}/verification`, { status, reason: status === 'rejected' ? reason : null })
    } catch (error) {
      setVerificationError(`Could not update verification: ${error.message}`)
      setSavingVerification(false)
      return
    }
    setSelectedCustomer({ ...customer, verification_status: status, verification_notes: status === 'rejected' ? reason : null })
    setRejectingCustomer(null)
    setRejectionReason('')
    setSavingVerification(false)
    load()
  }

  async function openCustomer(customer) {
    setSelectedCustomer(customer)
    setDocuments({})
    setDocumentLoading(true)
    let signedDocuments = {}
    try {
      signedDocuments = await api.get(`/admin/customers/${customer.id}/documents`)
    } catch (error) {
      console.error('Unable to load customer documents:', error.message)
    }
    setDocuments(signedDocuments)
    setDocumentLoading(false)
  }

  function printRequirements() {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setVerificationError('Allow pop-ups for this admin site to print documents.')
      return
    }
    try {
      printCustomerDocuments(selectedCustomer, documents, printWindow)
    } catch (printError) {
      setVerificationError(printError.message)
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Customers"
        description="Customer history, requirements review, and churn-risk signals calculated from completed rentals."
        actions={(
          <button onClick={() => setShowChurnInfo(true)} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-xl" aria-label="How churn is computed" title="How churn is computed">
            <Info size={18} />
          </button>
        )}
      />
      {showChurnInfo && (
        <ChurnExplainer
          example={customers.filter((c) => c.churnFeatures).sort((a, b) => b.churn.valuable - a.churn.valuable || b.churn.rentals - a.churn.rentals)[0]}
          onClose={() => setShowChurnInfo(false)}
          onRetrained={load}
        />
      )}

      <FilterBar tabs={(
        <Tabs
          label="Customers shown"
          value={needsReviewOnly ? 'review' : 'all'}
          onChange={(key) => setNeedsReviewOnly(key === 'review')}
          options={[{ key: 'all', label: 'All customers' }, { key: 'review', label: 'Needs requirements review', count: pendingReviews }]}
        />
      )}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, phone, verification, or churn status" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 text-sm" aria-label="Sort customers">
          {Object.entries(SORTS).map(([key, sort]) => <option key={key} value={key}>{sort.label}</option>)}
        </select>
        <select value={churnFilter} onChange={(e) => setChurnFilter(e.target.value)} className="px-3 py-2 text-sm" aria-label="Filter by churn prediction">
          {Object.entries(CHURN_FILTERS).map(([key, filter]) => (
            <option key={key} value={key}>{filter.label} ({customers.filter((c) => filter.match(c.churn)).length})</option>
          ))}
        </select>
      </FilterBar>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                <th className="py-3 px-5 font-medium">Name</th>
                <th className="py-3 px-5 font-medium">Email</th>
                <th className="py-3 px-5 font-medium">Phone</th>
                <th className="py-3 px-5 font-medium">ID verification</th>
                <th className="py-3 px-5 font-medium">Churn prediction</th>
                <th className="py-3 px-5 font-medium">Status</th>
                <th className="py-3 px-5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <td className="py-3 px-5"><button onClick={() => openCustomer(c)} className="font-medium hover:underline" style={{ color: 'var(--nebula-3)' }}>{c.full_name}</button></td>
                  <td className="py-3 px-5">{c.email}</td>
                  <td className="py-3 px-5">{c.phone || '—'}</td>
                  <td className="py-3 px-5">
                    <span className={`badge ${c.verification_status === 'verified' ? 'badge-accepted' : c.verification_status === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                      {c.verification_status}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    {c.churn.probability == null ? (
                      <>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.churn.label}</span>
                        <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.churn.rentals} completed {c.churn.rentals === 1 ? 'rental' : 'rentals'} (needs 2)</span>
                      </>
                    ) : (
                      <div title={churnDetails(c.churnFeatures)}>
                        <span className={`badge ${c.churn.label === AT_RISK ? 'badge-rejected' : 'badge-accepted'}`}>
                          {c.churn.valuable ? 'Valuable – At Risk' : c.churn.label}
                        </span>
                        <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {Math.round(c.churn.probability * 100)}% churn risk · {c.churn.rentals} rentals
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <span className={`badge ${standing(c).badge}`}>{standing(c).label}</span>
                    {c.blacklistMatch && (
                      <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }} title={`${c.blacklistMatch.matched_by === 'id_number' ? `ID number ${c.blacklistMatch.id_number}` : 'Name'} matches "${c.blacklistMatch.full_name}" on Pardz's blacklist`}>
                        {c.blacklistMatch.reason}{c.blacklistMatch.area ? ` · ${c.blacklistMatch.area}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <button onClick={() => toggleBlacklist(c.id, c.is_blacklisted)} className="btn-ghost px-3 py-1.5 text-xs">
                      {c.is_blacklisted ? 'Remove from blacklist' : 'Blacklist'}
                    </button>
                    <button onClick={() => deleteCustomer(c)} className="btn-ghost ml-2 px-3 py-1.5 text-xs" style={{ color: 'var(--danger)' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {visibleCustomers.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{search.trim() || churnFilter !== 'all' ? 'No customers match these filters.' : needsReviewOnly ? 'No customer requirements are waiting for review.' : 'No customers yet.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center p-3 sm:p-6 z-50 overflow-y-auto" onClick={() => { setSelectedCustomer(null); setRejectingCustomer(null) }}>
          <section className="card p-4 sm:p-6 w-full max-w-5xl my-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-xl font-semibold">Customer verification</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Review customer details and submitted documents.</p>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setRejectingCustomer(null) }} className="btn-ghost px-3 py-2 text-sm">Close</button>
            </div>
            {verificationError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{verificationError}</p>}
            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full name</p><p className="font-medium mt-1">{selectedCustomer.full_name}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Phone number</p><p className="font-medium mt-1">{selectedCustomer.phone || 'Not provided'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Age</p><p className="font-medium mt-1">{selectedCustomer.age ?? 'Not provided'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Email</p><p className="font-medium mt-1 break-all">{selectedCustomer.email}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Address</p><p className="font-medium mt-1">{selectedCustomer.address || 'Not provided'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Primary ID</p><p className="font-medium mt-1">{selectedCustomer.id_type || 'Not provided'}</p><p className="text-sm">{selectedCustomer.id_number || 'No number'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Second ID</p><p className="font-medium mt-1">{selectedCustomer.second_id_type || 'Not provided'}</p><p className="text-sm">{selectedCustomer.second_id_number || 'No number'}</p></div>
              <div className="card p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Verification status</p><span className={`badge mt-2 ${selectedCustomer.verification_status === 'verified' ? 'badge-accepted' : selectedCustomer.verification_status === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>{selectedCustomer.verification_status}</span></div>
            </div>
            {selectedCustomer.verification_notes && (
              <p className="mb-5 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>
                Last rejection note: {selectedCustomer.verification_notes}
              </p>
            )}
            <h3 className="font-display font-semibold mb-3">Submitted documents</h3>
            {documentLoading ? <p className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading documents…</p> : (
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['primaryId', `Primary ID · ${selectedCustomer.id_type || 'Type not provided'} (${selectedCustomer.id_number || 'No number'})`],
                  ['secondId', `Second ID · ${selectedCustomer.second_id_type || 'Type not provided'} (${selectedCustomer.second_id_number || 'No number'})`],
                  ['address', 'Proof of address'],
                  ['income', 'Proof of income'],
                  ['extra1', 'Additional photo 1 (optional)'],
                  ['extra2', 'Additional photo 2 (optional)'],
                ].map(([key, label]) => (
                  <div key={key} className="card p-3">
                    <p className="text-sm font-medium mb-2">{label}</p>
                    {documents[key] ? <iframe title={label} src={documents[key]} className="w-full h-56 rounded-lg" /> : <div className="h-56 flex items-center justify-center rounded-lg text-sm" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>Document not submitted</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={printRequirements} disabled={documentLoading || !Object.values(documents).some(Boolean)} className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"><Printer size={16} /> Print submitted requirements</button>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              {selectedCustomer.verification_status !== 'verified' && <>
                <button onClick={() => { setRejectingCustomer(selectedCustomer); setRejectionReason(''); setVerificationError('') }} className="btn-ghost px-4 py-2 text-sm">Reject documents</button>
                <button onClick={() => reviewVerification(selectedCustomer, 'verified')} disabled={savingVerification || !selectedCustomer.id_photo_path || !selectedCustomer.second_id_photo_path || !selectedCustomer.proof_of_address_path || !selectedCustomer.proof_of_income_path} className="btn-primary px-4 py-2 text-sm">{savingVerification ? 'Saving…' : 'Verify customer'}</button>
                {(!selectedCustomer.id_photo_path || !selectedCustomer.second_id_photo_path || !selectedCustomer.proof_of_address_path || !selectedCustomer.proof_of_income_path) && <p className="text-xs self-center" style={{ color: 'var(--warning)' }}>All four documents are required before verification.</p>}
              </>}
              {selectedCustomer.verification_status === 'verified' && <span className="text-sm self-center" style={{ color: 'var(--success)' }}>Documents verified</span>}
            </div>
            {rejectingCustomer?.id === selectedCustomer.id && (
              <div className="card p-4 grid gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Reason for rejection
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="For example, the government ID photo is blurry or expired."
                    className="px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRejectingCustomer(null)} disabled={savingVerification} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                  <button onClick={() => reviewVerification(selectedCustomer, 'rejected')} disabled={savingVerification} className="btn-primary px-4 py-2 text-sm">{savingVerification ? 'Sending…' : 'Reject and notify customer'}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  )
}

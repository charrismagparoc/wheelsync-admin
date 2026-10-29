import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { PageHeader, FilterBar } from '../components/PageParts'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'
import PasswordInput from '../components/PasswordInput'

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // the staff member being edited, or null when adding
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  async function load() {
    try {
      setStaff(await api.get('/admin/staff'))
    } catch (error) {
      console.error('Unable to load staff:', error.message)
    }
  }

  useEffect(() => { load() }, [])

  function openForm(member = null) {
    setEditing(member)
    setForm(member
      ? { full_name: member.full_name, email: member.email || '', phone: member.phone || '', password: '' }
      : { full_name: '', email: '', phone: '', password: '' })
    setError('')
    setShowForm(true)
  }

  async function saveStaff(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const details = { full_name: form.full_name.trim(), email: form.email.trim().toLowerCase() || null, phone: form.phone.trim() }
    try {
      if (editing) await api.patch(`/admin/staff/${editing.id}`, { ...details, password: form.password || null })
      else await api.post('/admin/staff', { ...details, password: form.password })
    } catch (createError) {
      setBusy(false)
      setError(createError.message)
      return
    }
    setBusy(false)
    setForm({ full_name: '', email: '', phone: '', password: '' })
    setShowForm(false)
    load()
  }

  const visibleStaff = staff.filter((member) => matchesSearch(search, member.full_name, member.email, member.phone))

  return (
    <Layout>
      <PageHeader title="Staff accounts" description="Staff can't self-register. Create their login here and share the credentials." actions={(
        <button onClick={() => openForm()} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> Add staff
        </button>
      )} />

      {showForm && (
        <Modal
          title={editing ? `Edit staff · ${editing.full_name}` : 'Add staff'}
          description={editing ? 'Change their details, or set a new password if they forgot it. They sign in with their phone number (or email).' : 'They sign in to the staff mobile app with their phone number (or email) and this password.'}
          onClose={() => { if (!busy) setShowForm(false) }}
          size="max-w-lg"
        >
          <form onSubmit={saveStaff} className="flex flex-col gap-3">
            {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            <label className="flex flex-col gap-1 text-sm">Full name<input required autoFocus className="px-3 py-2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-sm">Phone<input required type="tel" minLength={7} placeholder="09XX XXX XXXX" className="px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-sm">Email (optional)<input type="email" className="px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-sm">
              {editing ? 'New password (optional)' : 'Temporary password'}
              <PasswordInput required={!editing} minLength={6} autoComplete="new-password" placeholder={editing ? 'Leave empty to keep the current password' : 'At least 6 characters'} className="px-3 py-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <div className="modal-actions flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={busy} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create staff account'}</button>
            </div>
          </form>
        </Modal>
      )}

      <FilterBar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, or phone" />
      </FilterBar>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="py-3 px-5 font-medium">Name</th>
              <th className="py-3 px-5 font-medium">Email</th>
              <th className="py-3 px-5 font-medium">Phone</th>
              <th className="py-3 px-5 font-medium">Joined</th>
              <th className="py-3 px-5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                <td className="py-3 px-5">{s.full_name}</td>
                <td className="py-3 px-5">{s.email || '—'}</td>
                <td className="py-3 px-5">{s.phone || '—'}</td>
                <td className="py-3 px-5">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-5 text-right"><button onClick={() => openForm(s)} className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Pencil size={13} /> Edit</button></td>
              </tr>
            ))}
            {visibleStaff.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{staff.length ? 'No staff match this search.' : 'No staff accounts yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

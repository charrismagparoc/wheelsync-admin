import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { PageHeader } from '../components/PageParts'
import SearchBar from '../components/SearchBar'
import { matchesSearch } from '../lib/search'

const company = {
  name: 'Pardz Car Rental',
  phone: '0917-7029-367',
  email: 'pardzcarrental@gmail.com',
  address: 'Zone 7, Kauswagan Highway, Cagayan de Oro City',
}

function csvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export default function Reports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState('csv')
  const [facebookPage, setFacebookPage] = useState(() => localStorage.getItem('pardz-facebook-page') || 'Pardz Car Rental')

  async function load() {
    setLoading(true)
    try {
      setRows(await api.get('/bookings', { status: 'all', start_from: from, start_to: to, sort: 'start_desc' }))
    } catch (error) {
      console.error('Unable to load report:', error.message)
      setRows([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function exportCsv(branded = false) {
    const header = ['Booking ID', 'Customer', 'Vehicle', 'Plate', 'Start date', 'Pickup time', 'End date', 'Return time', 'Service', 'Status', 'Late return']
    const data = rows.map((row) => [row.id, row.profiles?.full_name, `${row.vehicles?.make} ${row.vehicles?.model}`, row.vehicles?.plate_number, row.start_date, row.pickup_time, row.end_date, row.return_time, row.service_type, row.status, row.late_return ? 'Yes' : 'No'])
    const reportRange = `${from || 'All dates'} to ${to || 'Present'}`
    const contentRows = branded
      ? [[company.name], [company.phone, company.email, company.address], [`Facebook: ${facebookPage || company.name}`], ['Rental transaction report'], [`Period: ${reportRange}`], [`Generated: ${new Date().toLocaleString()}`], [], header, ...data]
      : [header, ...data]
    const content = contentRows.map((line) => line.map(csvValue).join(',')).join('\n')
    download(content, 'text/csv;charset=utf-8', `pardz-rental-report${branded ? '-branded' : ''}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const [exportError, setExportError] = useState('')

  async function exportReport() {
    setExportError('')
    const meta = { company, facebook: facebookPage.trim(), period: `${from || 'All dates'} to ${to || 'Present'}` }
    try {
      if (exportFormat === 'csv' || exportFormat === 'branded-csv') return exportCsv(exportFormat === 'branded-csv')
      // The Word/PDF builders are large: load them only when such a report is exported.
      const { exportReportDocx, exportReportPdf } = await import('../lib/reportExport')
      if (exportFormat === 'pdf') exportReportPdf(rows, meta)
      else await exportReportDocx(rows, meta)
    } catch (error) {
      setExportError(`Could not create the report file: ${error.message}`)
    }
  }

  const visibleRows = rows.filter((row) => matchesSearch(search, row.profiles?.full_name, row.vehicles?.make, row.vehicles?.model, row.vehicles?.plate_number, row.start_date, row.end_date, row.status, row.service_type?.replaceAll('_', ' ')))

  return (
    <Layout>
      <PageHeader title="Reports" description="Filter and export rental transaction records." actions={(
        <>
          <select aria-label="Report export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} className="px-3 py-2 text-sm">
            <option value="csv">CSV · plain</option>
            <option value="branded-csv">CSV · Pardz header</option>
            <option value="docx">Word (.docx) · Pardz design</option>
            <option value="pdf">PDF · Pardz design</option>
          </select>
          <button onClick={exportReport} disabled={!rows.length} className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><Download size={16} /> Export report</button>
        </>
      )} />
      {exportError && <p role="alert" className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{exportError}</p>}
      <div className="card p-4 mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="px-3 py-2" /></label>
        <label className="flex flex-col gap-1 text-sm">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="px-3 py-2" /></label>
        <label className="flex flex-col gap-1 text-sm">Facebook page details<input value={facebookPage} onChange={(event) => { setFacebookPage(event.target.value); localStorage.setItem('pardz-facebook-page', event.target.value) }} className="px-3 py-2" placeholder="Page name or URL" /></label>
        <button onClick={load} className="btn-primary px-4 py-2 text-sm">Apply filters</button>
        <div className="basis-full pt-3 flex" style={{ borderTop: '1px solid var(--border-soft)' }}><SearchBar value={search} onChange={setSearch} placeholder="Search customer, vehicle, plate, date, or status" /></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="text-left" style={{ color: 'var(--text-muted)' }}><th className="py-3 px-4">Customer</th><th className="py-3 px-4">Vehicle</th><th className="py-3 px-4">Dates & times</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Late</th></tr></thead>
          <tbody>{visibleRows.map((row) => <tr key={row.id} style={{ borderTop: '1px solid var(--border-soft)' }}><td className="py-3 px-4">{row.profiles?.full_name}</td><td className="py-3 px-4">{row.vehicles?.make} {row.vehicles?.model} ({row.vehicles?.plate_number})</td><td className="py-3 px-4">{row.start_date} {row.pickup_time?.slice(0, 5) || ''} → {row.end_date} {row.return_time?.slice(0, 5) || ''}</td><td className="py-3 px-4 capitalize">{row.status}</td><td className="py-3 px-4">{row.late_return ? 'Yes' : 'No'}</td></tr>)}</tbody>
        </table>
        {!loading && visibleRows.length === 0 && <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>{rows.length ? 'No records match this search.' : 'No records found.'}</p>}
        {loading && <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      </div>
    </Layout>
  )
}

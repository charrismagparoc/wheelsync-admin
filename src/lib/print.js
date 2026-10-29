import { buildAgreement, emphasis } from './agreementContent'

function escapeHtml(value) {
  return String(value ?? 'Not provided').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

// Tool ids sent by the staff app (staff-mobile src/lib/inspectionData.js).
const TOOL_LABELS = {
  or_cr: 'OR and CR', car_jack: 'Car Jack', tire_wrench: 'Tire Wrench', spare_tire: 'Spare Tire',
  warning_device: 'Early Warning Device', car_matting: 'Car Matting', rain_visor: 'Rain Visor',
  seat_cover: 'Seat Cover', umbrella: 'Umbrella', freshener: 'Freshener', hub_cap: 'Hub Cap',
}
const TOOL_STATUS_LABELS = { present: 'Present', missing: 'Missing', damaged: 'Damaged' }

// Customer documents in printing order. Every sheet holds two of them, each taking half the page,
// so no bond paper is left half empty. The first sheet also carries the heading.
const DOCUMENT_ORDER = [
  ['Primary ID', 'primaryId', 'Primary ID'], ['Second ID', 'secondId', 'Second ID'],
  ['Proof of address', 'address', 'Proof of address'], ['Proof of income', 'income', 'Proof of income'],
  ['Additional photo 1', 'extra1', 'Additional document 1'], ['Additional photo 2', 'extra2', 'Additional document 2'],
]

function documentSheets(documents, heading = '', breakBefore = false) {
  const entries = documents.filter(([, url]) => url)
  if (!entries.length) return heading ? `<section class="sheet">${heading}<p>No documents were submitted.</p></section>` : ''
  const sheets = []
  for (let index = 0; index < entries.length; index += 2) {
    const items = entries.slice(index, index + 2).map(([label, url]) => {
      const safeUrl = escapeHtml(url)
      const content = url.split('?')[0].toLowerCase().endsWith('.pdf')
        ? `<iframe title="${escapeHtml(label)}" src="${safeUrl}"></iframe>`
        : `<img src="${safeUrl}" alt="${escapeHtml(label)}">`
      return `<figure class="doc"><figcaption>${escapeHtml(label)}</figcaption>${content}</figure>`
    }).join('')
    const first = index === 0
    sheets.push(`<section class="sheet${first && !breakBefore ? ' first' : ''}">${first ? heading : ''}${items}</section>`)
  }
  return sheets.join('')
}

function openPrintWindow(title, content, printWindow, autoPrint = true) {
  printWindow ||= window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) throw new Error('Allow pop-ups for this admin site to print documents.')
  if (printWindow.closed) throw new Error('The print window was closed before the documents were ready. Try again.')
  try {
    writePrintDocument(printWindow, title, content, autoPrint)
  } catch (error) {
    printWindow.close()
    throw new Error(`Could not prepare the printout: ${error.message}`)
  }
}

function writePrintDocument(printWindow, title, content, autoPrint = true) {
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      @page { size: 8.5in 13in; margin: 16mm 16mm 10mm; }
      * { box-sizing: border-box; }
      body { color: #111; font: 12px Arial, sans-serif; line-height: 1.45; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 1px solid #888; padding-bottom: 4px; }
      h3 { font-size: 13px; margin: 0 0 8px; }
      p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
      th, td { border: 1px solid #aaa; padding: 6px; text-align: left; vertical-align: top; }
      th { width: 30%; background: #f1f1f1; }
      .muted { color: #555; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 54px; }
      .signature { border-top: 1px solid #111; padding-top: 6px; }
      /* Agreement page: same measurements as the Bookings agreement (lib/agreementPdf.js: 16 mm margins, 10 pt text,
         4.7 mm lines and the same gaps between sections), so both printouts look the same. */
      .agreement { font-size: 10pt; line-height: 4.5mm; page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
      .agreement h1 { text-align: center; font-size: 15pt; line-height: 1; margin: 1mm 0 6.5mm; }
      .agreement h2 { text-align: center; font-size: 10pt; margin: 4.3mm 0 3.3mm; border: 0; padding: 0; }
      .agreement p { margin: 0; }
      .agreement .preamble { font-weight: 700; font-size: 9.5pt; margin-bottom: 3.3mm; }
      .agreement .ln { display: flex; align-items: flex-end; white-space: pre; margin: 0 0 2.3mm; }
      .agreement .ln.gap { margin-bottom: 4.3mm; }
      .agreement .bl { flex: 1; min-width: 6mm; margin: 0 1mm; border-bottom: 1px solid #111; text-align: center; padding: 0 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .agreement .intro { margin-bottom: 4.3mm; }
      .agreement .details { display: grid; grid-template-columns: 44fr 36fr 64fr 50fr; gap: 2.5mm 2mm; margin: 0 0 5mm; font-size: 9.5pt; }
      .agreement .cell { display: flex; align-items: flex-end; gap: 1.5mm; white-space: nowrap; }
      .agreement .fuel { font-size: 9pt; }
      .agreement .renter { margin-bottom: 2.3mm; }
      .agreement .terms { list-style: none; padding: 0; margin: 0 0 4mm 7mm; }
      .agreement .terms li { display: grid; grid-template-columns: 8mm 1fr; margin: 0 0 1mm; text-align: justify; }
      .agreement .liability { max-width: 82mm; margin: 0 auto 4mm; font-size: 9.5pt; }
      .agreement .justify { text-align: justify; margin-bottom: 4.5mm; }
      .agreement .signers { display: grid; grid-template-columns: 70mm 70mm; justify-content: space-between; margin: 12mm 6mm 0; }
      .agreement .sign-line { border-bottom: 1px solid #111; text-align: center; min-height: 4.7mm; }
      .agreement .sign-role { display: block; text-align: center; font-size: 9.5pt; margin: 1mm 0 4.5mm; }
      .agreement .ctc { display: flex; align-items: flex-end; gap: 2mm; font-size: 8.5pt; margin: 0 0 1.5mm; }
      .agreement .presence { text-align: center; font-weight: 700; font-size: 9.5pt; margin-top: 7mm; }
      .agreement .witness { margin-top: 7mm; }
      /* One bond paper (8.5 x 13 in) = one sheet: heading (first sheet only) + two documents sharing the height. */
      .sheet { height: 300mm; display: flex; flex-direction: column; gap: 4mm; page-break-before: always; break-before: page; page-break-inside: avoid; break-inside: avoid; }
      .sheet.first { page-break-before: auto; break-before: auto; }
      .sheet-head h1 { margin: 0; font-size: 18px; }
      .sheet-head p { margin: 2px 0 0; color: #555; }
      .doc { flex: 1 1 0; min-height: 0; margin: 0; display: flex; flex-direction: column; border: 1px solid #ddd; border-radius: 2mm; padding: 2mm; }
      .doc figcaption { font-size: 10px; font-weight: 700; margin-bottom: 1.5mm; }
      .doc img, .doc iframe { flex: 1; min-height: 0; width: 100%; height: 100%; object-fit: contain; border: 0; }
      .inspection { page-break-before: always; break-before: page; }
      .photos-page { page-break-before: always; break-before: page; }
      .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
      .photo-grid figure { margin: 0; break-inside: avoid; }
      .photo-grid img { width: 100%; height: 80mm; object-fit: cover; border-radius: 2mm; }
      .photo-grid figcaption { font-size: 10px; color: #555; margin-top: 1mm; }
      .load-error { border: 1px dashed #b91c1c; color: #b91c1c; padding: 12px; font-size: 11px; }
      @media screen { body { max-width: 800px; margin: 32px auto; padding: 24px; } }
    </style></head><body>${content}
    <script>
      // A document link that expired or a file that is missing prints a clear note instead of a broken image.
      const showLoadError = (img) => {
        const note = document.createElement('p');
        note.className = 'load-error';
        note.textContent = (img.alt || 'File') + ' could not be loaded. Close this window and print again to get a fresh link.';
        img.replaceWith(note);
      };
      document.querySelectorAll('img').forEach((img) => {
        if (img.complete && img.naturalWidth === 0) showLoadError(img);
        else img.addEventListener('error', () => showLoadError(img));
      });
      ${autoPrint ? "window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 700));" : ''}
    </script>
    </body></html>`)
  printWindow.document.close()
}

export function printCustomerDocuments(customer, documents, printWindow) {
  const heading = `<div class="sheet-head"><h1>Customer requirements</h1><p>${escapeHtml(customer.full_name)} · ${escapeHtml(customer.email)}</p></div>`
  const content = documentSheets(DOCUMENT_ORDER.map(([label, key]) => [label, documents?.[key]]), heading)
  openPrintWindow(`Requirements - ${customer.full_name}`, content, printWindow)
}

// mode: 'print' opens the print dialog, 'view' only shows the pack (it can still be printed from the browser).
export function printRentalPack(pack, printWindow, mode = 'print') {
  const { customer } = pack
  // Same text and layout as the agreement on the Bookings page (lib/agreementPdf.js), so both printouts match.
  const a = buildAgreement(pack)
  const fill = (value, width = '') => `<span class="bl"${width ? ` style="flex:0 0 ${width}"` : ''}>${escapeHtml(value || '')}</span>`
  const cell = (label, value) => `<div class="cell"><span>${escapeHtml(label)}</span>${fill(value)}</div>`
  const rich = (text) => emphasis(text).map(([part, bold]) => (bold ? `<b>${escapeHtml(part)}</b>` : escapeHtml(part))).join('')
  const fuelLevel = (pack.inspections || []).find((inspection) => inspection.type === 'pre_rental')?.fuel_level
  const fuel = [['F', 'Full'], ['¾', '3/4'], ['½', '1/2'], ['¼', '1/4'], ['E', 'Empty']]
    .map(([label, value]) => `${label}(${fuelLevel === value ? 'X' : '&nbsp;'})`).join(' ')
  const signer = (name, role) => `<div class="sign">
      <div class="sign-line">${escapeHtml(name)}</div><b class="sign-role">${role}</b>
      ${['CTC No.', 'Issued on.', 'Issued at'].map((label) => `<div class="ctc"><b>${label}</b><span class="bl"></span></div>`).join('')}
    </div>`
  const agreement = `<article class="agreement">
    <h1>${escapeHtml(a.title)}</h1>
    <p class="preamble">${escapeHtml(a.preamble)}</p>
    <div class="ln">This AGREEMENT is entered into by and between ${fill(a.name)} a resident of</div>
    <div class="ln gap">${fill(a.address)} and holder of Driver's license no. ${fill(a.license, '48mm')}</div>
    <div class="ln gap">Here under called the <b>RENTER AND PARDZ CAR RENTAL</b>, represented by ${fill('')}.</div>
    <h2>${escapeHtml(a.witnesseth)}</h2>
    <p class="intro">${escapeHtml(a.intro)}</p>
    <div class="details">
      ${cell('Make/Model:', a.vehicle)}${cell('Plate No.', a.plate)}${cell('Motor No:', '')}${cell('Chassis No:', '')}
      <div class="cell fuel">FUEL: ${fuel}</div>${cell('Rental Rate:', '')}${cell('Date & Time release:', a.release)}${cell('Cell. no.:', a.phone)}
      <div></div><div></div>${cell('Date & Time End:', a.end)}${cell('Signature:', '')}
    </div>
    <p class="renter">The Renter agrees:</p>
    <ol class="terms">${a.renterTerms.map((term, index) => `<li><span>${index + 1}.)</span><span>${rich(term)}</span></li>`).join('')}</ol>
    <h2 class="liability">${escapeHtml(a.liabilityHeading)}</h2>
    <p class="justify">${rich(a.liability)}</p>
    <div class="ln">IN WITNESS WHEREOF, the parties have here unto sign this Agreement in ${escapeHtml(a.signingLocation)}, this ${fill(a.day)}</div>
    <div class="ln">day of ${fill(a.month, '34mm')} 20${fill(a.year, '8mm')}.</div>
    <div class="signers">${signer(a.name, '(LESSEE/RENTER)')}${signer('', '(LESSOR/ OWNER)')}</div>
    <p class="presence">SIGNED IN THE PRESENCE OF:</p>
    <div class="signers witness"><div class="ctc"><b>1.)</b><span class="bl"></span></div><div class="ctc"><b>2.)</b><span class="bl"></span></div></div>
  </article>`
  const documents = documentSheets(DOCUMENT_ORDER.map(([label, , packKey]) => [label, pack.documents?.[packKey]]), '', true)
  const inspections = (pack.inspections || []).map((inspection) => {
    const tools = Object.entries(inspection.tools || {})
    const checklist = tools.length
      ? tools.map(([id, status]) => `<tr><td>${escapeHtml(TOOL_LABELS[id] || id)}</td><td>${TOOL_STATUS_LABELS[status] || 'Not checked'}</td></tr>`).join('')
      : Object.entries(inspection.checklist || {}).map(([label, checked]) => {
        const status = label.startsWith('Damage:')
          ? (checked ? 'Damage recorded' : 'No damage marked')
          : (checked ? 'Confirmed' : 'Not checked')
        return `<tr><td>${escapeHtml(label)}</td><td>${status}</td></tr>`
      }).join('')
    const marks = (inspection.damage_marks || [])
      .map((mark) => `<tr><td>${escapeHtml(mark.zone_label || mark.zone)}</td><td>${escapeHtml(mark.label || mark.code)}</td></tr>`).join('')
    const signed = (name, isSigned) => `${escapeHtml(name)} - ${isSigned ? 'Signed' : 'Not signed'}`
    const photoUrls = inspection.photo_urls || []
    const photos = photoUrls.length
      ? `<section class="photos-page"><h2>${inspection.type === 'pre_rental' ? 'Pre-rental' : 'Post-rental'} damage photos</h2><div class="photo-grid">${
        photoUrls.map((url, index) => `<figure><img src="${escapeHtml(url)}" alt="Damage photo ${index + 1}"><figcaption>Photo ${index + 1}</figcaption></figure>`).join('')
      }</div></section>`
      : ''
    return `<section class="inspection"><h1>${inspection.type === 'pre_rental' ? 'Pre-rental' : 'Post-rental'} inspection checklist</h1>
      <p class="muted">Recorded ${escapeHtml(inspection.created_at)}</p><table>${checklist || '<tr><td>No checklist items recorded</td></tr>'}</table>
      <table><tr><th>Odometer</th><td>${escapeHtml(inspection.odometer_reading)} km</td></tr><tr><th>Fuel</th><td>${escapeHtml(inspection.fuel_level)}</td></tr>
      <tr><th>Damage notes</th><td>${escapeHtml(inspection.damage_notes)}</td></tr><tr><th>Damage fee</th><td>PHP ${Number(inspection.damage_fee || 0).toLocaleString()}</td></tr></table>
      <h2>Vehicle damage</h2><table><tr><th>Location</th><th>Damage</th></tr>${marks || '<tr><td colspan="2">No damage marked</td></tr>'}</table>
      <h2>Sign-off</h2><table><tr><th>Renter</th><td>${signed(inspection.renter_name, inspection.renter_signed)}</td></tr>
      <tr><th>Staff</th><td>${signed(inspection.staff_name, inspection.staff_signed)}</td></tr></table></section>${photos}`
  }).join('')
  openPrintWindow(`Rental pack - ${customer.full_name}`, `${agreement}${documents}${inspections}`, printWindow, mode === 'print')
}
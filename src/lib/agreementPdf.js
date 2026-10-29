import { jsPDF } from 'jspdf'
import { buildAgreement, emphasis } from './agreementContent'

// The rental agreement as a PDF on long bond paper (8.5 x 13 in), laid out like Pardz Car Rental's paper form.
const INK = [20, 20, 20]
const FILLED = INK // values printed on the blanks: black, like the rest of the form
const MARGIN = 16
const SIZE = 10

// mode: 'view' shows the agreement in `tab` (a browser tab opened on click), 'print' shows it with the
// print dialog; anything else downloads the PDF file.
export function downloadAgreementPdf(pack, mode = 'download', tab = null) {
  const a = buildAgreement(pack)
  const pdf = new jsPDF({ unit: 'mm', format: [215.9, 330.2] })
  const width = pdf.internal.pageSize.getWidth()
  const right = width - MARGIN
  const content = right - MARGIN
  const lineHeight = SIZE * 0.47
  let y = 22

  // Measured without kerning: jsPDF draws standard fonts unkerned, so this is where the text really ends.
  const measure = (text, bold = false, size = SIZE) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size)
    return (pdf.getStringUnitWidth(text, { kerning: {} }) * size) / pdf.internal.scaleFactor
  }
  const write = (text, x, at, { bold = false, size = SIZE, color = INK, align } = {}) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...color)
    pdf.text(text, x, at, align ? { align } : undefined)
  }

  // A blank to fill in: an underline with the known value printed on it (shrunk to fit when long).
  function blank(value, x, w, at) {
    pdf.setDrawColor(...INK).setLineWidth(0.25).line(x, at + 1.2, x + w, at + 1.2)
    if (!value) return
    let size = SIZE
    while (size > 6.5 && measure(value, false, size) > w - 2) size -= 0.5
    write(value, x + w / 2, at, { size, color: FILLED, align: 'center' })
  }

  // One line of text pieces and blanks; a blank with width 'fill' takes the room that is left.
  function line(parts, at = y) {
    const fixed = parts.reduce((sum, part) => sum + (part.blank !== undefined ? (part.w === 'fill' ? 0 : part.w) : measure(part.t, part.b)), 0)
    let x = MARGIN
    for (const part of parts) {
      if (part.blank !== undefined) {
        const w = part.w === 'fill' ? content - fixed : part.w
        blank(part.blank, x, w, at)
        x += w
      } else {
        write(part.t, x, at, { bold: part.b })
        x += measure(part.t, part.b)
      }
    }
  }

  // Wrapped (optionally justified) text made of [text, bold] pieces, placed word by word.
  function block(pieces, x, w, { justify = false } = {}) {
    const words = []
    let joinNext = false
    for (const [text, bold] of pieces) {
      text.split(/(\s+)/).forEach((token) => {
        if (!token) return
        if (/^\s+$/.test(token)) { joinNext = false; return }
        if (joinNext && words.length) words[words.length - 1].push([token, bold])
        else words.push([[token, bold]])
        joinNext = true
      })
    }
    const wordWidth = (word) => word.reduce((sum, [text, bold]) => sum + measure(text, bold), 0)
    const space = measure(' ')
    const lines = [[]]
    let used = 0
    for (const word of words) {
      const ww = wordWidth(word)
      const current = lines[lines.length - 1]
      if (current.length && used + space + ww > w) { lines.push([word]); used = ww } else { current.push(word); used += (current.length > 1 ? space : 0) + ww }
    }
    lines.forEach((words, index) => {
      const total = words.reduce((sum, word) => sum + wordWidth(word), 0)
      const gap = justify && index < lines.length - 1 && words.length > 1 ? (w - total) / (words.length - 1) : space
      let x2 = x
      for (const word of words) {
        for (const [text, bold] of word) { write(text, x2, y, { bold }); x2 += measure(text, bold) }
        x2 += gap
      }
      y += lineHeight
    })
  }

  write(a.title, width / 2, y, { bold: true, size: 15, align: 'center' })
  y += 12
  write(a.preamble, MARGIN, y, { bold: true, size: 9.5 })
  y += 8
  line([{ t: 'This AGREEMENT is entered into by and between ' }, { blank: a.name, w: 'fill' }, { t: ' a resident of' }])
  y += 7
  line([{ blank: a.address, w: 'fill' }, { t: " and holder of Driver's license no. " }, { blank: a.license, w: 48 }])
  y += 9
  line([{ t: 'Here under called the ' }, { t: 'RENTER AND PARDZ CAR RENTAL', b: true }, { t: ', represented by ' }, { blank: '', w: 'fill' }, { t: '.' }])
  y += 9
  write(a.witnesseth, width / 2, y, { bold: true, align: 'center' })
  y += 8
  write(a.intro, MARGIN, y)
  y += 9

  // Vehicle details: three rows of label + blank, in four columns like the paper form.
  const columns = [[0, 44], [45, 36], [82, 64], [147, content - 147]]
  const cell = (column, label, value, at) => {
    const [offset, w] = columns[column]
    const labelWidth = measure(label, false, 9.5) + 1.5
    write(label, MARGIN + offset, at, { size: 9.5 })
    blank(value, MARGIN + offset + labelWidth, w - labelWidth - 2, at)
  }
  cell(0, 'Make/Model:', a.vehicle, y); cell(1, 'Plate No.', a.plate, y); cell(2, 'Motor No:', '', y); cell(3, 'Chassis No:', '', y)
  y += 7.5
  write('FUEL: F( ) ¾( ) ½( ) ¼( ) E( )', MARGIN, y, { size: 9 })
  cell(1, 'Rental Rate:', '', y); cell(2, 'Date & Time release:', a.release, y); cell(3, 'Cell. no.:', a.phone, y)
  y += 7.5
  cell(2, 'Date & Time End:', a.end, y); cell(3, 'Signature:', '', y)
  y += 11

  write('The Renter agrees:', MARGIN, y)
  y += 7
  a.renterTerms.forEach((term, index) => {
    write(`${index + 1}.)`, MARGIN + 7, y)
    block(emphasis(term), MARGIN + 15, content - 15, { justify: true })
    y += 1.2
  })
  y += 5

  pdf.splitTextToSize(a.liabilityHeading, 82).forEach((text) => {
    write(text, width / 2, y, { bold: true, size: 9.5, align: 'center' })
    y += lineHeight
  })
  y += 4
  block(emphasis(a.liability), MARGIN, content, { justify: true })
  y += 6

  const witness = `IN WITNESS WHEREOF, the parties have here unto sign this Agreement in ${a.signingLocation}, this `
  line([{ t: witness }, { blank: a.day, w: 'fill' }])
  y += 7
  line([{ t: 'day of ' }, { blank: a.month, w: 34 }, { t: ' 20' }, { blank: a.year, w: 8 }, { t: '.' }])
  y += 22

  // Signatures: renter on the left, owner on the right, community tax certificate lines under each.
  const sign = (x, name, role) => {
    pdf.setDrawColor(...INK).setLineWidth(0.3).line(x, y, x + 70, y)
    if (name) write(name, x + 35, y - 1.5, { color: FILLED, align: 'center' })
    write(role, x + 35, y + 5, { bold: true, size: 9.5, align: 'center' })
    ;['CTC No.', 'Issued on.', 'Issued at'].forEach((label, row) => {
      const at = y + 14 + row * 6
      write(label, x + 2, at, { bold: true, size: 8.5 })
      pdf.setLineWidth(0.25).line(x + 18, at + 0.8, x + 68, at + 0.8)
    })
  }
  sign(MARGIN + 6, a.name, '(LESSEE/RENTER)')
  sign(right - 76, '', '(LESSOR/ OWNER)')
  y += 38
  write('SIGNED IN THE PRESENCE OF:', width / 2, y, { bold: true, size: 9.5, align: 'center' })
  y += 14
  ;[[MARGIN + 6, '1.)'], [right - 76, '2.)']].forEach(([x, label]) => {
    write(label, x, y, { bold: true, size: 9.5 })
    pdf.setLineWidth(0.3).line(x + 6, y + 0.8, x + 70, y + 0.8)
  })

  if (mode === 'print') pdf.autoPrint()
  if (mode === 'view' || mode === 'print') {
    const url = pdf.output('bloburl')
    if (tab) tab.location.href = url
    else if (!window.open(url, '_blank')) throw new Error('Your browser blocked the new tab. Allow pop-ups for this site and try again.')
    return
  }
  pdf.save(a.fileName('pdf'))
}

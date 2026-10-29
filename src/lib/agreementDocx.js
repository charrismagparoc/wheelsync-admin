import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TabStopType, TextRun, UnderlineType, VerticalAlign, WidthType } from 'docx'
import { downloadBlob } from './download'
import { buildAgreement, emphasis } from './agreementContent'

// The rental agreement as an editable Word file, laid out like Pardz Car Rental's paper form (long bond, 8.5 x 13 in).
const FONT = 'Calibri'
const FILLED = '141414' // values printed on the blanks: black, like the rest of the form
const size = (pt) => pt * 2 // docx measures font size in half-points
const NBSP = ' '

const run = (value, options = {}) => new TextRun({
  text: String(value ?? ''), font: FONT, size: size(options.pt || 10.5), bold: options.bold, color: options.color,
  underline: options.underline ? { type: UnderlineType.SINGLE, color: '000000' } : undefined,
})
// A blank to fill in: the value (if known) centred on an underline at least `chars` characters long.
function blank(value, chars, pt) {
  const text = String(value || '').replace(/ /g, NBSP) // a value never wraps onto two lines
  const room = Math.max(2, chars - text.length)
  const left = NBSP.repeat(Math.floor(room / 2))
  return run(`${left}${text}${NBSP.repeat(room - left.length)}`, { underline: true, color: FILLED, pt })
}
const para = (children, options = {}) => new Paragraph({
  children,
  alignment: options.align,
  spacing: { before: options.before ?? 0, after: options.after ?? 120, line: options.line ?? 276 },
  indent: options.indent,
  tabStops: options.tabStops,
})

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: none, bottom: none, left: none, right: none }

// Vehicle details: three rows of "Label: blank" in four columns, like the paper form.
function vehicleGrid(rows) {
  const widths = [25, 20, 32, 23]
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells) => new TableRow({
      children: cells.map((cell, index) => new TableCell({
        width: { size: widths[index], type: WidthType.PERCENTAGE },
        borders: noBorders,
        margins: { top: 60, bottom: 60, left: 0, right: 80 },
        children: [para(cell ? [run(`${cell[0]} `, { pt: 9 }), ...(cell.length > 1 ? [blank(cell[1], cell[2], 9)] : [])] : [], { after: 0 })],
      })),
    })),
  })
}

function signatureBlock(name, role) {
  return [
    para([blank(name, 40)], { align: AlignmentType.CENTER, after: 40 }),
    para([run(role, { bold: true, pt: 10 })], { align: AlignmentType.CENTER, after: 200 }),
    ...['CTC No.', 'Issued on.', 'Issued at'].map((label) => para([run(`${label} `, { bold: true, pt: 9 }), blank('', 30)], { after: 60 })),
  ]
}

export async function downloadAgreementDocx(pack) {
  const a = buildAgreement(pack)
  const twoColumns = (left, rightSide) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [left, rightSide].map((children) => new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders, verticalAlign: VerticalAlign.BOTTOM, children })) })],
  })

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 18720 }, margin: { top: 850, bottom: 700, left: 1080, right: 1080 } } },
      children: [
        para([run(a.title, { bold: true, pt: 16 })], { align: AlignmentType.CENTER, after: 300 }),
        para([run(a.preamble, { bold: true, pt: 10 })], { after: 200 }),
        para([
          run('This AGREEMENT is entered into by and between '), blank(a.name, 38), run(' a resident of '),
          blank(a.address, 40), run(" and holder of Driver's license no. "), blank(a.license, 24),
        ], { line: 360, after: 120 }),
        para([run('Here under called the '), run('RENTER AND PARDZ CAR RENTAL', { bold: true }), run(', represented by '), blank('', 40), run('.')], { after: 200 }),
        para([run(a.witnesseth, { bold: true })], { align: AlignmentType.CENTER, after: 160 }),
        para([run(a.intro)], { after: 120 }),
        vehicleGrid([
          [['Make/Model:', a.vehicle, 14], ['Plate No.', a.plate, 10], ['Motor No:', '', 16], ['Chassis No:', '', 12]],
          [['FUEL: F( ) ¾( ) ½( ) ¼( ) E( )'], ['Rental Rate:', '', 10], ['Date & Time release:', a.release, 18], ['Cell. no.:', a.phone, 13]],
          [null, null, ['Date & Time End:', a.end, 18], ['Signature:', '', 13]],
        ]),
        para([run('The Renter agrees:')], { before: 240, after: 120 }),
        ...a.renterTerms.map((term, index) => para(
          [run(`${index + 1}.)\t`), ...emphasis(term).map(([text, bold]) => run(text, { bold }))],
          { align: AlignmentType.JUSTIFIED, after: 60, indent: { left: 900, hanging: 450 }, tabStops: [{ type: TabStopType.LEFT, position: 900 }] },
        )),
        para([run(a.liabilityHeading, { bold: true, pt: 10 })], { align: AlignmentType.CENTER, before: 280, after: 160, indent: { left: 2600, right: 2600 } }),
        para(emphasis(a.liability).map(([text, bold]) => run(text, { bold })), { align: AlignmentType.JUSTIFIED, after: 240 }),
        para([
          run(`IN WITNESS WHEREOF, the parties have here unto sign this Agreement in ${a.signingLocation}, this `), blank(a.day, 8),
          run(' day of '), blank(a.month, 16), run(' 20'), blank(a.year, 4), run('.'),
        ], { line: 360, after: 300 }),
        twoColumns(signatureBlock(a.name, '(LESSEE/RENTER)'), signatureBlock('', '(LESSOR/ OWNER)')),
        para([run('SIGNED IN THE PRESENCE OF:', { bold: true, pt: 10 })], { align: AlignmentType.CENTER, before: 120, after: 360 }),
        twoColumns([para([run('1.) ', { bold: true, pt: 10 }), blank('', 36)])], [para([run('2.) ', { bold: true, pt: 10 }), blank('', 36)])]),
        para([run('', { pt: 1 })], { after: 0, line: 240 }), // Word needs a paragraph after a table; keep it tiny so it fits on the page
      ],
    }],
  })
  downloadBlob(await Packer.toBlob(doc), a.fileName('docx'))
}

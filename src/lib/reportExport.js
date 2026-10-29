import { AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { downloadBlob } from './download'

// Branded rental report (Pardz header, contacts, period, summary, records table) as Word or PDF.
// Both use the same columns and colours so the two files look alike.
const NAVY = '103766'
const BLUE = '1765A8'
const MUTED = '61748B'
const HEADERS = ['#', 'Customer', 'Vehicle / plate', 'Rental dates', 'Service', 'Status', 'Late']

const serviceLabel = (value) => String(value || 'self_drive').replaceAll('_', ' ')

function tableRows(rows) {
  return rows.map((row, index) => [
    String(index + 1),
    row.profiles?.full_name || 'Unknown customer',
    `${row.vehicles?.make || ''} ${row.vehicles?.model || ''}`.trim() + (row.vehicles?.plate_number ? `\n${row.vehicles.plate_number}` : ''),
    `${row.start_date} ${row.pickup_time?.slice(0, 5) || ''}\nto ${row.end_date} ${row.return_time?.slice(0, 5) || ''}`,
    serviceLabel(row.service_type),
    row.status,
    row.late_return ? 'Yes' : 'No',
  ])
}

function summary(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length
  return [['Bookings', rows.length], ['Completed', count('completed')], ['Ongoing', count('ongoing')], ['Late returns', rows.filter((row) => row.late_return).length]]
}

const fileName = (extension) => `pardz-rental-report-${new Date().toISOString().slice(0, 10)}.${extension}`

// ---------------------------------------------------------------- PDF
export function exportReportPdf(rows, { company, facebook, period }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const rgb = (hex) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]

  pdf.setFillColor(...rgb(NAVY)).rect(0, 0, width, 26, 'F')
  pdf.setTextColor(255).setFont('helvetica', 'bold').setFontSize(18).text(company.name.toUpperCase(), 14, 13)
  pdf.setFont('helvetica', 'normal').setFontSize(8).text('YOU DRIVE, WE CARE', 14, 19)
  pdf.setFontSize(8).text('RENTAL RECORDS · ADMIN REPORT', width - 14, 13, { align: 'right' })

  pdf.setTextColor(...rgb(MUTED)).setFontSize(8)
  pdf.text(`${company.phone}   ·   ${company.email}   ·   ${company.address}   ·   Facebook: ${facebook || company.name}`, 14, 33, { maxWidth: width - 28 })
  pdf.setTextColor(21, 44, 74).setFont('helvetica', 'bold').setFontSize(15).text('Rental Transaction Report', 14, 44)
  pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...rgb(MUTED))
  pdf.text(`Reporting period: ${period}   |   Generated ${new Date().toLocaleString()}`, 14, 50)

  // summary strip
  pdf.setFillColor(242, 246, 250).rect(14, 55, width - 28, 14, 'F')
  pdf.setFillColor(...rgb(BLUE)).rect(14, 55, 1.2, 14, 'F')
  summary(rows).forEach(([label, value], index) => {
    const x = 19 + index * 45
    pdf.setFontSize(7).setTextColor(...rgb(MUTED)).text(label.toUpperCase(), x, 60)
    pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(20, 43, 72).text(String(value), x, 66)
    pdf.setFont('helvetica', 'normal')
  })

  autoTable(pdf, {
    startY: 74,
    head: [HEADERS],
    body: rows.length ? tableRows(rows) : [['', 'No records found for this period.', '', '', '', '', '']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: [23, 36, 58], lineColor: [223, 230, 238], lineWidth: 0.1 },
    headStyles: { fillColor: rgb(NAVY), textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 251] },
    columnStyles: { 0: { cellWidth: 8 }, 4: { cellWidth: 24 }, 5: { cellWidth: 20 }, 6: { cellWidth: 12 } },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: () => {
      const height = pdf.internal.pageSize.getHeight()
      pdf.setFontSize(7).setTextColor(...rgb(MUTED))
      pdf.text(`${company.name} · ${company.address} · Prepared in WheelSync`, 14, height - 8)
      pdf.text(`Page ${pdf.getCurrentPageInfo().pageNumber}`, width - 14, height - 8, { align: 'right' })
    },
  })
  pdf.save(fileName('pdf'))
}

// ---------------------------------------------------------------- Word
const run = (text, options = {}) => new TextRun({ text: String(text ?? ''), font: 'Arial', size: (options.pt || 9) * 2, bold: options.bold, color: options.color, allCaps: options.caps })
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'DFE6EE' }

function cell(text, { header = false, shade } = {}) {
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' } : shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
    borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: String(text).split('\n').map((line, index) => new Paragraph({
      children: [run(line, { bold: header, color: header ? 'FFFFFF' : index > 0 ? MUTED : '17243A', pt: 8.5 })],
    })),
  })
}

export async function exportReportDocx(rows, { company, facebook, period }) {
  const body = rows.length ? tableRows(rows) : [['', 'No records found for this period.', '', '', '', '', '']]
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: [new TableCell({
            shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({ children: [run(company.name, { pt: 18, bold: true, color: 'FFFFFF', caps: true })] }),
              new Paragraph({ children: [run('You drive, we care', { pt: 8, color: 'DCE6F5', caps: true })] }),
            ],
          })] })],
        }),
        new Paragraph({ spacing: { before: 120 }, children: [run(`${company.phone}   ·   ${company.email}   ·   ${company.address}   ·   Facebook: ${facebook || company.name}`, { pt: 8, color: MUTED })] }),
        new Paragraph({ spacing: { before: 200 }, children: [run('Rental Transaction Report', { pt: 15, bold: true, color: '152C4A' })] }),
        new Paragraph({ children: [run(`Reporting period: ${period}   |   Generated ${new Date().toLocaleString()}`, { color: MUTED })] }),
        new Paragraph({
          spacing: { before: 160, after: 160 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 8 } },
          shading: { type: ShadingType.CLEAR, fill: 'F2F6FA', color: 'auto' },
          children: summary(rows).flatMap(([label, value], index) => [
            run(`${index ? '        ' : ''}${label}: `, { color: MUTED, pt: 8.5 }), run(value, { bold: true, pt: 10 }),
          ]),
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: HEADERS.map((header) => cell(header, { header: true })) }),
            ...body.map((values, index) => new TableRow({ cantSplit: true, children: values.map((value) => cell(value, { shade: index % 2 ? 'F7F9FB' : undefined })) })),
          ],
        }),
        new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.LEFT, children: [run(`${company.name} · ${company.address} · Prepared in WheelSync on ${new Date().toLocaleDateString()}`, { pt: 7.5, color: '718096' })] }),
      ],
    }],
  })
  downloadBlob(await Packer.toBlob(doc), fileName('docx'))
}

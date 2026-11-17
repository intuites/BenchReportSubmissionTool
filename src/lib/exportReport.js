// Team report exports: PDF and Excel (.xlsx) only, no CSV.
// Loaded on demand from the Reports page, so the app itself stays light.
import { hex } from './color'

export const COLUMNS = [
  ['Recruiter', (r) => r.recruiter_name, 26],
  ['Email', (r) => r.recruiter_email, 30],
  ['Candidates', (r) => r.candidates, 12],
  ['Idle', (r) => r.idle_candidates, 8],
  ['Submissions', (r) => r.submissions, 13],
  ['Interviews', (r) => r.interviews, 12],
  ['Hit rate', (r) => pct(r.interviews, r.submissions), 10],
  ['Selected', (r) => r.selected, 10],
  ['Rejected', (r) => r.rejected, 10],
  ['Offer rate', (r) => pct(r.selected, r.interviews), 11],
]
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const PCT = new Set(['Hit rate', 'Offer rate'])
const fileName = (report, ext) => `bench-tracker-team-report_${report.from}_to_${report.to}.${ext}`

// The spreadsheet as rows of cells: written to the .xlsx file and drawn in the preview
export function sheetData(report) {
  const head = COLUMNS.map(([label]) => ({ value: label, fontWeight: 'bold', backgroundColor: '#EBEBE8' }))
  const body = report.rows.map((r) => COLUMNS.map(([label, get]) => (PCT.has(label) ? { value: get(r) / 100, format: '0%' } : { value: get(r) })))
  const total = COLUMNS.map(([label, get], i) => {
    if (i === 0) return { value: 'Team total', fontWeight: 'bold' }
    if (i === 1) return null
    return PCT.has(label) ? { value: get(report.totals) / 100, format: '0%', fontWeight: 'bold' } : { value: get(report.totals), fontWeight: 'bold' }
  })
  const title = [[{ value: `Bench Tracker team report: ${report.label}`, fontWeight: 'bold', fontSize: 14 }], [`Generated ${report.generated}`], []]
  return [...title, head, ...body, total]
}

export async function exportExcel(report) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  await writeExcelFile(sheetData(report), { columns: COLUMNS.map(([, , width]) => ({ width })), sheet: 'Team report' }).toFile(fileName(report, 'xlsx'))
}

// Builds the PDF document; the preview shows it and Download saves the very same file
export async function pdfDoc(report) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const accent = hex(report.accent)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(17, 17, 16)
  doc.text('Bench Tracker team report', 40, 50)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(102, 102, 98)
  doc.text(`${report.label}  ·  Generated ${report.generated}`, 40, 70)
  const t = report.totals
  doc.setTextColor(17, 17, 16)
  doc.text(`Submissions ${t.submissions}   Interviews ${t.interviews} (${pct(t.interviews, t.submissions)}% hit rate)   Selected ${t.selected}   Idle candidates ${t.idle_candidates}`, 40, 92)
  autoTable(doc, {
    startY: 110,
    head: [COLUMNS.map(([label]) => label)],
    body: report.rows.map((r) => COLUMNS.map(([label, get]) => (PCT.has(label) ? `${get(r)}%` : String(get(r) ?? '')))),
    foot: [COLUMNS.map(([label, get], i) => ({ content: i === 0 ? 'Team total' : i === 1 ? '' : PCT.has(label) ? `${get(t)}%` : String(get(t)), styles: { halign: i < 2 ? 'left' : 'right' } }))],
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6, textColor: [17, 17, 16], lineColor: [226, 226, 222], lineWidth: 0.5 },
    headStyles: { fillColor: accent, textColor: report.on === '#111111' ? [17, 17, 17] : [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [235, 235, 232], textColor: [17, 17, 16], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 247, 245] },
    columnStyles: Object.fromEntries(COLUMNS.map((_, i) => [i, { halign: i < 2 ? 'left' : 'right' }])),
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(9); doc.setTextColor(150, 150, 145)
      doc.text(`Page ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 80, h - 20)
    },
  })
  return doc
}
export const savePdf = (doc, report) => doc.save(fileName(report, 'pdf'))
export async function exportPdf(report) { savePdf(await pdfDoc(report), report) }

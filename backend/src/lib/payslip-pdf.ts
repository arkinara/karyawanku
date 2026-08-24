/**
 * KaryawanKu — generator PDF slip gaji (ticket #31).
 *
 * Merender satu slip gaji per payroll_item ke buffer PDF menggunakan pdfkit.
 * Layout: header (nama bisnis + placeholder logo) + info karyawan + periode,
 * bagian pendapatan (hijau), bagian potongan (merah), take-home (besar),
 * lalu footer catatan. Seluruh label berbahasa Indonesia, mata uang `Rp 1.234.567`.
 */

import PDFDocument from 'pdfkit'
import type { Business, Employee, PayrollItem } from '../db/schema.js'

export interface PayslipPdfInput {
  payrollItem: PayrollItem
  employee: Pick<Employee, 'nama_lengkap' | 'jenis_kontrak' | 'tanggal_masuk'> | null
  business: Pick<Business, 'nama_bisnis' | 'alamat'> | null
  periode: string
}

const DARK = '#111827'

export function formatRupiah(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `Rp ${Math.round(safe).toLocaleString('id-ID')}`
}

function capitalizePeriod(periode: string): string {
  const [year, month] = periode.split('-')
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]
  const monthIdx = month ? Number(month) - 1 : -1
  const monthName = monthIdx >= 0 && monthIdx < 12 ? monthNames[monthIdx] : periode
  return `${monthName} ${year ?? ''}`.trim()
}

/**
 * Menghasilkan buffer PDF slip gaji. Mengembalikan Buffer biner PDF.
 */
export function generatePayslipPDF(input: PayslipPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: false })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const item = input.payrollItem
    const employee = input.employee
    const business = input.business

        const green = '#1b7f6a'
    const red = '#c0392b'
    const gray = '#6b7280'

    // --- Header ---
    doc
      .rect(doc.page.margins.left, doc.y, doc.page.width - 96, 64)
      .fill('#0f3b33')
      .fillColor('#ffffff')

    const headerY = doc.y
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(business?.nama_bisnis ?? 'KaryawanKu', doc.page.margins.left + 18, headerY + 12, { width: 300 })
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#c7e8df')
      .text('Logo', doc.page.width - 48 - 34, headerY + 18, { width: 34, align: 'center', lineBreak: false })
      .fillColor('#ffffff')
      .moveDown()

    doc.fontSize(18).font('Helvetica-Bold').fillColor(DARK).text('Slip Gaji', { align: 'center' })
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor(gray)
      .text(`Periode ${capitalizePeriod(input.periode)}`, { align: 'center' })
      .moveDown(1.2)

    // --- Info karyawan ---
    doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK).text('Data Karyawan')
    doc.moveDown(0.2)
    doc.font('Helvetica').fillColor(DARK).fontSize(10.5)
    const infoTop = doc.y
    doc.text(`Nama: ${employee?.nama_lengkap ?? '-'}`, doc.page.margins.left, infoTop)
    doc.text(`Jenis Kontrak: ${employee?.jenis_kontrak ?? '-'}`, doc.page.margins.left, infoTop + 15)
    doc.text(
      `Tanggal Masuk: ${employee?.tanggal_masuk ?? '-'}`,
      doc.page.margins.left + 260,
      infoTop,
    )
    doc.text(`Alamat Bisnis: ${business?.alamat ?? '-'}`, doc.page.margins.left + 260, infoTop + 15)
    doc.moveDown(1.4)

    // --- Bagian Pendapatan (hijau) ---
    drawSectionHeader(doc, 'Pendapatan', green)
    const gross = item.gaji_pokok + item.total_tunjangan
    drawLine(doc, 'Gaji Pokok', item.gaji_pokok, green)
    drawLine(doc, 'Total Tunjangan', item.total_tunjangan, green)
    drawTotal(doc, 'Total Pendapatan', gross, green)
    doc.moveDown(0.6)

    // --- Bagian Potongan (merah) ---
    drawSectionHeader(doc, 'Potongan', red)
    drawLine(doc, 'BPJS Kesehatan (Karyawan)', item.total_bpjs_kesehatan, red)
    drawLine(doc, 'BPJS Ketenagakerjaan (Karyawan)', item.total_bpjs_tk, red)
    drawLine(doc, 'PPh 21', item.pph21, red)
    const totalPotongan = item.total_bpjs_kesehatan + item.total_bpjs_tk + item.pph21
    drawTotal(doc, 'Total Potongan', totalPotongan, red)

    if (item.koreksi !== 0) {
      doc.moveDown(0.6)
      drawSectionHeader(doc, 'Koreksi', item.koreksi > 0 ? green : red)
      drawLine(
        doc,
        item.catatan_koreksi ? `Koreksi — ${item.catatan_koreksi}` : 'Koreksi',
        item.koreksi,
        item.koreksi > 0 ? green : red,
      )
    }
    doc.moveDown(1)

    // --- Take-home (besar) ---
    doc.roundedRect(doc.page.margins.left, doc.y, doc.page.width - 96, 52, 8).fill('#0f3b33')
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#ffffff')
      .text('GAJI BERSIH (TAKE-HOME PAY)', doc.page.margins.left + 18, doc.y + 8)
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(formatRupiah(item.take_home), doc.page.margins.left + 18, doc.y - 20, { align: 'right', width: doc.page.width - 96 - 36 })
    doc.moveDown(3)

    // --- Footer ---
    const footerY = doc.page.height - doc.page.margins.bottom - 28
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(gray)
      .text(
        'Slip gaji ini dihasilkan otomatis oleh sistem. Hubungi Owner untuk koreksi.',
        doc.page.margins.left,
        footerY,
        { align: 'center' },
      )

    doc.end()
  })
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, color: string): void {
  doc
    .moveDown(0.4)
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(color)
    .text(title)
    .moveDown(0.2)
}

function drawLine(doc: PDFKit.PDFDocument, label: string, value: number, color: string): void {
  const y = doc.y
  doc
    .fontSize(10.5)
    .font('Helvetica')
    .fillColor('#374151')
    .text(label, doc.page.margins.left, y)
  doc
    .font('Helvetica')
    .fillColor(color)
    .text(formatRupiah(value), doc.page.margins.left, y, { align: 'right', width: doc.page.width - 96 })
  doc.moveDown(0.1)
}

function drawTotal(doc: PDFKit.PDFDocument, label: string, value: number, color: string): void {
  const y = doc.y
  doc.moveDown(0.2)
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(DARK)
    .text(label, doc.page.margins.left, y)
  doc
    .font('Helvetica-Bold')
    .fillColor(color)
    .text(formatRupiah(value), doc.page.margins.left, y, { align: 'right', width: doc.page.width - 96 })
  doc.moveDown(0.2)
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import PayslipPage from '@/app/payslips/page'
import type { BePayslipDetail, BePayslipRow } from '@/lib/payslips-adapter'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// BE-shaped payslip rows. The list rows carry the take-home total; the
// per-component breakdown is fetched on demand from GET /api/payslips/:id.
const payslipRows: BePayslipRow[] = [
  {
    id: 'ps-1',
    pdf_url: null,
    created_at: '2026-08-05T08:00:00Z',
    periode: '2026-07',
    status: 'disetujui',
    payroll_item_id: 'pi-1',
    take_home: 2400000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'ps-2',
    pdf_url: null,
    created_at: '2026-07-05T08:00:00Z',
    periode: '2026-06',
    status: 'disetujui',
    payroll_item_id: 'pi-2',
    take_home: 2300000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'ps-3',
    pdf_url: null,
    created_at: '2026-06-05T08:00:00Z',
    periode: '2026-05',
    status: 'disetujui',
    payroll_item_id: 'pi-3',
    take_home: 2300000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'ps-4',
    pdf_url: null,
    created_at: '2026-05-05T08:00:00Z',
    periode: '2026-04',
    status: 'disetujui',
    payroll_item_id: 'pi-4',
    take_home: 2400000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'ps-5',
    pdf_url: null,
    created_at: '2026-04-05T08:00:00Z',
    periode: '2026-03',
    status: 'disetujui',
    payroll_item_id: 'pi-5',
    take_home: 2300000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'ps-6',
    pdf_url: null,
    created_at: '2026-03-05T08:00:00Z',
    periode: '2026-02',
    status: 'disetujui',
    payroll_item_id: 'pi-6',
    take_home: 2400000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'ps-7',
    pdf_url: null,
    created_at: '2026-02-05T08:00:00Z',
    periode: '2026-01',
    status: 'disetujui',
    payroll_item_id: 'pi-7',
    take_home: 2300000,
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
]

// Full breakdown returned by GET /api/payslips/:id (ticket #42).
const fullDetail: BePayslipDetail = {
  id: 'ps-1',
  payroll_item_id: 'pi-1',
  employee: { id: '2', nama: 'Siti Nurhaliza', jabatan: 'Barista' },
  periode: '2026-07',
  breakdown: {
    earnings: [
      { nama_komponen: 'Gaji Pokok', nominal: 2500000 },
      { nama_komponen: 'Tunjangan Makan', nominal: 350000 },
      { nama_komponen: 'Tunjangan Transport', nominal: 400000 },
    ],
    deductions: [
      { nama_komponen: 'BPJS Kesehatan', nominal: 25000 },
      { nama_komponen: 'BPJS Ketenagakerjaan', nominal: 50000 },
      { nama_komponen: 'PPh 21', nominal: 175000 },
    ],
    totals: { total_earnings: 3250000, total_deductions: 250000, take_home: 2400000 },
  },
  totals: { total_earnings: 3250000, total_deductions: 250000, take_home: 2400000 },
  pdf_url: '/api/payslips/ps-1/download',
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/download')) {
        return new Response('PDF_BINARY', {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="slip.pdf"',
          },
        })
      }
      if (url.endsWith('/api/payslips')) {
        return json({ payslips: payslipRows })
      }
      if (url.includes('/api/payslips/')) {
        const id = url.split('/').pop()
        if (id === 'ps-1') return json(fullDetail)
        // Rows without a breakdown exercise the graceful fallback.
        const row = payslipRows.find((r) => r.id === id)
        return json({
          id,
          payroll_item_id: row?.payroll_item_id ?? null,
          employee: { id: '2', nama: 'Siti Nurhaliza', jabatan: 'Barista' },
          periode: row?.periode ?? '2026-07',
          breakdown: { earnings: [], deductions: [], totals: { total_earnings: 0, total_deductions: 0, take_home: row?.take_home ?? 0 } },
          totals: { total_earnings: 0, total_deductions: 0, take_home: row?.take_home ?? 0 },
          pdf_url: `/api/payslips/${id}/download`,
        })
      }
      return json({})
    }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('kk-token', 'test-token')
  window.localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'employee', employee_id: '2' }),
  )
})

function renderPage() {
  stubFetch()
  return render(<PayslipPage />)
}

describe('Payslip Page', () => {
  it('merender daftar slip gaji terurut dari terbaru ke terlama', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('period-2026-07')).toBeInTheDocument()
    })

    const order = ['2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']
    for (let i = 0; i < order.length - 1; i++) {
      const a = screen.getByTestId(`period-${order[i]}`)
      const b = screen.getByTestId(`period-${order[i + 1]}`)
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    expect(screen.getByText('Juli 2026')).toBeInTheDocument()
    expect(screen.getByText('Januari 2026')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^period-/)).toHaveLength(7)
  })

  it('klik Lihat memuat breakdown dari GET /api/payslips/:id dan merender per baris', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lihat' }).length).toBeGreaterThan(0))

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Slip Gaji · Juli 2026')).toBeInTheDocument()

    // Each earnings line.
    await within(dialog).findByText('Tunjangan Makan')
    expect(within(dialog).getByText('Gaji Pokok')).toBeInTheDocument()
    expect(within(dialog).getByText('Tunjangan Transport')).toBeInTheDocument()
    // Each deductions line.
    expect(within(dialog).getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(within(dialog).getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(within(dialog).getByText('PPh 21')).toBeInTheDocument()
    // Line nominal values (formatted IDR, taken verbatim from the BE).
    expect(within(dialog).getByText('Rp 2.500.000')).toBeInTheDocument()
    expect(within(dialog).getByText('Rp 350.000')).toBeInTheDocument()
    expect(within(dialog).getByText('Rp 175.000')).toBeInTheDocument()
    // Section totals.
    expect(within(dialog).getAllByText('Rp 3.250.000').length).toBeGreaterThanOrEqual(1)
    expect(within(dialog).getAllByText('Rp 250.000').length).toBeGreaterThanOrEqual(1)
  })

  it('ringkasan menampilkan total pendapatan, potongan, dan take-home dari breakdown', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lihat' }).length).toBeGreaterThan(0))

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])

    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByTestId('take-home-summary')
    expect(within(dialog).getByText('Total Pendapatan')).toBeInTheDocument()
    expect(within(dialog).getByText('Total Potongan')).toBeInTheDocument()
    expect(within(dialog).getByTestId('take-home-summary')).toHaveTextContent('Rp 2.400.000')
  })

  it('breakdown kosong → fallback "Rincian tidak tersedia" tanpa crash', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lihat' }).length).toBeGreaterThan(0))

    // Second row (ps-2) has an empty breakdown.
    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[1])

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(within(dialog).getAllByText(/Rincian tidak tersedia/).length).toBeGreaterThan(0)
    })
    expect(within(dialog).getByText('Rp 2.300.000')).toBeInTheDocument()
  })

  it('tombol unduh per baris memicu download file dummy', async () => {
    let downloaded: HTMLAnchorElement | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this
      })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-payslip'),
      revokeObjectURL: vi.fn(),
    })

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unduh slip Juli 2026' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Unduh slip Juli 2026' }))

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    })
    expect(downloaded).not.toBeNull()
    expect(downloaded!.download).toBe('slip-gaji-siti-nurhaliza-2026-07.pdf')
    expect(downloaded!.href).toBeTruthy()

    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })

  it('tombol Unduh PDF di dalam viewer juga memicu download', async () => {
    let downloaded: HTMLAnchorElement | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this
      })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-payslip'),
      revokeObjectURL: vi.fn(),
    })

    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lihat' }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unduh PDF' }))

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    })
    expect(downloaded!.download).toBe('slip-gaji-siti-nurhaliza-2026-07.pdf')

    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })

  it('menampilkan empty state saat tidak ada slip gaji', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ payslips: [] })),
    )
    render(<PayslipPage />)
    await waitFor(() => {
      expect(screen.getByText('Belum ada slip gaji tersedia')).toBeInTheDocument()
    })
    expect(screen.queryByTestId(/^period-/)).not.toBeInTheDocument()
  })

  it('filter tahun menyaring daftar slip gaji', async () => {
    const extendedRows: BePayslipRow[] = [
      ...payslipRows,
      {
        id: 'ps-extra',
        pdf_url: null,
        created_at: '2026-01-05T08:00:00Z',
        periode: '2025-12',
        status: 'disetujui',
        payroll_item_id: 'pi-extra',
        take_home: 2200000,
        employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/payslips') && !url.includes('/download')) {
          return json({ payslips: extendedRows })
        }
        return json({})
      }),
    )
    render(<PayslipPage />)
    await waitFor(() => expect(screen.getByTestId('period-2026-07')).toBeInTheDocument())

    expect(screen.getAllByTestId(/^period-/)).toHaveLength(8)

    fireEvent.click(screen.getByRole('tab', { name: '2026' }))
    expect(screen.getAllByTestId(/^period-/)).toHaveLength(7)
    expect(screen.queryByTestId('period-2025-12')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '2025' }))
    expect(screen.getAllByTestId(/^period-/)).toHaveLength(1)
    expect(screen.getByTestId('period-2025-12')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Semua' }))
    expect(screen.getAllByTestId(/^period-/)).toHaveLength(8)
  })
})
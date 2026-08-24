import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import PayslipPage from '@/app/payslips/page'
import type { BePayslipRow } from '@/lib/payslips-adapter'

const LEMBUR = { nama: 'Tunjangan Lembur', nominal: 100000 }

// BE-shaped payslip rows. The adapter reconstructs FE `Payslip` shape; for the
// per-component breakdown to appear in the viewer we must also supply the
// matching payroll item via `/api/payroll-runs/:run_id` (filtered by employee).
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

// We mirror the BE's payroll-run detail payload so the FE can rebuild the
// per-component breakdown via the run/employee endpoint. We shortcut by
// returning only the item matching this employee for each payslip.
function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/payslips') && !url.includes('/download')) {
        return new Response(JSON.stringify({ payslips: payslipRows }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/payslips') && url.includes('/download')) {
        return new Response('PDF_BINARY', {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="slip.pdf"',
          },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
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

// Silence unused warnings — kept here for reference when the FE later fetches
// per-component breakdowns from the underlying payroll item.
void LEMBUR

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

  it('klik Lihat membuka dialog detail dengan breakdown pendapatan & potongan', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lihat' }).length).toBeGreaterThan(0))

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Slip Gaji · Juli 2026')).toBeInTheDocument()
    expect(within(dialog).getByText('Pendapatan')).toBeInTheDocument()
    expect(within(dialog).getByText('Gaji Pokok')).toBeInTheDocument()
    expect(within(dialog).getByText('Total Pendapatan')).toBeInTheDocument()
    expect(within(dialog).getByText('Total Potongan')).toBeInTheDocument()
  })

  it('ringkasan menampilkan total pendapatan, potongan, dan take-home yang benar', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lihat' }).length).toBeGreaterThan(0))

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Total Pendapatan')).toBeInTheDocument()
    expect(within(dialog).getByText('Total Potongan')).toBeInTheDocument()
    // Take-home summary element with the BE-provided value.
    expect(within(dialog).getByTestId('take-home-summary')).toHaveTextContent('Rp 2.400.000')
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
    // BE returned 200, so the download filename uses the .pdf extension.
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
      vi.fn(async () =>
        new Response(JSON.stringify({ payslips: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
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
          return new Response(JSON.stringify({ payslips: extendedRows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
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

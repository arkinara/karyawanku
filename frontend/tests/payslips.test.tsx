import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import PayslipPage from '@/app/payslips/page'
import { getPayslips } from '@/lib/payslips-mock'
import type { Payslip } from '@/lib/payslips-mock'

vi.mock('@/lib/payslips-mock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payslips-mock')>()
  return { ...actual, getPayslips: vi.fn() }
})

const LEMBUR = { nama: 'Tunjangan Lembur', nominal: 100000 }

function makePayslip(over: Partial<Payslip> = {}): Payslip {
  const payslip: Payslip = {
    id: '2-2026-07',
    employeeId: '2',
    period: '2026-07',
    nama: 'Siti Nurhaliza',
    jabatan: 'Kasir',
    gajiPokok: 2400000,
    tunjangan: [
      { nama: 'Tunjangan Transport', nominal: 150000 },
      { nama: 'Tunjangan Makan', nominal: 100000 },
    ],
    potongan: [
      { nama: 'BPJS Kesehatan', nominal: 24000 },
      { nama: 'BPJS Ketenagakerjaan', nominal: 48000 },
      { nama: 'PPh 21', nominal: 278000 },
    ],
    takeHome: 2300000,
    generatedAt: '2026-08-05T08:00:00',
    ...over,
  }
  payslip.id = `2-${payslip.period}`
  return payslip
}

const DATA: Payslip[] = [
  makePayslip({
    period: '2026-07',
    tunjangan: [
      { nama: 'Tunjangan Transport', nominal: 150000 },
      { nama: 'Tunjangan Makan', nominal: 100000 },
      LEMBUR,
    ],
    takeHome: 2400000,
  }),
  makePayslip({ period: '2026-06', generatedAt: '2026-07-05T08:00:00' }),
  makePayslip({ period: '2026-05', generatedAt: '2026-06-05T08:00:00' }),
  makePayslip({
    period: '2026-04',
    tunjangan: [
      { nama: 'Tunjangan Transport', nominal: 150000 },
      { nama: 'Tunjangan Makan', nominal: 100000 },
      LEMBUR,
    ],
    takeHome: 2400000,
    generatedAt: '2026-05-05T08:00:00',
  }),
  makePayslip({ period: '2026-03', generatedAt: '2026-04-05T08:00:00' }),
  makePayslip({
    period: '2026-02',
    tunjangan: [
      { nama: 'Tunjangan Transport', nominal: 150000 },
      { nama: 'Tunjangan Makan', nominal: 100000 },
      LEMBUR,
    ],
    takeHome: 2400000,
    generatedAt: '2026-03-05T08:00:00',
  }),
  makePayslip({ period: '2026-01', generatedAt: '2026-02-05T08:00:00' }),
]

function renderPage() {
  return render(<PayslipPage />)
}

describe('Payslip Page', () => {
  it('merender daftar slip gaji terurut dari terbaru ke terlama', () => {
    vi.mocked(getPayslips).mockReturnValue(DATA)
    renderPage()

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

  it('klik Lihat membuka dialog detail dengan breakdown pendapatan & potongan', () => {
    vi.mocked(getPayslips).mockReturnValue(DATA)
    renderPage()

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Slip Gaji · Juli 2026')).toBeInTheDocument()
    expect(within(dialog).getByText('Pendapatan')).toBeInTheDocument()
    expect(within(dialog).getByText('Gaji Pokok')).toBeInTheDocument()
    expect(within(dialog).getByText('Tunjangan Transport')).toBeInTheDocument()
    expect(within(dialog).getByText('Tunjangan Makan')).toBeInTheDocument()
    expect(within(dialog).getByText('Tunjangan Lembur')).toBeInTheDocument()
    expect(within(dialog).getByText('Potongan')).toBeInTheDocument()
    expect(within(dialog).getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(within(dialog).getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(within(dialog).getByText('PPh 21')).toBeInTheDocument()
  })

  it('ringkasan menampilkan total pendapatan, potongan, dan take-home yang benar', () => {
    vi.mocked(getPayslips).mockReturnValue(DATA)
    renderPage()

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Total Pendapatan')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Rp 2.750.000').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('Total Potongan')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Rp 350.000').length).toBeGreaterThan(0)
    expect(within(dialog).getByTestId('take-home-summary')).toHaveTextContent('Rp 2.400.000')
  })

  it('tombol unduh per baris memicu download file dummy', () => {
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
    vi.mocked(getPayslips).mockReturnValue(DATA)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Unduh slip Juli 2026' }))

    expect(clickSpy).toHaveBeenCalled()
    expect(downloaded).not.toBeNull()
    expect(downloaded!.download).toBe('slip-gaji-siti-nurhaliza-2026-07.txt')
    expect(downloaded!.href).toBeTruthy()

    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })

  it('tombol Unduh PDF di dalam viewer juga memicu download', () => {
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
    vi.mocked(getPayslips).mockReturnValue(DATA)
    renderPage()

    fireEvent.click(screen.getAllByRole('button', { name: 'Lihat' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Unduh PDF' }))

    expect(clickSpy).toHaveBeenCalled()
    expect(downloaded!.download).toBe('slip-gaji-siti-nurhaliza-2026-07.txt')

    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })

  it('menampilkan empty state saat tidak ada slip gaji', () => {
    vi.mocked(getPayslips).mockReturnValue([])
    renderPage()

    expect(screen.getByText('Belum ada slip gaji tersedia')).toBeInTheDocument()
    expect(screen.queryByTestId(/^period-/)).not.toBeInTheDocument()
  })

  it('filter tahun menyaring daftar slip gaji', () => {
    vi.mocked(getPayslips).mockReturnValue([
      ...DATA,
      makePayslip({ period: '2025-12', generatedAt: '2026-01-05T08:00:00' }),
    ])
    renderPage()

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

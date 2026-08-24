import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import PayrollPage from '@/app/payroll/page'

// The mock-side totals from payroll-mock are:
//   Total gaji_pokok 26.000.000 · Tunjangan 2.500.000 · Potongan 4.200.000 · Take-Home 24.300.000
//   Total Gaji (gaji_pokok + tunjangan) 28.500.000 · Take-Home 24.300.000
//
// We rebuild the same per-employee numbers in BE shape (snake_case fields +
// detail_breakdown) so the adapter reconstructs the same PayrollItem totals
// the page is asserting against.
const payrollItemsPayload: Array<{
  id: string
  payroll_run_id: string
  employee_id: string
  gaji_pokok: number
  total_tunjangan: number
  total_bpjs_kesehatan: number
  total_bpjs_tk: number
  pph21: number
  koreksi: number
  catatan_koreksi: string | null
  take_home: number
  detail_breakdown: {
    tunjangan: Array<{ nama: string; nominal: number }>
    potongan: Array<{ nama: string; nominal: number }>
    penyesuaian: number
    catatan: string
  }
  employee: { id: string; nama_lengkap: string | null }
}> = [
  {
    id: 'pi-1', payroll_run_id: 'pr-1', employee_id: '1',
    gaji_pokok: 2600000, total_tunjangan: 300000, total_bpjs_kesehatan: 26000, total_bpjs_tk: 52000, pph21: 402000,
    koreksi: 0, catatan_koreksi: null, take_home: 2420000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 200000 }, { nama: 'Tunjangan Makan', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 26000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 52000 },
        { nama: 'PPh 21', nominal: 402000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '1', nama_lengkap: 'Budi Santoso' },
  },
  {
    id: 'pi-2', payroll_run_id: 'pr-1', employee_id: '2',
    gaji_pokok: 2400000, total_tunjangan: 250000, total_bpjs_kesehatan: 24000, total_bpjs_tk: 48000, pph21: 278000,
    koreksi: 0, catatan_koreksi: null, take_home: 2300000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 150000 }, { nama: 'Tunjangan Makan', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 24000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 48000 },
        { nama: 'PPh 21', nominal: 278000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '2', nama_lengkap: 'Siti Nurhaliza' },
  },
  {
    id: 'pi-3', payroll_run_id: 'pr-1', employee_id: '3',
    gaji_pokok: 2300000, total_tunjangan: 250000, total_bpjs_kesehatan: 23000, total_bpjs_tk: 46000, pph21: 271000,
    koreksi: 0, catatan_koreksi: null, take_home: 2210000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Makan', nominal: 150000 }, { nama: 'Lembur per Jam', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 23000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 46000 },
        { nama: 'PPh 21', nominal: 271000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '3', nama_lengkap: 'Ahmad Fauzi' },
  },
  {
    id: 'pi-4', payroll_run_id: 'pr-1', employee_id: '4',
    gaji_pokok: 1900000, total_tunjangan: 200000, total_bpjs_kesehatan: 19000, total_bpjs_tk: 38000, pph21: 323000,
    koreksi: 0, catatan_koreksi: null, take_home: 1720000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 200000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 19000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 38000 },
        { nama: 'PPh 21', nominal: 323000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '4', nama_lengkap: 'Dewi Lestari' },
  },
  {
    id: 'pi-5', payroll_run_id: 'pr-1', employee_id: '5',
    gaji_pokok: 2200000, total_tunjangan: 200000, total_bpjs_kesehatan: 22000, total_bpjs_tk: 44000, pph21: 254000,
    koreksi: 0, catatan_koreksi: null, take_home: 2080000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 100000 }, { nama: 'Tunjangan Makan', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 22000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 44000 },
        { nama: 'PPh 21', nominal: 254000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '5', nama_lengkap: 'Rudi Hermawan' },
  },
  {
    id: 'pi-6', payroll_run_id: 'pr-1', employee_id: '6',
    gaji_pokok: 2500000, total_tunjangan: 250000, total_bpjs_kesehatan: 25000, total_bpjs_tk: 50000, pph21: 295000,
    koreksi: 0, catatan_koreksi: null, take_home: 2380000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Jabatan', nominal: 250000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 25000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 50000 },
        { nama: 'PPh 21', nominal: 295000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '6', nama_lengkap: 'Maya Sari' },
  },
  {
    id: 'pi-7', payroll_run_id: 'pr-1', employee_id: '7',
    gaji_pokok: 2100000, total_tunjangan: 200000, total_bpjs_kesehatan: 21000, total_bpjs_tk: 42000, pph21: 247000,
    koreksi: 0, catatan_koreksi: null, take_home: 1990000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Makan', nominal: 100000 }, { nama: 'Lembur per Jam', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 21000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 42000 },
        { nama: 'PPh 21', nominal: 247000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '7', nama_lengkap: 'Fajar Nugraha' },
  },
  {
    id: 'pi-8', payroll_run_id: 'pr-1', employee_id: '8',
    gaji_pokok: 2800000, total_tunjangan: 300000, total_bpjs_kesehatan: 28000, total_bpjs_tk: 56000, pph21: 436000,
    koreksi: 0, catatan_koreksi: null, take_home: 2579000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 200000 }, { nama: 'Tunjangan Jabatan', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 28000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 56000 },
        { nama: 'PPh 21', nominal: 436000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '8', nama_lengkap: 'Lestari Wulandari' },
  },
  {
    id: 'pi-9', payroll_run_id: 'pr-1', employee_id: '9',
    gaji_pokok: 1800000, total_tunjangan: 150000, total_bpjs_kesehatan: 18000, total_bpjs_tk: 36000, pph21: 306000,
    koreksi: 0, catatan_koreksi: null, take_home: 1589000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Makan', nominal: 150000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 18000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 36000 },
        { nama: 'PPh 21', nominal: 306000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '9', nama_lengkap: 'Indra Permadi' },
  },
  {
    id: 'pi-10', payroll_run_id: 'pr-1', employee_id: '10',
    gaji_pokok: 2200000, total_tunjangan: 200000, total_bpjs_kesehatan: 22000, total_bpjs_tk: 44000, pph21: 254000,
    koreksi: 0, catatan_koreksi: null, take_home: 2080000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 100000 }, { nama: 'Lembur per Jam', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 22000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 44000 },
        { nama: 'PPh 21', nominal: 254000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '10', nama_lengkap: 'Ratna Sari' },
  },
  {
    id: 'pi-11', payroll_run_id: 'pr-1', employee_id: '11',
    gaji_pokok: 1700000, total_tunjangan: 100000, total_bpjs_kesehatan: 17000, total_bpjs_tk: 34000, pph21: 189000,
    koreksi: 0, catatan_koreksi: null, take_home: 1560000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 17000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 34000 },
        { nama: 'PPh 21', nominal: 189000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '11', nama_lengkap: 'Hendro Wibowo' },
  },
  {
    id: 'pi-12', payroll_run_id: 'pr-1', employee_id: '12',
    gaji_pokok: 1500000, total_tunjangan: 100000, total_bpjs_kesehatan: 15000, total_bpjs_tk: 30000, pph21: 165000,
    koreksi: 0, catatan_koreksi: null, take_home: 1390000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Makan', nominal: 100000 }],
      potongan: [
        { nama: 'BPJS Kesehatan', nominal: 15000 },
        { nama: 'BPJS Ketenagakerjaan', nominal: 30000 },
        { nama: 'PPh 21', nominal: 165000 },
      ],
      penyesuaian: 0,
      catatan: '',
    },
    employee: { id: '12', nama_lengkap: 'Ani Rahmawati' },
  },
]

const totalGaji = payrollItemsPayload.reduce((acc, i) => acc + i.gaji_pokok + i.total_tunjangan, 0)
const totalPotongan = payrollItemsPayload.reduce(
  (acc, i) => acc + i.total_bpjs_kesehatan + i.total_bpjs_tk + i.pph21,
  0,
)
const totalTakeHome = payrollItemsPayload.reduce((acc, i) => acc + i.take_home, 0)

const runPayload = {
  run: {
    id: 'pr-1',
    business_id: 'b',
    periode: '2026-08',
    status: 'draft' as const,
    total_gaji: totalGaji,
    total_potongan: totalPotongan,
    take_home: totalTakeHome,
    approved_at: null,
    approved_by_user_id: null,
    created_at: '2026-08-19T08:00:00Z',
    updated_at: '2026-08-19T08:00:00Z',
  },
  items: payrollItemsPayload,
}

const listPayload = { runs: [{ id: 'pr-1', business_id: 'b', periode: '2026-08', status: 'draft' }] }

function stubFetch(opts: { approved?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/payroll-runs') && (init?.method ?? 'GET') === 'POST') {
        // Approve endpoint
        if (url.includes('/approve')) {
          return new Response(
            JSON.stringify({ run: { ...runPayload.run, status: 'disetujui' }, items: payrollItemsPayload, payslips_generated: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(JSON.stringify(runPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/payroll-runs') && url.includes('/export.csv')) {
        return new Response('col1;col2\nv1;v2', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        })
      }
      if (url.includes('/api/payroll-runs') && /\/(pr-[^/]+)/.test(url)) {
        return new Response(
          JSON.stringify({
            run: { ...runPayload.run, status: opts.approved ? 'disetujui' : 'draft' },
            items: payrollItemsPayload,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/payroll-runs')) {
        return new Response(JSON.stringify(listPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
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
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
})

function renderPage() {
  stubFetch()
  return render(<PayrollPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr')
  if (!row) throw new Error(`Baris untuk ${name} tidak ditemukan`)
  return row
}

describe('Payroll Run Page', () => {
  it('merender 12 baris breakdown + baris total di footer', async () => {
    const { container } = renderPage()
    await waitFor(() => {
      expect(rowCount(container)).toBe(12)
    })
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Ani Rahmawati')).toBeInTheDocument()

    const foot = container.querySelector('tfoot')
    expect(foot).not.toBeNull()
    expect(foot!.textContent).toContain('Total')
    expect(foot!.textContent).toContain('Rp 26.000.000')
    expect(foot!.textContent).toContain('Rp 2.500.000')
    expect(foot!.textContent).toContain('Rp 4.200.000')
    expect(foot!.textContent).toContain('Rp 24.300.000')
  })

  it('menampilkan ringkasan metric card sesuai spesifikasi', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Total Karyawan')).toBeInTheDocument()
    })
    expect(screen.getByText('Total Gaji')).toBeInTheDocument()
    expect(screen.getByText('Total Potongan')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 28.500.000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rp 24.300.000').length).toBeGreaterThan(0)
  })

  it('kolom mata uang rata kanan dan memakai tabular-nums', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

    const takeHomeHeader = screen.getByRole('columnheader', { name: 'Take-Home' })
    expect(takeHomeHeader).toHaveClass('text-right')

    const gajiPokokCell = within(rowOf('Budi Santoso')).getByText('Rp 2.600.000')
    expect(gajiPokokCell).toHaveClass('tabular-nums')

    const currencyCells = container.querySelectorAll('td.tabular-nums')
    expect(currencyCells.length).toBeGreaterThanOrEqual(4 * 12)
  })

  it('dialog Edit Koreksi memperbarui take-home baris', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Edit Budi Santoso' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit Koreksi')).toBeInTheDocument()
    expect(screen.getByLabelText(/Penyesuaian/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Catatan/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Penyesuaian/), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText(/Catatan/), {
      target: { value: 'lembur 2 jam belum tercatat' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(within(rowOf('Budi Santoso')).getByText('Rp 2.520.000')).toBeInTheDocument()
    })
    expect(rowCount(container)).toBe(12)
  })

  it('ekspansi Detail menampilkan breakdown komponen per karyawan', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Detail Budi Santoso' }))

    await waitFor(() => {
      const expanded = screen.getByText('Pendapatan').closest('tr')
      expect(expanded).not.toBeNull()
      expect(within(expanded!).getByText('Gaji Pokok')).toBeInTheDocument()
      expect(within(expanded!).getByText('Tunjangan Transport')).toBeInTheDocument()
      expect(within(expanded!).getByText('Potongan')).toBeInTheDocument()
      expect(within(expanded!).getByText('BPJS Kesehatan')).toBeInTheDocument()
      expect(within(expanded!).getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
      expect(within(expanded!).getByText('PPh 21')).toBeInTheDocument()
      expect(within(expanded!).getByText('Rp 2.420.000')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Detail Budi Santoso' }))
    await waitFor(() => {
      expect(screen.queryByText('Pendapatan')).not.toBeInTheDocument()
    })
  })

  it('dialog Setujui menampilkan ringkasan total dan peringatan', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Setujui Payroll' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Setujui Payroll?')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent?.replace(/\s+/g, ' ').trim() ===
            '12 karyawan · Take-home total Rp 24.300.000',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Setelah disetujui, payroll tidak bisa diedit lagi'),
    ).toBeInTheDocument()
  })

  it('aksi Setujui mengubah status menjadi Disetujui', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Setujui Payroll' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))

    await waitFor(() => {
      expect(screen.getByText('Disetujui')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Setujui Payroll' })).not.toBeInTheDocument()
    expect(screen.queryByText('Draft — Belum disetujui')).not.toBeInTheDocument()
  })

  it('setelah approve, tombol edit terkunci', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Setujui Payroll' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Budi Santoso' })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'Edit Ani Rahmawati' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Detail Budi Santoso' })).toBeEnabled()
  })

  it('tombol Ekspor CSV nonaktif saat run masih draft', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Ekspor CSV/ })).toBeDisabled()
  })

  it('Ekspor CSV pada run disetujui memicu unduhan dari API dan menampilkan toast', async () => {
    let downloaded: HTMLAnchorElement | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this
      })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-payroll'),
      revokeObjectURL: vi.fn(),
    })

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Setujui Payroll' })).toBeInTheDocument())

    // Approve first — export is only allowed for approved runs.
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await waitFor(() => expect(screen.getByText('Disetujui')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Ekspor CSV/ }))

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    })
    expect(downloaded).not.toBeNull()
    expect(downloaded!.download).toBe('payroll-2026-08.csv')
    expect(downloaded!.href).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent('File CSV berhasil diunduh')

    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })
})

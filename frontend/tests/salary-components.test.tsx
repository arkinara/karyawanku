import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SalaryComponentsPage from '@/app/salary-components/page'

const componentsPayload = {
  components: [
    { id: 'uuid-1', business_id: 'b', nama_komponen: 'Gaji Pokok', tipe: 'earning', mode: 'fixed', nominal: 3500000, formula: null, aktif: true },
    { id: 'uuid-2', business_id: 'b', nama_komponen: 'Tunjangan Transport', tipe: 'earning', mode: 'fixed', nominal: 400000, formula: null, aktif: true },
    { id: 'uuid-3', business_id: 'b', nama_komponen: 'Tunjangan Makan', tipe: 'earning', mode: 'fixed', nominal: 350000, formula: null, aktif: true },
    { id: 'uuid-4', business_id: 'b', nama_komponen: 'Tunjangan Jabatan', tipe: 'earning', mode: 'fixed', nominal: 500000, formula: null, aktif: true },
    { id: 'uuid-5', business_id: 'b', nama_komponen: 'Lembur per Jam', tipe: 'earning', mode: 'formula', nominal: 25000, formula: 'jam_kerja * tarif_lembur', aktif: true },
    { id: 'uuid-6', business_id: 'b', nama_komponen: 'BPJS Kesehatan', tipe: 'deduction', mode: 'formula', nominal: 35000, formula: 'gaji_pokok * 0.01', aktif: true },
    { id: 'uuid-7', business_id: 'b', nama_komponen: 'BPJS Ketenagakerjaan', tipe: 'deduction', mode: 'formula', nominal: 70000, formula: 'gaji_pokok * 0.02', aktif: true },
    { id: 'uuid-8', business_id: 'b', nama_komponen: 'PPh 21', tipe: 'deduction', mode: 'formula', nominal: 75000, formula: '(gaji_pokok * 12 - ptkp) * 0.05 / 12', aktif: false },
  ],
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('kk-token', 'test-token')
  localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/salary-components')) {
        return new Response(JSON.stringify(componentsPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

function renderPage() {
  return render(<SalaryComponentsPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Salary Components Builder', () => {
  it('merender 8 komponen dari BE di tabel', async () => {
    const { container, findByText } = renderPage()
    await findByText('Gaji Pokok')
    expect(rowCount(container)).toBe(8)
    expect(screen.getByText('8 komponen terdaftar')).toBeInTheDocument()
    expect(screen.getByText('Gaji Pokok')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Transport')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Makan')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Jabatan')).toBeInTheDocument()
    expect(screen.getByText('Lembur per Jam')).toBeInTheDocument()
    expect(screen.getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(screen.getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(screen.getByText('PPh 21')).toBeInTheDocument()
  })

  it('filter Pendapatan hanya menampilkan komponen earning', async () => {
    const { container, findByText } = renderPage()
    await findByText('Gaji Pokok')
    fireEvent.click(screen.getByRole('tab', { name: /^Pendapatan/ }))

    expect(rowCount(container)).toBe(5)
    expect(screen.getByText('Gaji Pokok')).toBeInTheDocument()
    expect(screen.getByText('Lembur per Jam')).toBeInTheDocument()
    expect(screen.queryByText('BPJS Kesehatan')).not.toBeInTheDocument()
    expect(screen.queryByText('PPh 21')).not.toBeInTheDocument()
  })

  it('filter Potongan hanya menampilkan komponen deduction', async () => {
    const { container, findByText } = renderPage()
    await findByText('Gaji Pokok')
    fireEvent.click(screen.getByRole('tab', { name: /^Potongan/ }))

    expect(rowCount(container)).toBe(3)
    expect(screen.getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(screen.getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(screen.getByText('PPh 21')).toBeInTheDocument()
    expect(screen.queryByText('Gaji Pokok')).not.toBeInTheDocument()
    expect(screen.queryByText('Tunjangan Makan')).not.toBeInTheDocument()
  })

  it('menampilkan tombol Tambah Komponen', async () => {
    const { findByText } = renderPage()
    await findByText('Gaji Pokok')
    expect(screen.getByRole('button', { name: /Tambah Komponen/ })).toBeInTheDocument()
  })

  it('membuka dialog tambah komponen saat tombol diklik', async () => {
    const { findByText } = renderPage()
    await findByText('Gaji Pokok')
    fireEvent.click(screen.getByRole('button', { name: /Tambah Komponen/ }))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Tambah Komponen/ })).toBeInTheDocument(),
    )
  })

  it('memfilter komponen dengan search box tidak diterapkan (hanya tipe)', async () => {
    // Filter yang tersedia adalah filter tipe (Pendapatan/Potongan) — tanpa search box.
    const { container, findByText } = renderPage()
    await findByText('Gaji Pokok')
    expect(container.querySelector('input[type="search"]')).toBeNull()
  })
})
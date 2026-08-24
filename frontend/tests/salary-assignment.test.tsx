import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EmployeeSalaryPage from '@/app/employees/[id]/salary/page'

let mockId = '1'
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: mockPush, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  notFound: vi.fn(),
}))

const employeeBudi = { id: '1', nama_lengkap: 'Budi Santoso' }
const employeeSiti = { id: '2', nama_lengkap: 'Siti Nurhaliza' }
const employeeAhmad = { id: '3', nama_lengkap: 'Ahmad Fauzi' }

const components = [
  { id: 'c-gaji', nama_komponen: 'Gaji Pokok', tipe: 'earning', mode: 'fixed', nominal: 3500000, formula: null, aktif: true },
  { id: 'c-makan', nama_komponen: 'Tunjangan Makan', tipe: 'earning', mode: 'fixed', nominal: 350000, formula: null, aktif: true },
  { id: 'c-lembur', nama_komponen: 'Lembur per Jam', tipe: 'earning', mode: 'formula', nominal: 25000, formula: 'jam_kerja * tarif_lembur', aktif: true },
  { id: 'c-bpjs', nama_komponen: 'BPJS Kesehatan', tipe: 'deduction', mode: 'formula', nominal: 35000, formula: 'gaji_pokok * 0.01', aktif: true },
]

const assignmentsByEmployee: Record<string, Array<{ id: string; employee_id: string; component_id: string; override_nominal: number | null; status: 'aktif' | 'nonaktif' }>> = {
  '1': [
    { id: 'a-1', employee_id: '1', component_id: 'c-gaji', override_nominal: null, status: 'aktif' },
    { id: 'a-2', employee_id: '1', component_id: 'c-makan', override_nominal: null, status: 'aktif' },
    { id: 'a-3', employee_id: '1', component_id: 'c-lembur', override_nominal: null, status: 'aktif' },
    { id: 'a-4', employee_id: '1', component_id: 'c-bpjs', override_nominal: null, status: 'aktif' },
  ],
  '2': [
    { id: 'a-5', employee_id: '2', component_id: 'c-gaji', override_nominal: null, status: 'aktif' },
    { id: 'a-6', employee_id: '2', component_id: 'c-makan', override_nominal: null, status: 'aktif' },
    { id: 'a-7', employee_id: '2', component_id: 'c-lembur', override_nominal: null, status: 'aktif' },
    { id: 'a-8', employee_id: '2', component_id: 'c-bpjs', override_nominal: null, status: 'aktif' },
  ],
  '3': [
    { id: 'a-9', employee_id: '3', component_id: 'c-gaji', override_nominal: null, status: 'aktif' },
    { id: 'a-10', employee_id: '3', component_id: 'c-makan', override_nominal: null, status: 'aktif' },
    { id: 'a-11', employee_id: '3', component_id: 'c-lembur', override_nominal: null, status: 'aktif' },
    { id: 'a-12', employee_id: '3', component_id: 'c-bpjs', override_nominal: null, status: 'aktif' },
  ],
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('kk-token', 'test-token')
  localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
  mockPush.mockClear()

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/api/employees/1') || url.includes('/api/employees/1?'))
        return new Response(JSON.stringify({ employee: employeeBudi }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      if (url.endsWith('/api/employees/2') || url.includes('/api/employees/2?'))
        return new Response(JSON.stringify({ employee: employeeSiti }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      if (url.endsWith('/api/employees/3') || url.includes('/api/employees/3?'))
        return new Response(JSON.stringify({ employee: employeeAhmad }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      if (url.includes('/api/salary-components'))
        return new Response(JSON.stringify({ components }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      if (url.includes('/salary-assignments')) {
        const id = url.split('/employees/')[1]?.split('/')[0] ?? '1'
        return new Response(JSON.stringify({ assignments: assignmentsByEmployee[id] ?? [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

function renderPage(id: string = '1') {
  mockId = id
  return render(<EmployeeSalaryPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Employee Salary Assignment', () => {
  it('merender tabel assignment untuk Budi Santoso (id=1)', async () => {
    const { container, findByText } = renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Gaji Pokok').length).toBeGreaterThan(0))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Budi Santoso' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Setup gaji untuk Budi Santoso')[0]).toBeInTheDocument()
    expect(rowCount(container)).toBe(4)
    expect(screen.getAllByText('Tunjangan Makan')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Lembur per Jam')[0]).toBeInTheDocument()
    expect(screen.getAllByText('BPJS Kesehatan')[0]).toBeInTheDocument()
  })

  it('merender tabel assignment untuk Siti Nurhaliza (id=2)', async () => {
    const { container, findByText } = renderPage('2')
    await waitFor(() => expect(screen.getAllByText('Siti Nurhaliza').length).toBeGreaterThan(0))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Siti Nurhaliza' }),
    ).toBeInTheDocument()
    expect(rowCount(container)).toBe(4)
  })

  it('merender tabel assignment untuk Ahmad Fauzi (id=3)', async () => {
    const { container, findByText } = renderPage('3')
    await waitFor(() => expect(screen.getAllByText('Ahmad Fauzi').length).toBeGreaterThan(0))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ahmad Fauzi' }),
    ).toBeInTheDocument()
    expect(rowCount(container)).toBe(4)
  })

  it('menampilkan tombol kembali ke profil karyawan', async () => {
    const { findByText } = renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Gaji Pokok').length).toBeGreaterThan(0))
    expect(
      screen.getByRole('button', { name: 'Kembali ke profil karyawan' }),
    ).toBeInTheDocument()
  })

  it('menampilkan tombol tambah komponen', async () => {
    const { findByText } = renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Gaji Pokok').length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: /Tambah Komponen/ })).toBeInTheDocument()
  })

  it('menampilkan kolom Sumber dengan chip Default untuk semua assignment', async () => {
    const { findByText } = renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Gaji Pokok').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Default').length).toBeGreaterThan(0)
  })
})
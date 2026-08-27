import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'
import type { BeLeaveTypeListResponse } from '@/lib/leave-adapter'

type BeUserFixture = {
  id: string
  email: string
  nama: string
  role: 'owner' | 'employee'
  status: 'aktif' | 'nonaktif'
  employee_id: string | null
  created_at: string
}

type BeBusinessFixture = {
  id: string
  nama_bisnis: string
  jenis_usaha: 'fnb' | 'jasa'
  alamat: string
}

type BeSalaryComponentFixture = {
  id: string
  nama_komponen: string
  tipe: 'earning' | 'deduction'
  nominal: number | null
  formula: string | null
  aktif: boolean
  is_default: boolean
}

const initialUsers: BeUserFixture[] = [
  { id: 'u-1', email: 'darmawan@warungkopi.id', nama: 'Darmawan Setiadi', role: 'owner', status: 'aktif', employee_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'u-2', email: 'ani@warungkopi.id', nama: 'Ani Rahmawati', role: 'owner', status: 'aktif', employee_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'u-3', email: 'budi@warungkopi.id', nama: 'Budi Santoso', role: 'employee', status: 'aktif', employee_id: '1', created_at: '2026-01-02T00:00:00Z' },
  { id: 'u-4', email: 'siti@warungkopi.id', nama: 'Siti Nurhaliza', role: 'employee', status: 'aktif', employee_id: '2', created_at: '2026-01-02T00:00:00Z' },
  { id: 'u-5', email: 'maya@warungkopi.id', nama: 'Maya Sari', role: 'employee', status: 'aktif', employee_id: '6', created_at: '2026-01-02T00:00:00Z' },
  { id: 'u-6', email: 'fajar@warungkopi.id', nama: 'Fajar Nugraha', role: 'employee', status: 'nonaktif', employee_id: '7', created_at: '2026-01-03T00:00:00Z' },
]

const leaveTypesPayload: BeLeaveTypeListResponse = {
  leave_types: [
    { id: 'lt-1', nama_jenis_cuti: 'Cuti Tahunan', default_kuota_hari: 12, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-2', nama_jenis_cuti: 'Cuti Sakit', default_kuota_hari: 5, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-3', nama_jenis_cuti: 'Cuti Izin', default_kuota_hari: 3, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-4', nama_jenis_cuti: 'Cuti Menikah', default_kuota_hari: 5, kebijakan_sisa: 'carry-over', carry_over_max_days: 5, aktif: true },
  ],
}

const initialBusiness: BeBusinessFixture = {
  id: 'b',
  nama_bisnis: 'Warung Kopi Nusantara',
  jenis_usaha: 'fnb',
  alamat: 'Jl. Melati No. 12, Jakarta Selatan',
}

const initialDefaultComponents: BeSalaryComponentFixture[] = [
  { id: 'sc-1', nama_komponen: 'Gaji Pokok', tipe: 'earning', nominal: 3000000, formula: null, aktif: true, is_default: true },
  { id: 'sc-2', nama_komponen: 'Tunjangan Transport', tipe: 'earning', nominal: 400000, formula: null, aktif: true, is_default: true },
  { id: 'sc-3', nama_komponen: 'BPJS Kesehatan', tipe: 'deduction', nominal: null, formula: 'gaji_pokok * 0.01', aktif: true, is_default: true },
]

let usersState = [...initialUsers]
let leaveTypesState = [...leaveTypesPayload.leave_types]
let businessState = { ...initialBusiness }
let defaultComponentsState = [...initialDefaultComponents]

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined

      if (url.includes('/api/users') && method === 'POST') {
        const newUser = {
          id: `u-${Date.now()}`,
          email: (body?.email as string) ?? '',
          nama: (body?.nama as string) ?? '',
          role: (body?.role as 'owner' | 'employee') ?? 'employee',
          status: 'aktif' as const,
          employee_id: null,
          created_at: new Date().toISOString(),
        }
        usersState = [...usersState, newUser]
        return json({ user: newUser })
      }
      if (url.includes('/api/users') && method === 'PATCH') {
        const id = url.split('/').pop()
        usersState = usersState.map((u) =>
          u.id === id ? { ...u, ...(body?.role ? { role: body.role as typeof u.role } : {}), ...(body?.status ? { status: body.status as typeof u.status } : {}) } : u,
        )
        return json({ user: usersState.find((u) => u.id === id) })
      }
      if (url.includes('/api/users')) {
        return json({ users: usersState, total: usersState.length, limit: 50, offset: 0 })
      }

      if (url.includes('/api/leave-types') && method === 'POST') {
        const newLt = {
          id: `lt-${Date.now()}`,
          nama_jenis_cuti: (body?.nama_jenis_cuti as string) ?? '',
          default_kuota_hari: (body?.default_kuota_hari as number) ?? 0,
          kebijakan_sisa: (body?.kebijakan_sisa as 'hangus' | 'carry-over') ?? 'hangus',
          carry_over_max_days: (body?.carry_over_max_days as number | null) ?? null,
          aktif: true,
        }
        leaveTypesState = [...leaveTypesState, newLt]
        return json({ leave_type: newLt })
      }
      if (url.includes('/api/leave-types') && method === 'DELETE') {
        const id = url.split('/').pop()
        leaveTypesState = leaveTypesState.filter((lt) => lt.id !== id)
        return json({ ok: true })
      }
      if (url.includes('/api/leave-types')) {
        return json({ leave_types: leaveTypesState })
      }

      // Default salary components (Komponen Gaji tab).
      if (url.includes('/default-salary-components') && method === 'PUT') {
        const ids = (body?.component_ids as string[]) ?? []
        defaultComponentsState = defaultComponentsState.filter((c) => ids.includes(c.id))
        return json({ components: defaultComponentsState })
      }
      if (url.includes('/default-salary-components')) {
        return json({ components: defaultComponentsState })
      }

      // Business profile (Profil Bisnis tab).
      if (url.includes('/api/businesses') && method === 'PATCH') {
        businessState = { ...businessState, ...(body as Partial<BeBusinessFixture>) }
        return json({ business: { id: businessState.id, nama_bisnis: businessState.nama_bisnis, jenis_usaha: businessState.jenis_usaha, alamat: businessState.alamat } })
      }
      if (url.includes('/api/businesses')) {
        return json({ business: { id: businessState.id, nama_bisnis: businessState.nama_bisnis, jenis_usaha: businessState.jenis_usaha, alamat: businessState.alamat } })
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
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
  usersState = [...initialUsers]
  leaveTypesState = [...leaveTypesPayload.leave_types]
  businessState = { ...initialBusiness }
  defaultComponentsState = [...initialDefaultComponents]
  stubFetch()
})

function renderPage() {
  return render(<SettingsPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

const TAB_NAMES = ['Profil Bisnis', 'Jenis Cuti', 'Komponen Gaji', 'Pengguna']

describe('Settings Page', () => {
  it('merender 4 item tab navigasi', async () => {
    renderPage()
    await waitFor(() => {
      for (const name of TAB_NAMES) {
        expect(screen.getByRole('tab', { name })).toBeInTheDocument()
      }
    })
  })

  it('tab navigasi berpindah panel', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tambah Jenis Cuti/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Undang Pengguna/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Komponen Gaji' }))
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Kelola Komponen Gaji/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Profil Bisnis' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeInTheDocument()
    })
  })

  describe('Profil Bisnis', () => {
    it('form terisi dari GET /api/businesses/:id dan simpan memanggil PATCH + toast', async () => {
      renderPage()
      const namaInput = await screen.findByLabelText(/Nama bisnis/)
      expect(namaInput).toHaveValue('Warung Kopi Nusantara')
      expect(screen.getByLabelText(/Jenis usaha/)).toHaveValue('fnb')
      expect(screen.getByLabelText(/Alamat/)).toHaveValue('Jl. Melati No. 12, Jakarta Selatan')

      fireEvent.change(namaInput, { target: { value: 'Kopi Kita' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/tersimpan/))
      expect(namaInput).toHaveValue('Kopi Kita')
      // PATCH hit the BE — the in-memory business state reflects the change.
      expect(businessState.nama_bisnis).toBe('Kopi Kita')
    })

    it('validasi: nama bisnis kosong menahan simpan', async () => {
      renderPage()
      const namaInput = await screen.findByLabelText(/Nama bisnis/)
      fireEvent.change(namaInput, { target: { value: '' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
      expect(screen.getByText('Nama bisnis wajib diisi')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('Jenis Cuti', () => {
    it('merender 4 jenis cuti default', async () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
      await waitFor(() => {
        expect(rowCount(container)).toBe(4)
      })
      expect(screen.getByText('Cuti Tahunan')).toBeInTheDocument()
      expect(screen.getByText('Cuti Sakit')).toBeInTheDocument()
      expect(screen.getByText('Cuti Izin')).toBeInTheDocument()
      expect(screen.getByText('Cuti Menikah')).toBeInTheDocument()
      expect(screen.getByText('Carry-over max 5 hari')).toBeInTheDocument()
      expect(screen.getAllByText('Hangus').length).toBeGreaterThanOrEqual(1)
    })

    it('dialog tambah jenis cuti memvalidasi field wajib', async () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
      await waitFor(() => expect(rowCount(container)).toBeGreaterThan(0))
      fireEvent.click(screen.getByRole('button', { name: /Tambah Jenis Cuti/ }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
      expect(screen.getByText('Nama jenis cuti wajib diisi')).toBeInTheDocument()
      expect(screen.getByText('Kuota harus angka minimal 0')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/Nama jenis cuti/), { target: { value: 'Cuti Ibadah' } })
      fireEvent.change(screen.getByLabelText(/Default Kuota/), { target: { value: '3' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

      await waitFor(() => {
        expect(rowCount(container)).toBe(5)
      })
      expect(screen.getByText('Cuti Ibadah')).toBeInTheDocument()
    })
  })

  describe('Komponen Gaji', () => {
    it('menampilkan komponen default dari GET /api/businesses/:id/default-salary-components', async () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Komponen Gaji' }))
      await waitFor(() => expect(rowCount(container)).toBe(3))
      expect(screen.getByText('3 komponen default')).toBeInTheDocument()
      expect(screen.getByText('Gaji Pokok')).toBeInTheDocument()
      expect(screen.getByText('Tunjangan Transport')).toBeInTheDocument()
      expect(screen.getByText('gaji_pokok * 0.01')).toBeInTheDocument()
      expect(screen.getAllByText('Pendapatan').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Potongan')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /Kelola Komponen Gaji/ })
      expect(link).toHaveAttribute('href', '/salary-components')
    })

    it('menampilkan empty state saat tidak ada komponen default', async () => {
      defaultComponentsState = []
      renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Komponen Gaji' }))
      await waitFor(() => {
        expect(screen.getByText('Belum ada komponen default.')).toBeInTheDocument()
      })
    })
  })

  describe('Pengguna & Role', () => {
    it('merender 6 pengguna dengan role dan status', async () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
      await waitFor(() => {
        expect(rowCount(container)).toBe(6)
      })
      expect(screen.getByText('darmawan@warungkopi.id')).toBeInTheDocument()
      expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Nonaktif')).toBeInTheDocument()
    })

    it('ubah role mengubah state', async () => {
      renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
      await waitFor(() => screen.getByLabelText(/Ubah role Siti Nurhaliza/))
      const select = screen.getByLabelText(/Ubah role Siti Nurhaliza/)
      expect(select).toHaveValue('employee')
      fireEvent.change(select, { target: { value: 'owner' } })
      expect(select).toHaveValue('owner')
    })

    it('dialog undang pengguna menambah user dengan role terpilih', async () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
      await waitFor(() => expect(rowCount(container)).toBe(6))
      fireEvent.click(screen.getByRole('button', { name: /Undang Pengguna/ }))

      const dialog = await screen.findByRole('dialog')
      fireEvent.change(within(dialog).getByLabelText(/Nama/), { target: { value: 'User Baru' } })
      fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'baru@warungkopi.id' } })
      fireEvent.change(within(dialog).getByLabelText(/Kata sandi/), { target: { value: 'secret123' } })
      fireEvent.change(within(dialog).getByLabelText(/Role/), { target: { value: 'owner' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Undang' }))

      await waitFor(() => {
        expect(rowCount(container)).toBe(7)
      })
      expect(screen.getByText('baru@warungkopi.id')).toBeInTheDocument()
    })
  })
})
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

let usersState = [...initialUsers]
let leaveTypesState = [...leaveTypesPayload.leave_types]

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/users') && method === 'POST') {
        const body = init?.body ? (JSON.parse(init.body as string) as { email: string; nama: string; role: 'owner' | 'employee' }) : ({} as never)
        const newUser = {
          id: `u-${Date.now()}`,
          email: body.email,
          nama: body.nama,
          role: body.role,
          status: 'aktif' as const,
          employee_id: null,
          created_at: new Date().toISOString(),
        }
        usersState = [...usersState, newUser]
        return new Response(JSON.stringify({ user: newUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/users') && method === 'PATCH') {
        const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : ({} as never)
        const id = url.split('/').pop()
        usersState = usersState.map((u) =>
          u.id === id ? { ...u, ...(body.role ? { role: body.role as typeof u.role } : {}), ...(body.status ? { status: body.status as typeof u.status } : {}) } : u,
        )
        const updated = usersState.find((u) => u.id === id)
        return new Response(JSON.stringify({ user: updated }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/users')) {
        return new Response(JSON.stringify({ users: usersState, total: usersState.length, limit: 50, offset: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.includes('/api/leave-types') && method === 'POST') {
        const body = init?.body
          ? (JSON.parse(init.body as string) as { nama_jenis_cuti: string; default_kuota_hari: number; kebijakan_sisa: 'hangus' | 'carry-over'; carry_over_max_days: number | null })
          : ({} as never)
        const newLt = {
          id: `lt-${Date.now()}`,
          nama_jenis_cuti: body.nama_jenis_cuti,
          default_kuota_hari: body.default_kuota_hari,
          kebijakan_sisa: body.kebijakan_sisa,
          carry_over_max_days: body.carry_over_max_days,
          aktif: true,
        }
        leaveTypesState = [...leaveTypesState, newLt]
        return new Response(JSON.stringify({ leave_type: newLt }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/leave-types') && method === 'DELETE') {
        const id = url.split('/').pop()
        leaveTypesState = leaveTypesState.filter((lt) => lt.id !== id)
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/leave-types')) {
        return new Response(JSON.stringify({ leave_types: leaveTypesState }), {
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
  usersState = [...initialUsers]
  leaveTypesState = [...leaveTypesPayload.leave_types]
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
    expect(screen.getByRole('link', { name: /Kelola Komponen Gaji/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Profil Bisnis' }))
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeInTheDocument()
  })

  describe('Profil Bisnis', () => {
    it('form terisi data awal dan simpan memperbarui state + toast', () => {
      renderPage()
      const namaInput = screen.getByLabelText(/Nama bisnis/)
      expect(namaInput).toHaveValue('Warung Kopi Nusantara')
      expect(screen.getByLabelText(/Jenis usaha/)).toHaveValue('fnb')
      expect(screen.getByLabelText(/Alamat/)).toHaveValue('Jl. Melati No. 12, Jakarta Selatan')

      fireEvent.change(namaInput, { target: { value: 'Kopi Kita' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))

      expect(screen.getByRole('status')).toHaveTextContent(/tersimpan/)
      expect(namaInput).toHaveValue('Kopi Kita')
    })

    it('validasi: nama bisnis kosong menahan simpan', () => {
      renderPage()
      fireEvent.change(screen.getByLabelText(/Nama bisnis/), { target: { value: '' } })
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
    it('menampilkan jumlah komponen aktif dan tautan ke /salary-components', () => {
      renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Komponen Gaji' }))
      expect(screen.getByText(/7 komponen aktif/)).toBeInTheDocument()
      expect(screen.getByText(/Atur komponen gaji default di halaman Komponen Gaji/)).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /Kelola Komponen Gaji/ })
      expect(link).toHaveAttribute('href', '/salary-components')
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

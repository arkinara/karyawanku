import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useSelectedLayoutSegments: () => [],
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

type BeUserFixture = {
  id: string
  email: string
  nama: string
  role: 'owner' | 'manager' | 'employee'
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

let usersState = [...initialUsers]
let requests: { method: string; url: string; body?: Record<string, unknown> }[] = []

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
      requests.push({ method, url, body })

      if (url.includes('/api/users') && method === 'POST') {
        const newUser: BeUserFixture = {
          id: `u-${Date.now()}`,
          email: (body?.email as string) ?? '',
          nama: (body?.nama as string) ?? '',
          role: (body?.role as BeUserFixture['role']) ?? 'employee',
          status: 'aktif',
          employee_id: null,
          created_at: new Date().toISOString(),
        }
        usersState = [...usersState, newUser]
        return json({ user: newUser })
      }
      if (url.includes('/api/users') && method === 'PATCH') {
        const id = url.split('/').pop()
        usersState = usersState.map((u) =>
          u.id === id
            ? {
                ...u,
                ...(body?.role ? { role: body.role as BeUserFixture['role'] } : {}),
                ...(body?.status ? { status: body.status as BeUserFixture['status'] } : {}),
              }
            : u,
        )
        return json({ user: usersState.find((u) => u.id === id) })
      }
      if (url.includes('/api/users')) {
        return json({ users: usersState, total: usersState.length, limit: 50, offset: 0 })
      }

      return json({})
    }),
  )
}

function setSession(role: 'owner' | 'manager' | 'employee') {
  window.localStorage.setItem('kk-token', 'test-token')
  window.localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'User', email: 'u@x', role }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  usersState = [...initialUsers]
  requests = []
  replaceMock.mockClear()
  setSession('owner')
  stubFetch()
})

function renderUsersTab() {
  render(<SettingsPage />)
  fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Settings — Pengguna & Role wiring (ticket #52)', () => {
  it('memuat daftar pengguna dari GET /api/users dan menampilkan di tabel', async () => {
    const { container } = render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
    await waitFor(() => expect(rowCount(container)).toBe(6))
    expect(requests.some((r) => r.method === 'GET' && r.url.includes('/api/users'))).toBe(true)
    expect(screen.getByText('darmawan@warungkopi.id')).toBeInTheDocument()
    expect(screen.getByText('siti@warungkopi.id')).toBeInTheDocument()
    expect(screen.getByText('Nonaktif')).toBeInTheDocument()
  })

  it('dialog undang pengguna mengirim POST /api/users dan refetch', async () => {
    const { container } = render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
    await waitFor(() => expect(rowCount(container)).toBe(6))

    fireEvent.click(screen.getByRole('button', { name: /Undang Pengguna/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Nama/), { target: { value: 'User Baru' } })
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'baru@warungkopi.id' } })
    fireEvent.change(within(dialog).getByLabelText(/Kata sandi/), { target: { value: 'secret123' } })
    fireEvent.change(within(dialog).getByLabelText(/Role/), { target: { value: 'manager' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undang' }))

    await waitFor(() => {
      expect(requests.some((r) => r.method === 'POST' && r.url.includes('/api/users'))).toBe(true)
    })
    const post = requests.find((r) => r.method === 'POST' && r.url.includes('/api/users'))
    expect(post?.body).toMatchObject({
      nama: 'User Baru',
      email: 'baru@warungkopi.id',
      role: 'manager',
    })

    await waitFor(() => expect(rowCount(container)).toBe(7))
    expect(screen.getByText('baru@warungkopi.id')).toBeInTheDocument()
  })

  it('ubah role via dropdown mengirim PATCH /api/users/:id dan refetch', async () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
    await waitFor(() => screen.getByLabelText(/Ubah role Siti Nurhaliza/))

    const select = screen.getByLabelText(/Ubah role Siti Nurhaliza/)
    expect(select).toHaveValue('employee')
    fireEvent.change(select, { target: { value: 'manager' } })
    expect(select).toHaveValue('manager')

    await waitFor(() => {
      expect(
        requests.some((r) => r.method === 'PATCH' && r.url.includes('/api/users/u-4')),
      ).toBe(true)
    })
    const patch = requests.find((r) => r.method === 'PATCH' && r.url.includes('/api/users/u-4'))
    expect(patch?.body).toEqual({ role: 'manager' })
  })

  it('role options sesuai enum BE (owner, manager, employee)', async () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
    await waitFor(() => screen.getByLabelText(/Ubah role Siti Nurhaliza/))
    const select = screen.getByLabelText(/Ubah role Siti Nurhaliza/)
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['Owner', 'Manager', 'Employee'])
  })
})

describe('Settings — capability gating (ticket #52)', () => {
  it('manager hanya melihat tab Jenis Cuti + Pengguna (Profil Bisnis + Komponen Gaji disembunyikan)', async () => {
    setSession('manager')
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Jenis Cuti' })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: 'Pengguna' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Profil Bisnis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Komponen Gaji' })).not.toBeInTheDocument()
  })
})

describe('Settings — akses karyawan (ticket #52)', () => {
  it('employee diarahkan ke /dashboard', async () => {
    setSession('employee')
    render(<SettingsPage />)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'))
  })
})

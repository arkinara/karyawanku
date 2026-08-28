import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ApiError, api, apiRequest, setToken } from '@/lib/api-client'
import { AuthGuard, ANY_ROLE, EMPLOYEE_ONLY, OWNER_ONLY } from '@/lib/route-guard'

const { replaceMock, locationAssignMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  locationAssignMock: vi.fn(),
}))
const authState = vi.hoisted(() => ({
  user: null as {
    id: string
    email: string
    nama: string
    role: 'owner' | 'manager' | 'employee'
    business_id?: string
    employee_id?: string | null
  } | null,
  loading: false as boolean,
}))
const pathMock = vi.hoisted(() => ({ value: '/' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => pathMock.value,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: authState.user,
    loading: authState.loading,
    error: null,
    isReady: !authState.loading,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    applySession: vi.fn(),
  }),
}))

const ownerUser = { id: 'u', email: 'o@x', nama: 'Owner', role: 'owner' as const, business_id: 'b' }
const managerUser = {
  id: 'u',
  email: 'm@x',
  nama: 'Manager',
  role: 'manager' as const,
  business_id: 'b',
}
const employeeUser = {
  id: 'u',
  email: 'e@x',
  nama: 'Budi',
  role: 'employee' as const,
  business_id: 'b',
  employee_id: '1',
}

const originalLocation = window.location

function mockLocation(path: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      assign: locationAssignMock,
      replace: vi.fn(),
      reload: vi.fn(),
      pathname: path,
      search: '',
      hash: '',
      origin: 'http://localhost',
      href: `http://localhost${path}`,
      toString: () => `http://localhost${path}`,
    },
  })
}

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation })
  vi.unstubAllGlobals()
})

describe('AuthGuard — route gating', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    replaceMock.mockClear()
    locationAssignMock.mockClear()
    authState.user = null
    authState.loading = false
    pathMock.value = '/payroll'
  })

  it('pengguna belum login di /payroll → redirect ke /signin?redirect=/payroll, konten tidak dirender', async () => {
    render(
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/signin?redirect=%2Fpayroll'),
    )
    expect(screen.queryByText('RAHASIA')).not.toBeInTheDocument()
  })

  it('employee di route owner-only → redirect ke /beranda + toast Akses ditolak', async () => {
    authState.user = employeeUser
    render(
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/beranda'))
    expect(await screen.findByText('Akses ditolak')).toBeInTheDocument()
    expect(screen.queryByText('RAHASIA')).not.toBeInTheDocument()
  })

  it('loading → skeleton spinner, tidak ada redirect maupun konten', () => {
    authState.loading = true
    render(
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
    expect(screen.queryByText('RAHASIA')).not.toBeInTheDocument()
  })

  it('owner di route owner-only → konten dirender, tidak redirect', () => {
    authState.user = ownerUser
    render(
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    expect(screen.getByText('RAHASIA')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('employee di route shared (ANY_ROLE) → konten dirender', () => {
    authState.user = employeeUser
    render(
      <AuthGuard requiredRoles={ANY_ROLE}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    expect(screen.getByText('RAHASIA')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('manager di route shared (ANY_ROLE) → konten dirender', () => {
    authState.user = managerUser
    render(
      <AuthGuard requiredRoles={ANY_ROLE}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    expect(screen.getByText('RAHASIA')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('manager di route employee-only (/beranda) → redirect ke /dashboard (bukan /beranda)', async () => {
    authState.user = managerUser
    render(
      <AuthGuard requiredRoles={EMPLOYEE_ONLY}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'))
    expect(await screen.findByText('Akses ditolak')).toBeInTheDocument()
    expect(screen.queryByText('RAHASIA')).not.toBeInTheDocument()
  })

  it('manager di route owner-only (/salary-components) → redirect ke /dashboard + toast', async () => {
    authState.user = managerUser
    render(
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <div>RAHASIA</div>
      </AuthGuard>,
    )
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'))
    expect(await screen.findByText('Akses ditolak')).toBeInTheDocument()
    expect(screen.queryByText('RAHASIA')).not.toBeInTheDocument()
  })
})

describe('Session expiry (401) via api-client', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    locationAssignMock.mockClear()
    // setToken resets the module-level expiry-dedup flag for a clean slate.
    setToken('seed')
    localStorage.clear()
  })

  it('401 dari api call → clear localStorage + redirect ke /signin?redirect=<path> + flag sesi', async () => {
    mockLocation('/payroll')
    setToken('expired-token')
    localStorage.setItem(
      'kk-user',
      JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Token expired' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(api.get('/api/employees')).rejects.toBeInstanceOf(ApiError)

    expect(locationAssignMock).toHaveBeenCalledWith('/signin?redirect=%2Fpayroll')
    expect(localStorage.getItem('kk-token')).toBeNull()
    expect(localStorage.getItem('kk-user')).toBeNull()
    expect(sessionStorage.getItem('kk-session-expired')).toBe('1')
  })

  it('403 tidak dianggap session loss — tidak redirect, sesi tetap ada', async () => {
    mockLocation('/payroll')
    setToken('valid-token')
    localStorage.setItem(
      'kk-user',
      JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(api.get('/api/employees')).rejects.toBeInstanceOf(ApiError)

    expect(locationAssignMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('kk-token')).toBe('valid-token')
    expect(sessionStorage.getItem('kk-session-expired')).toBeNull()
  })

  it('401 pada request anonymous (mis. login gagal) tidak dianggap session loss', async () => {
    mockLocation('/signin')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Email atau kata sandi salah' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      apiRequest('/api/auth/sign-in', { method: 'POST', anonymous: true, body: {} }),
    ).rejects.toBeInstanceOf(ApiError)

    expect(locationAssignMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('kk-session-expired')).toBeNull()
  })
})
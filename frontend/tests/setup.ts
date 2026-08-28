import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// The M3/ProMax bridge made AppShell (and every page using it) a 'use client'
// component that calls useRouter()/usePathname()/useSearchParams() from
// next/navigation. jsdom has no Next.js router context, so mock the module
// globally. Pages that exercise navigation should assert on these fns.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/mock-path',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useSelectedLayoutSegments: () => [],
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

// The M3/ProMax bridge also made AppShell gate all page content behind
// useAuth() (skeleton until `loading` resolves). jsdom has no server round-trip,
// so replace the hook with a synchronous version: it reads the session from
// localStorage (tests that care set `kk-user`/`kk-token` themselves) and falls
// back to a logged-in owner so pages render immediately like they did pre-bridge.
// signIn/signUp resolve ok and applySession persists — auth-flow tests keep their
// real shape without needing a mounted <AuthProvider>.
vi.mock('@/lib/auth-context', () => {
  type MockUser = {
    id: string
    nama: string
    email: string
    role: 'owner' | 'manager' | 'employee'
    business_id?: string
    employee_id?: string | null
  }
  // No business_id on the fallback so the onboarding wizard (which checks
  // `Boolean(authUser?.business_id)`) still renders its owner-account form.
  const fallbackUser: MockUser = {
    id: 'usr-test',
    nama: 'Pak Darmawan',
    email: 'owner@usaha.com',
    role: 'owner',
  }
  // Cache the parsed session so the user object keeps a stable identity across
  // renders — components with a `useEffect(..., [user])` that calls setState
  // (e.g. the onboarding wizard) would otherwise re-render forever.
  let cachedRaw: string | null = null
  let cachedUser: MockUser = fallbackUser
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => {
      const raw = window.localStorage.getItem('kk-user')
      if (raw !== cachedRaw) {
        let stored: MockUser | null = null
        if (raw) {
          try {
            stored = JSON.parse(raw)
          } catch {
            stored = null
          }
        }
        cachedRaw = raw
        cachedUser = stored ?? fallbackUser
      }
      return {
        user: cachedUser,
        loading: false,
        error: null,
        isReady: true,
        signIn: async () => ({ ok: true }),
        signUp: async () => ({ ok: true }),
        signOut: async () => {
          window.localStorage.removeItem('kk-token')
          window.localStorage.removeItem('kk-user')
          cachedRaw = null
          cachedUser = fallbackUser
        },
        refresh: async () => cachedUser,
        applySession: (sessionUser: MockUser, token: string) => {
          window.localStorage.setItem('kk-token', token)
          window.localStorage.setItem('kk-user', JSON.stringify(sessionUser))
          cachedRaw = JSON.stringify(sessionUser)
          cachedUser = sessionUser
        },
      }
    },
  }
})

afterEach(() => {
  cleanup()
})

// jsdom has no matchMedia; AppShell's useMediaQuery (drawer auto-close on
// desktop resize) and any responsive listener need a stub.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

// jsdom has no fetch; the FE API client (apiRequest) needs a stub so unit
// tests that exercise sign-in / dashboard / etc. can complete without a
// running BE. Tests that need richer behaviour should override `globalThis.fetch`
// in their own setup with `vi.stubGlobal('fetch', …)`.
const defaultUser = {
  id: 'usr-test',
  business_id: 'biz-test',
  nama: 'Pak Darmawan',
  email: 'owner@usaha.com',
  role: 'owner' as const,
  employee_id: null,
}

const stubFetch: typeof fetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  const body = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  if (url.endsWith('/api/auth/sign-in') || url.endsWith('/api/auth/sign-up')) {
    return body({ token: 'test-token', user: defaultUser })
  }
  if (url.endsWith('/api/auth/sign-out')) return body({ ok: true })
  if (url.endsWith('/api/auth/me')) return body({ user: defaultUser })

  // Default: return an empty object so callers can decide their own shape.
  return body({})
}) as typeof fetch

vi.stubGlobal('fetch', stubFetch)
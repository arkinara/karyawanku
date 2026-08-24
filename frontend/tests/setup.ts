import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

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
/**
 * KaryawanKu — FE API client (Wiring phase).
 *
 * Single source of truth for talking to the Fastify BE on `http://localhost:3001`.
 * Reads the JWT from localStorage (`kk-token`) and adds `Authorization: Bearer …`.
 * Normalises BE error envelopes (`{ error: { message, details } }`) into thrown
 * `ApiError` instances so screens can render toasts without leaking Fastify
 * internals.
 *
 * Token storage:
 * *   `kk-token` — JWT issued by POST /api/auth/sign-in | sign-up
 * *   `kk-user` — JSON-serialised user record (id, role, employee_id, …)
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'

export const TOKEN_KEY = 'kk-token'
export const USER_KEY = 'kk-user'

export interface ApiUser {
  id: string
  business_id: string
  nama: string
  email: string
  role: 'owner' | 'employee'
  status: 'aktif' | 'nonaktif'
  employee_id: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function getToken(): string | null {
  return safeLocalStorage()?.getItem(TOKEN_KEY) ?? null
}

export function setToken(token: string | null): void {
  const ls = safeLocalStorage()
  if (!ls) return
  if (token) ls.setItem(TOKEN_KEY, token)
  else ls.removeItem(TOKEN_KEY)
}

export function getStoredUser(): ApiUser | null {
  const ls = safeLocalStorage()
  if (!ls) return null
  const raw = ls.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ApiUser
  } catch {
    return null
  }
}

export function setStoredUser(user: ApiUser | null): void {
  const ls = safeLocalStorage()
  if (!ls) return
  if (user) ls.setItem(USER_KEY, JSON.stringify(user))
  else ls.removeItem(USER_KEY)
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Query string params (objects will be stringified for non-strings). */
  query?: Record<string, string | number | boolean | undefined | null>
  /** When true, skip the Authorization header (sign-in / sign-up). */
  anonymous?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const token = getToken()
  if (!opts.anonymous && token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
  }

  const fetchInit: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    body,
  }
  if (opts.signal) fetchInit.signal = opts.signal

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), fetchInit)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Gagal menghubungi server'
    throw new ApiError(0, msg)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!res.ok) {
    let message = `Permintaan gagal (${res.status})`
    let details: unknown
    if (isJson) {
      try {
        const body = (await res.json()) as { error?: { message?: string; details?: unknown } }
        message = body.error?.message ?? message
        details = body.error?.details
      } catch {
        // body wasn't JSON, keep default message
      }
    }
    throw new ApiError(res.status, message, details)
  }

  if (res.status === 204) return undefined as T
  if (isJson) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

/**
 * Subscribe to localStorage changes for the auth session (e.g. logout from
 * another tab). Returns an unsubscribe function.
 */
export function onAuthChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY || event.key === USER_KEY) handler()
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

export function clearSession(): void {
  setToken(null)
  setStoredUser(null)
}
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
  status?: 'aktif' | 'nonaktif'
  employee_id?: string | null
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

/* ------------------------------------------------------------------ *
 * Error event bus (for the global error toast).
 * ------------------------------------------------------------------ */

type ErrorListener = (error: ApiError) => void

const errorListeners = new Set<ErrorListener>()

/** Subscribe to API failures. Returns an unsubscribe function. */
export function onApiError(listener: ErrorListener): () => void {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

function notifyError(error: ApiError): void {
  errorListeners.forEach((listener) => {
    try {
      listener(error)
    } catch {
      // listener must never break the request pipeline
    }
  })
}

/**
 * Map a transport failure (status 0) to a friendly Bahasa message.
 * Non-zero statuses keep the server-provided message (which the BE already
 * localises); status 0 means the network is unreachable.
 */
export function errorMessage(error: ApiError): string {
  if (error.status === 0) return 'Tidak terhubung ke server'
  if (error.status === 401) return 'Sesi berakhir, silakan masuk ulang'
  if (error.status >= 500) return 'Gagal memuat data'
  return error.message || 'Gagal memuat data'
}

/* ------------------------------------------------------------------ *
 * `api` — ergonomic singleton facade over `apiRequest`.
 * ------------------------------------------------------------------ */

function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, opts).catch((e: unknown) => {
    if (e instanceof ApiError) notifyError(e)
    throw e
  })
}

export interface ApiClient {
  get<T = unknown>(path: string, query?: RequestOptions['query']): Promise<T>
  post<T = unknown>(path: string, body?: unknown): Promise<T>
  patch<T = unknown>(path: string, body?: unknown): Promise<T>
  put<T = unknown>(path: string, body?: unknown): Promise<T>
  delete<T = unknown>(path: string): Promise<T>
  upload<T = unknown>(path: string, formData: FormData): Promise<T>
  download(path: string, query?: RequestOptions['query']): Promise<Blob>
}

export const api: ApiClient = {
  get<T>(path: string, query?: RequestOptions['query']) {
    return request<T>(path, { method: 'GET', query })
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body })
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body })
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PUT', body })
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' })
  },
  upload<T>(path: string, formData: FormData) {
    return request<T>(path, { method: 'POST', body: formData })
  },
  async download(path: string, query?: RequestOptions['query']): Promise<Blob> {
    const url = buildUrl(path, query)
    const headers: Record<string, string> = { Accept: 'application/octet-stream' }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    let res: Response
    try {
      res = await fetch(url, { method: 'GET', headers })
    } catch (e) {
      const err = new ApiError(0, e instanceof Error ? e.message : 'Gagal menghubungi server')
      notifyError(err)
      throw err
    }
    if (!res.ok) {
      let message = `Permintaan gagal (${res.status})`
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        message = body.error?.message ?? message
      } catch {
        // non-JSON error body — keep default
      }
      const err = new ApiError(res.status, message)
      notifyError(err)
      throw err
    }
    return res.blob()
  },
}
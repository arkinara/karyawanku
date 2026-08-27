'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import {
  clearSession,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '@/lib/api-client'

/**
 * KaryawanKu — real auth session backed by the Fastify BE (Wiring, ticket #34).
 *
 * Replaces the pre-wiring `auth-mock`. Sign-in / sign-up / sign-out call the
 * real `/api/auth/*` endpoints on `localhost:3001`, and on mount the session
 * is rehydrated from `GET /api/auth/me` whenever a token already exists.
 *
 * Provided to the app via `<AuthProvider>` (see `app/layout.tsx`). `useAuth()`
 * also falls back to a standalone implementation when rendered without a
 * provider so unit tests and any unmounted client page keep working.
 */

export interface AuthUser {
  id: string
  email: string
  nama: string
  role: 'owner' | 'employee'
  business_id: string
  employee_id?: string | null
}

export interface AuthApi {
  user: AuthUser | null
  loading: boolean
  error: string | null
  isReady: boolean
  signIn(email: string, password: string): Promise<{ ok: boolean }>
  signUp(input: { nama: string; email: string; password: string; namaBisnis?: string }): Promise<{ ok: boolean }>
  signOut(): Promise<void>
  refresh(): Promise<AuthUser | null>
  /** Adopt a session issued by POST /api/businesses (onboarding). */
  applySession(user: AuthUser, token: string): void
}

function useAuthImpl(): AuthApi {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUser(getStoredUser() as AuthUser | null)
    if (!getToken()) {
      setLoading(false)
      return
    }
    // Rehydrate the session against the server whenever a token exists.
    api
      .get<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        if (!res?.user) return // malformed response — keep the stored session
        setStoredUser(res.user)
        setUser(res.user)
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession()
          setUser(null)
        }
        setError(e instanceof Error ? e.message : 'Gagal memuat sesi')
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean }> => {
      setError(null)
      try {
        const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/sign-in', {
          email,
          password,
        })
        setToken(res.token)
        setStoredUser(res.user)
        setUser(res.user)
        return { ok: true }
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, e instanceof Error ? e.message : 'Gagal masuk')
        setError(err.message)
        throw err
      }
    },
    [],
  )

  const signUp = useCallback(
    async (input: {
      nama: string
      email: string
      password: string
      namaBisnis?: string
    }): Promise<{ ok: boolean }> => {
      setError(null)
      try {
        const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/sign-up', input)
        setToken(res.token)
        setStoredUser(res.user)
        setUser(res.user)
        return { ok: true }
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, e instanceof Error ? e.message : 'Gagal mendaftar')
        setError(err.message)
        throw err
      }
    },
    [],
  )

  const signOut = useCallback(async (): Promise<void> => {
    const token = getToken()
    if (token) {
      try {
        await api.post('/api/auth/sign-out')
      } catch {
        // sign-out is idempotent — clear local state even if BE rejects
      }
    }
    clearSession()
    setUser(null)
    setError(null)
  }, [])

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    if (!getToken()) return null
    try {
      const res = await api.get<{ user: AuthUser }>('/api/auth/me')
      if (!res?.user) return null // malformed response — keep the stored session
      setStoredUser(res.user)
      setUser(res.user)
      return res.user
    } catch {
      clearSession()
      setUser(null)
      return null
    }
  }, [])

  const applySession = useCallback((sessionUser: AuthUser, token: string): void => {
    setToken(token)
    setStoredUser(sessionUser)
    setUser(sessionUser)
    setError(null)
  }, [])

  return { user, loading, error, isReady: !loading, signIn, signUp, signOut, refresh, applySession }
}

const AuthContext = createContext<AuthApi | null>(null)

/** Global auth provider — wrap the app once in `app/layout.tsx`. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAuthImpl()
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Read the auth session. Falls back to a standalone impl when no provider. */
export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (ctx) return ctx
  return useAuthImpl()
}

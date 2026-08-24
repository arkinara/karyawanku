'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, getStoredUser, getToken, setStoredUser, setToken, ApiError } from '@/lib/api-client'

/**
 * Auth session for the FE auth pages (Wiring phase — ticket #34).
 *
 * Replaces the pre-wiring `auth-mock` by delegating to the real BE on
 * `localhost:3001`. The shape (`user` with `role: 'owner' | 'employee'`)
 * is preserved so the existing AuthLayout, AppShell guards, and tests
 * keep working without changes.
 *
 * Production: call goes through `apiRequest` → Fastify BE.
 * Tests: vitest setup stubs `fetch` so calls resolve with the same shape.
 */

export interface AuthUser {
  id: string
  email: string
  nama: string
  role: 'owner' | 'employee'
  business_id: string
  employee_id: string | null
}

export interface AuthResult {
  ok: boolean
}

function readSession(): AuthUser | null {
  return getStoredUser() as AuthUser | null
}

export interface AuthApi {
  user: AuthUser | null
  isReady: boolean
  signIn(email: string, password: string): Promise<AuthResult>
  signUp(input: {
    nama: string
    email: string
    password: string
    namaBisnis?: string
  }): Promise<AuthResult>
  signOut(): Promise<void>
  refresh(): Promise<AuthUser | null>
}

export function useAuth(): AuthApi {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isReady, setReady] = useState(false)

  useEffect(() => {
    setUser(readSession())
    setReady(true)
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>(
        '/api/auth/sign-in',
        { method: 'POST', body: { email, password }, anonymous: true },
      )
      setToken(res.token)
      setStoredUser(res.user)
      setUser(res.user)
      return { ok: true }
    } catch (e) {
      // Surface auth failure so the screen can show a message
      if (e instanceof ApiError) throw e
      throw new ApiError(0, e instanceof Error ? e.message : 'Gagal masuk')
    }
  }, [])

  const signUp = useCallback(
    async (input: {
      nama: string
      email: string
      password: string
      namaBisnis?: string
    }): Promise<AuthResult> => {
      try {
        const res = await apiRequest<{ token: string; user: AuthUser }>(
          '/api/auth/sign-up',
          { method: 'POST', body: input, anonymous: true },
        )
        setToken(res.token)
        setStoredUser(res.user)
        setUser(res.user)
        return { ok: true }
      } catch (e) {
        if (e instanceof ApiError) throw e
        throw new ApiError(0, e instanceof Error ? e.message : 'Gagal mendaftar')
      }
    },
    [],
  )

  const signOut = useCallback(async (): Promise<void> => {
    const token = getToken()
    if (token) {
      try {
        await apiRequest('/api/auth/sign-out', { method: 'POST' })
      } catch {
        // sign-out is idempotent — clear local state even if BE rejects
      }
    }
    setToken(null)
    setStoredUser(null)
    setUser(null)
  }, [])

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    if (!getToken()) return null
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/auth/me')
      setStoredUser(res.user)
      setUser(res.user)
      return res.user
    } catch {
      setToken(null)
      setStoredUser(null)
      setUser(null)
      return null
    }
  }, [])

  return { user, isReady, signIn, signUp, signOut, refresh }
}
'use client'

import { useEffect, useState } from 'react'
import {
  type ApiUser,
  type RequestOptions,
  apiRequest,
  clearSession,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '@/lib/api-client'

export interface AuthSession {
  user: ApiUser | null
  token: string | null
}

export interface AuthClient {
  user: ApiUser | null
  token: string | null
  isReady: boolean
  signIn(email: string, password: string): Promise<ApiUser>
  signUp(input: {
    nama: string
    email: string
    password: string
    namaBisnis?: string
  }): Promise<ApiUser>
  signOut(): Promise<void>
  refresh(): Promise<ApiUser | null>
}

function persist(token: string, user: ApiUser): void {
  setToken(token)
  setStoredUser(user)
}

function readSession(): AuthSession {
  return { user: getStoredUser(), token: getToken() }
}

export function useAuth(): AuthClient {
  const [session, setSession] = useState<AuthSession>({ user: null, token: null })
  const [isReady, setReady] = useState(false)

  useEffect(() => {
    setSession(readSession())
    setReady(true)
  }, [])

  const signIn = async (email: string, password: string): Promise<ApiUser> => {
    const res = await apiRequest<{ token: string; user: ApiUser }>('/api/auth/sign-in', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    })
    persist(res.token, res.user)
    setSession({ user: res.user, token: res.token })
    return res.user
  }

  const signUp = async (input: {
    nama: string
    email: string
    password: string
    namaBisnis?: string
  }): Promise<ApiUser> => {
    const res = await apiRequest<{ token: string; user: ApiUser }>('/api/auth/sign-up', {
      method: 'POST',
      body: input,
      anonymous: true,
    })
    persist(res.token, res.user)
    setSession({ user: res.user, token: res.token })
    return res.user
  }

  const signOut = async (): Promise<void> => {
    const token = getToken()
    if (token) {
      try {
        await apiRequest('/api/auth/sign-out', { method: 'POST' })
      } catch {
        // sign-out is idempotent; ignore BE failures so the UI can still clear locally
      }
    }
    clearSession()
    setSession({ user: null, token: null })
  }

  const refresh = async (): Promise<ApiUser | null> => {
    if (!getToken()) return null
    try {
      const res = await apiRequest<{ user: ApiUser }>('/api/auth/me')
      setStoredUser(res.user)
      setSession((prev) => ({ ...prev, user: res.user }))
      return res.user
    } catch {
      clearSession()
      setSession({ user: null, token: null })
      return null
    }
  }

  return {
    user: session.user,
    token: session.token,
    isReady,
    signIn,
    signUp,
    signOut,
    refresh,
  }
}

export interface FetchState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  reload(): Promise<void>
}

/**
 * Tiny `useEffect`-driven loader for one-shot API calls. Handles abort on
 * unmount and exposes a manual `reload()` to retry after a mutation.
 */
export function useApiQuery<T>(
  path: string | null,
  opts: Omit<RequestOptions, 'signal'> = {},
  deps: ReadonlyArray<unknown> = [],
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    isLoading: path !== null,
    reload: async () => undefined,
  })

  const reload = async (): Promise<void> => {
    if (path === null) return
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await apiRequest<T>(path, opts)
      setState((prev) => ({ ...prev, data, error: null, isLoading: false }))
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setState((prev) => ({ ...prev, error: err, isLoading: false }))
    }
  }

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    apiRequest<T>(path, { ...opts, signal: controller.signal })
      .then((data) => {
        setState((prev) => ({ ...prev, data, error: null, isLoading: false }))
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        const err = e instanceof Error ? e : new Error(String(e))
        setState((prev) => ({ ...prev, error: err, isLoading: false }))
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  return { ...state, reload }
}
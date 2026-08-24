'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Mock auth session for the FE auth pages (ticket #2).
 *
 * This is a stand-in until Better Auth wiring lands in FE Wiring (ticket #34).
 * It stores a fake session in localStorage so the /signin and /signup forms
 * can simulate login/registration and role derivation without a backend.
 */

export const SESSION_KEY = 'kk-mock-session'

export interface AuthUser {
  email: string
  role: 'owner' | 'employee'
}

export interface AuthResult {
  ok: boolean
}

function readSession(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function writeSession(user: AuthUser) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

/**
 * Mock role derivation: any email mentioning "owner"/"pemilik" is treated as an
 * owner (redirect to owner dashboard); everything else defaults to employee.
 */
function deriveRole(email: string): 'owner' | 'employee' {
  const normalized = email.toLowerCase()
  return normalized.includes('owner') || normalized.includes('pemilik')
    ? 'owner'
    : 'employee'
}

export interface AuthApi {
  user: AuthUser | null
  signIn(email: string, _password: string): Promise<AuthResult>
  signUp(email: string, _password: string): Promise<AuthResult>
  signOut(): void
}

export function useAuth(): AuthApi {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setUser(readSession())
  }, [])

  const signIn = useCallback(async (email: string): Promise<AuthResult> => {
    const next: AuthUser = { email, role: deriveRole(email) }
    writeSession(next)
    setUser(next)
    return { ok: true }
  }, [])

  const signUp = useCallback(async (email: string): Promise<AuthResult> => {
    const next: AuthUser = { email, role: 'owner' }
    writeSession(next)
    setUser(next)
    return { ok: true }
  }, [])

  const signOut = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  return { user, signIn, signUp, signOut }
}

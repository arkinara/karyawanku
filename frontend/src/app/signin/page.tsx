'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/auth-layout'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { getStoredUser, SESSION_EXPIRED_KEY } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { roleHome } from '@/lib/nav-config'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(v: string): string | undefined {
  if (v.trim() === '') return 'Email wajib diisi.'
  if (!EMAIL_RE.test(v)) return 'Email tidak valid.'
  return undefined
}

/** Only same-app paths are allowed as a redirect target (no open redirects). */
function safeRedirect(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, user, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const redirect = safeRedirect(searchParams.get('redirect'))
  // If a session already existed on mount (deep link while logged in), the
  // user is sent to their role home. A user that just signed in on this page
  // navigates via the submit handler instead, so the effect must not hijack it.
  const hadSessionOnMount = useRef(Boolean(user))

  useEffect(() => {
    if (loading || !hadSessionOnMount.current) return
    if (user) router.replace(roleHome(user.role))
  }, [loading, user, router])

  // Show the "sesi telah berakhir" notice exactly once after an expiry bounce.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_EXPIRED_KEY)) {
        window.sessionStorage.removeItem(SESSION_EXPIRED_KEY)
        setSessionExpired(true)
      }
    } catch {
      // sessionStorage unavailable — ignore
    }
  }, [])

  const emailError = submitted || touched.email ? validateEmail(email) : undefined
  const passwordError =
    submitted || touched.password
      ? password === ''
        ? 'Kata sandi wajib diisi.'
        : undefined
      : undefined

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const hasError = Boolean(validateEmail(email) || password === '')
    setSubmitted(true)
    setTouched({ email: true, password: true })
    setFormError(null)
    if (hasError) return

    setBusy(true)
    try {
      await signIn(email, password)
      const target = redirect ?? roleHome(getStoredUser()?.role ?? 'owner')
      router.push(target)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Masuk gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mt-6 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-md bg-primary text-[16px] font-bold text-primary-on">
          K
        </span>
        <span className="text-lg font-semibold tracking-tight">KaryawanKu</span>
      </div>

      <h1 className="t-h1 mt-6">Masuk</h1>
      <p className="t-body-sm t-muted mt-1.5">Masuk untuk melanjutkan.</p>

      {sessionExpired && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-warning/40 bg-warning-container/30 px-4 py-3 text-sm text-warning"
        >
          Sesi telah berakhir. Silakan masuk kembali.
        </div>
      )}

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="nama@usaha.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={emailError}
        />

        <PasswordField
          id="password"
          label="Kata sandi"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          autoComplete="current-password"
          placeholder="Minimal 8 karakter"
          error={passwordError}
          labelAction={
            <a href="#" className="text-[13px] font-semibold text-primary">
              Lupa password?
            </a>
          }
        />

        {formError && (
          <p
            role="alert"
            className="t-body-sm rounded-xl border border-danger/40 bg-danger-container/30 px-3 py-2 text-danger"
          >
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-2 w-full" aria-busy={busy} disabled={busy}>
          {busy ? (
            <>
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
              />
              Memproses...
            </>
          ) : (
            'Masuk'
          )}
        </Button>

        <p className="t-body-sm text-center">
          Belum punya akun?{' '}
          <Link href="/signup" className="font-semibold text-primary">
            Daftar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
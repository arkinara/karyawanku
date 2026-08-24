'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/auth-layout'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { useAuth } from '@/lib/auth-mock'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(v: string): string | undefined {
  if (v.trim() === '') return 'Email wajib diisi.'
  if (!EMAIL_RE.test(v)) return 'Email tidak valid.'
  return undefined
}

export default function SignInPage() {
  const router = useRouter()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

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
    if (hasError) return

    setBusy(true)
    await Promise.all([signIn(email, password), new Promise((r) => setTimeout(r, 1000))])
    router.push('/dashboard')
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

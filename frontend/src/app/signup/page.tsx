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
const HAS_LETTER = /[a-zA-Z]/
const HAS_DIGIT = /\d/

function validateNama(v: string): string | undefined {
  if (v.trim() === '') return 'Nama wajib diisi.'
  return undefined
}

function validateEmail(v: string): string | undefined {
  if (v.trim() === '') return 'Email wajib diisi.'
  if (!EMAIL_RE.test(v)) return 'Email tidak valid.'
  return undefined
}

function validatePassword(v: string): string | undefined {
  if (v === '') return 'Kata sandi wajib diisi.'
  if (v.length < 8) return 'Kata sandi minimal 8 karakter.'
  if (!(HAS_LETTER.test(v) && HAS_DIGIT.test(v)))
    return 'Kata sandi harus mengandung huruf dan angka.'
  return undefined
}

function validateConfirm(v: string, password: string): string | undefined {
  if (v === '') return 'Konfirmasi kata sandi wajib diisi.'
  if (v !== password) return 'Konfirmasi kata sandi tidak cocok.'
  return undefined
}

export default function SignUpPage() {
  const router = useRouter()
  const { signUp } = useAuth()

  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState({
    nama: false,
    email: false,
    password: false,
    confirm: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  const namaError = submitted || touched.nama ? validateNama(nama) : undefined
  const emailError = submitted || touched.email ? validateEmail(email) : undefined
  const passwordError = submitted || touched.password ? validatePassword(password) : undefined
  const confirmError = submitted || touched.confirm ? validateConfirm(confirm, password) : undefined

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const hasError = Boolean(
      validateNama(nama) ||
        validateEmail(email) ||
        validatePassword(password) ||
        validateConfirm(confirm, password),
    )
    setSubmitted(true)
    setTouched({ nama: true, email: true, password: true, confirm: true })
    if (hasError) return

    setBusy(true)
    await Promise.all([signUp(email, password), new Promise((r) => setTimeout(r, 1500))])
    router.push('/onboarding')
  }

  return (
    <AuthLayout>
      <div className="mt-6 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-md bg-primary text-[16px] font-bold text-primary-on">
          K
        </span>
        <span className="text-lg font-semibold tracking-tight">KaryawanKu</span>
      </div>

      <h1 className="t-h1 mt-6">Daftar</h1>
      <p className="t-body-sm t-muted mt-1.5">Buat akun untuk memulai.</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          id="nama"
          label="Nama"
          autoComplete="name"
          placeholder="cth: Pak Darmawan"
          required
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, nama: true }))}
          error={namaError}
        />

        <TextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
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
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          showStrength
          error={passwordError}
        />

        <TextField
          id="confirm"
          label="Konfirmasi kata sandi"
          type="password"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          error={confirmError}
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
            'Daftar'
          )}
        </Button>

        <p className="t-body-sm text-center">
          Sudah punya akun?{' '}
          <Link href="/signin" className="font-semibold text-primary">
            Masuk
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ErrorSurface } from '@/components/ui'
import { Icon } from '@/components/ui/icon'
import { Stepper } from '@/components/ui/stepper'
import { TextField } from '@/components/ui/text-field'
import { PasswordField } from '@/components/auth/password-field'
import { cn } from '@/lib/cn'
import { api, type ApiUser } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { WIZARD_STEPS, useWizard } from './use-wizard'
import type { WizardApi } from './use-wizard'

/**
 * Onboarding (ticket #44): the wizard is wired to the BE.
 *
 * *   Step 1 collects the business profile + the owner account; "Selesaikan
 *     Setup" (step 3) POSTs to `/api/businesses`, adopts the returned session
 *     and redirects to the dashboard. When the user already has a session with
 *     a business (sign-up path) the business POST is skipped and the existing
 *     `business_id` is reused.
 * *   Step 2 fetches the platform defaults via
 *     `GET /api/salary-components?defaults=true`. Without a token (fresh
 *     visitor) that call fails and the wizard falls back to the local default
 *     list, so the stepper never blocks.
 * *   Step 3 marks the toggled subset as the business defaults via
 *     `PUT /api/businesses/:id/default-salary-components`.
 */

interface DefaultComponentDraft {
  nama: string
  tipe: 'earning' | 'deduction'
  nominal: number | null
  formula: string | null
}

const COMPONENT_DEFAULTS: Record<string, DefaultComponentDraft> = {
  'gaji-pokok': { nama: 'Gaji Pokok', tipe: 'earning', nominal: 3000000, formula: null },
  'tunjangan-transport': { nama: 'Tunjangan Transport', tipe: 'earning', nominal: 400000, formula: null },
  'tunjangan-makan': { nama: 'Tunjangan Makan', tipe: 'earning', nominal: 350000, formula: null },
  'tunjangan-jabatan': { nama: 'Tunjangan Jabatan', tipe: 'earning', nominal: 500000, formula: null },
  'potongan-bpjs-kesehatan': { nama: 'BPJS Kesehatan', tipe: 'deduction', nominal: null, formula: 'gaji_pokok * 0.01' },
  'potongan-bpjs-ket': { nama: 'BPJS Ketenagakerjaan', tipe: 'deduction', nominal: null, formula: 'gaji_pokok * 0.02' },
}

interface BeSalaryComponent {
  id: string
  nama_komponen: string
  tipe: 'earning' | 'deduction'
  nominal: number | null
  formula: string | null
  aktif: boolean
  is_default: boolean
}

const fieldClass = cn(
  'w-full min-h-[44px] rounded-xl border border-outline-variant bg-surface-1 px-4 py-3',
  'text-onsurface outline-none transition-colors',
  'placeholder:text-onsurface-variant',
  'focus:border-primary focus:ring-1 focus:ring-primary',
  'aria-invalid:border-danger',
)

const JENIS_OPTIONS: { value: string; label: string }[] = [
  { value: 'fnb', label: 'F&B' },
  { value: 'jasa', label: 'Jasa' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jenisLabel(value: string): string {
  if (value === 'fnb') return 'F&B'
  if (value === 'jasa') return 'Jasa'
  return '—'
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-outline-variant px-4 py-2.5 first:border-t-0">
      <dt className="t-caption shrink-0">{label}</dt>
      <dd className="text-right text-[13.5px] font-semibold">{value || '—'}</dd>
    </div>
  )
}

interface StepFooterProps {
  wizard: WizardApi
  /** Extra gate for step 0 (owner account validity when collecting credentials). */
  step0Valid?: boolean
}

function StepFooter({ wizard, step0Valid = true }: StepFooterProps) {
  const step = wizard.state.currentStep
  const valid = step === 0 ? wizard.stepValid[0] && step0Valid : wizard.stepValid[step]
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-outline-variant bg-surface-1 px-5 py-4">
      {step > 0 ? (
        <Button variant="text" onClick={wizard.goBack}>
          Kembali
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-3">
        {step === 1 && (
          <Button variant="text" onClick={wizard.skip}>
            Skip
          </Button>
        )}
        {step < 2 && (
          <Button onClick={wizard.goNext} disabled={!valid}>
            Lanjut
          </Button>
        )}
      </div>
    </footer>
  )
}

interface OwnerAccountProps {
  nama: string
  email: string
  password: string
  touched: { nama: boolean; email: boolean; password: boolean }
  sessionHasBusiness: boolean
  onChange: (field: 'nama' | 'email' | 'password', value: string) => void
  onBlur: (field: 'nama' | 'email' | 'password') => void
}

function OwnerAccountSection({
  nama,
  email,
  password,
  touched,
  sessionHasBusiness,
  onChange,
  onBlur,
}: OwnerAccountProps) {
  if (sessionHasBusiness) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="t-label text-onsurface">Akun owner sudah dibuat</p>
          <p className="t-caption mt-0.5">
            Anda telah masuk sebagai <span className="font-medium">{email}</span>. Lanjut mengatur
            komponen gaji standar.
          </p>
        </div>
      </div>
    )
  }

  const namaError = touched.nama && nama.trim() === '' ? 'Nama owner wajib diisi.' : undefined
  const emailError =
    touched.email && email.trim() === ''
      ? 'Email wajib diisi.'
      : touched.email && !EMAIL_RE.test(email.trim())
        ? 'Format email tidak valid.'
        : undefined
  const passwordError =
    touched.password && password === ''
      ? 'Kata sandi wajib diisi.'
      : touched.password && password.length < 8
        ? 'Kata sandi minimal 8 karakter.'
        : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-outline-variant pb-3">
        <h2 className="t-h3">Akun owner</h2>
        <p className="t-caption mt-0.5">
          Dipakai untuk masuk kembali ke workspace Anda.
        </p>
      </div>
      <TextField
        id="nama-owner"
        label="Nama lengkap"
        required
        value={nama}
        onChange={(e) => onChange('nama', e.target.value)}
        onBlur={() => onBlur('nama')}
        placeholder="cth: Pak Darmawan"
        autoComplete="name"
        error={namaError}
      />
      <TextField
        id="owner-email"
        label="Email"
        type="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => onChange('email', e.target.value)}
        onBlur={() => onBlur('email')}
        placeholder="nama@usaha.com"
        autoComplete="email"
        error={emailError}
      />
      <PasswordField
        id="owner-password"
        label="Kata sandi"
        required
        value={password}
        onChange={(e) => onChange('password', e.target.value)}
        onBlur={() => onBlur('password')}
        autoComplete="new-password"
        placeholder="Minimal 8 karakter"
        helperText="Minimal 8 karakter"
        error={passwordError}
      />
    </div>
  )
}

function BusinessProfileStep({
  wizard,
  touched,
  setTouched,
  owner,
  ownerTouched,
  setOwnerTouched,
  onOwnerChange,
  sessionHasBusiness,
}: {
  wizard: WizardApi
  touched: { namaBisnis: boolean; jenisUsaha: boolean; alamat: boolean }
  setTouched: (t: { namaBisnis: boolean; jenisUsaha: boolean; alamat: boolean }) => void
  owner: { nama: string; email: string; password: string }
  ownerTouched: { nama: boolean; email: boolean; password: boolean }
  setOwnerTouched: (t: { nama: boolean; email: boolean; password: boolean }) => void
  onOwnerChange: (field: 'nama' | 'email' | 'password', value: string) => void
  sessionHasBusiness: boolean
}) {
  const { state, setField } = wizard
  const { namaBisnis, jenisUsaha, alamat } = state

  return (
    <section aria-labelledby="h-step-1">
      <h1 id="h-step-1" className="t-h1">
        Ceritakan tentang usaha Anda
      </h1>
      <p className="t-body-sm t-muted mt-1.5">
        Dipakai untuk kop slip gaji dan laporan. Semua bisa diubah nanti.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <TextField
          id="nama-bisnis"
          label="Nama bisnis"
          required
          value={namaBisnis}
          onChange={(e) => setField('namaBisnis', e.target.value)}
          onBlur={() => setTouched({ ...touched, namaBisnis: true })}
          placeholder="cth: Warung Kopi Nusantara"
          autoComplete="organization"
          error={
            touched.namaBisnis && namaBisnis.trim() === ''
              ? 'Nama bisnis wajib diisi.'
              : undefined
          }
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="jenis-usaha" className="t-label">
            Jenis usaha
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="jenis-usaha"
            value={jenisUsaha}
            onChange={(e) => setField('jenisUsaha', e.target.value)}
            onBlur={() => setTouched({ ...touched, jenisUsaha: true })}
            aria-invalid={touched.jenisUsaha && jenisUsaha === '' ? true : undefined}
            className={fieldClass}
          >
            <option value="">Pilih jenis usaha</option>
            {JENIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {touched.jenisUsaha && jenisUsaha === '' && (
            <p className="t-caption text-danger" role="alert">
              Pilih jenis usaha.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="alamat" className="t-label">
            Alamat
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="alamat"
            value={alamat}
            onChange={(e) => setField('alamat', e.target.value)}
            onBlur={() => setTouched({ ...touched, alamat: true })}
            rows={3}
            placeholder="cth: Jl. Melati No. 12, Jakarta Selatan"
            autoComplete="street-address"
            aria-invalid={touched.alamat && alamat.trim() === '' ? true : undefined}
            className={cn(fieldClass, 'min-h-[88px] resize-y')}
          />
          {touched.alamat && alamat.trim() === '' && (
            <p className="t-caption text-danger" role="alert">
              Alamat wajib diisi.
            </p>
          )}
        </div>

        <OwnerAccountSection
          nama={owner.nama}
          email={owner.email}
          password={owner.password}
          touched={ownerTouched}
          sessionHasBusiness={sessionHasBusiness}
          onChange={onOwnerChange}
          onBlur={(field) => setOwnerTouched({ ...ownerTouched, [field]: true })}
        />
      </div>
    </section>
  )
}

function typeChip(type: 'earning' | 'deduction') {
  return cn(
    'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
    type === 'earning' ? 'bg-success-container text-success-on' : 'bg-danger-container text-danger-on',
  )
}

function SalaryComponentsStep({ wizard, loading }: { wizard: WizardApi; loading: boolean }) {
  const { state, activeEarnings, toggleComponent } = wizard

  return (
    <section aria-labelledby="h-step-2">
      <h1 id="h-step-2" className="t-h1">
        Komponen gaji standar
      </h1>
      <p className="t-body-sm t-muted mt-1.5">
        Jadi nilai bawaan untuk karyawan baru. Bisa disesuaikan per orang.
      </p>

      {loading && (
        <div
          role="status"
          className="mt-6 flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-1 p-4"
        >
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
          />
          <p className="t-caption">Memuat komponen default…</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {state.components.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-1 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="t-label text-onsurface">{c.name}</p>
              <p className="t-caption mt-0.5">{c.description}</p>
            </div>
            <span className={typeChip(c.type)}>
              {c.type === 'earning' ? 'Pendapatan' : 'Potongan'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={c.enabled}
              aria-label={`${c.enabled ? 'Nonaktifkan' : 'Aktifkan'} ${c.name}`}
              onClick={() => toggleComponent(c.id)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-fast',
                  c.enabled ? 'bg-primary' : 'bg-surface-3',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-5 rounded-full bg-white shadow transition-transform duration-fast',
                    c.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                  )}
                />
              </span>
            </button>
          </div>
        ))}
      </div>

      {activeEarnings === 0 && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-accent-container bg-warning-container p-4"
        >
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="t-label text-warning-on">Belum ada komponen pendapatan aktif</p>
            <p className="t-caption mt-0.5">
              Payroll butuh minimal 1 komponen pendapatan. Anda bisa lanjut dan
              mengaturnya nanti di menu Pengaturan.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function ConfirmationStep({
  wizard,
  onComplete,
  setupError,
  completing,
  ownerEmail,
}: {
  wizard: WizardApi
  onComplete: () => void
  setupError: Error | null
  completing: boolean
  ownerEmail: string | null
}) {
  const { state } = wizard
  const enabled = state.components.filter((c) => c.enabled)

  return (
    <section aria-labelledby="h-step-3">
      <h1 id="h-step-3" className="t-h1">
        Periksa kembali
      </h1>
      <p className="t-body-sm t-muted mt-1.5">
        Setelah selesai, Anda langsung bisa menambahkan karyawan.
      </p>

      {setupError && (
        <div className="mt-4">
          <ErrorSurface
            error={setupError}
            onRetry={onComplete}
          />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-1">
          <div className="border-b border-outline-variant px-4 py-3">
            <h2 className="t-h3">Profil usaha</h2>
          </div>
          <dl className="text-[13.5px]">
            <SummaryRow label="Nama bisnis" value={state.namaBisnis} />
            <SummaryRow label="Jenis usaha" value={jenisLabel(state.jenisUsaha)} />
            <SummaryRow label="Alamat" value={state.alamat} />
            {ownerEmail && <SummaryRow label="Email akun" value={ownerEmail} />}
          </dl>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-1">
          <div className="border-b border-outline-variant px-4 py-3">
            <h2 className="t-h3">Komponen gaji aktif</h2>
          </div>
          {enabled.length > 0 ? (
            <ul className="flex flex-col">
              {enabled.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 border-t border-outline-variant px-4 py-2.5 first:border-t-0"
                >
                  <span className="text-[13.5px] font-medium">{c.name}</span>
                  <span className={typeChip(c.type)}>
                    {c.type === 'earning' ? 'Pendapatan' : 'Potongan'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-caption px-4 py-3">Belum ada komponen aktif.</p>
          )}
        </div>

        <Button size="lg" onClick={onComplete} className="mt-1 w-full" disabled={completing} aria-busy={completing}>
          {completing ? 'Menyimpan…' : 'Selesaikan Setup'}
        </Button>
      </div>
    </section>
  )
}

/**
 * /onboarding — 3-step setup wizard (UX-SPEC §3: pages 01/02 are standalone,
 * no AppShell). Centered card `max-w-2xl mx-auto` on bg-surface-1.
 */
export default function OnboardingPage() {
  const router = useRouter()
  const wizard = useWizard()
  const { state } = wizard
  const { user: authUser, applySession } = useAuth()
  const step = state.currentStep

  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [setupError, setSetupError] = useState<Error | null>(null)
  const [defaultsLoading, setDefaultsLoading] = useState(false)
  const [touched, setTouched] = useState({
    namaBisnis: false,
    jenisUsaha: false,
    alamat: false,
  })
  const [owner, setOwner] = useState({ nama: '', email: '', password: '' })
  const [ownerTouched, setOwnerTouched] = useState({ nama: false, email: false, password: false })
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Sign-up path already provisioned the business → reuse its id, no POST. */
  const sessionHasBusiness = Boolean(authUser?.business_id)

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!authUser) return
    setOwner((o) => ({
      ...o,
      nama: o.nama || authUser.nama,
      email: o.email || authUser.email,
    }))
  }, [authUser])

  // Fetch platform default components for step 2. A fresh visitor has no token
  // yet, so a 401 here simply falls back to the local default list.
  useEffect(() => {
    let active = true
    ;(async () => {
      setDefaultsLoading(true)
      try {
        const res = await api.get<{ components: BeSalaryComponent[] }>(
          '/api/salary-components',
          { defaults: 'true' },
        )
        if (!active) return
        if (Array.isArray(res.components) && res.components.length > 0) {
          wizard.setComponents(
            res.components.map((c) => ({
              id: c.id,
              beId: c.id,
              name: c.nama_komponen,
              type: c.tipe,
              description: c.formula
                ? 'Dihitung dari formula'
                : c.nominal != null
                  ? 'Nominal tetap'
                  : '',
              enabled: c.aktif,
            })),
          )
        }
      } catch {
        // No session during onboarding — keep the local defaults.
      } finally {
        if (active) setDefaultsLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ownerValid = useMemo(() => {
    if (sessionHasBusiness) return true
    return (
      owner.nama.trim() !== '' &&
      EMAIL_RE.test(owner.email.trim()) &&
      owner.password.length >= 8
    )
  }, [sessionHasBusiness, owner.nama, owner.email, owner.password])

  const handleOwnerChange = (field: 'nama' | 'email' | 'password', value: string) => {
    setOwner((o) => ({ ...o, [field]: value }))
  }

  const handleComplete = async () => {
    const enabled = wizard.state.components.filter((c) => c.enabled)
    setCompleting(true)
    setSetupError(null)
    try {
      let businessId: string
      if (sessionHasBusiness) {
        businessId = authUser?.business_id ?? ''
      } else {
        const res = await api.post<{ user: ApiUser; token: string; business: { id: string } }>(
          '/api/businesses',
          {
            nama_bisnis: state.namaBisnis,
            jenis_usaha: state.jenisUsaha,
            alamat: state.alamat,
            owner: { nama: owner.nama, email: owner.email.trim(), password: owner.password },
          },
        )
        applySession(res.user, res.token)
        businessId = res.business.id
      }

      // Mark the toggled subset as this business's default components. Rows
      // that came from the BE defaults already exist; local defaults must be
      // created first (their ids feed the PUT).
      if (enabled.length > 0) {
        const existingIds = enabled.filter((c) => c.beId).map((c) => c.beId as string)
        const createdIds: string[] = []
        for (const c of enabled.filter((c) => !c.beId)) {
          const draft = COMPONENT_DEFAULTS[c.id]
          if (!draft) continue
          const created = await api.post<{ component: { id: string } }>('/api/salary-components', {
            nama_komponen: draft.nama,
            tipe: draft.tipe,
            nominal: draft.nominal,
            formula: draft.formula,
            aktif: true,
          })
          createdIds.push(created.component.id)
        }
        await api.put(`/api/businesses/${businessId}/default-salary-components`, {
          component_ids: [...existingIds, ...createdIds],
        })
      }

      wizard.complete()
      setToast({ message: 'Setup selesai. Selamat datang di KaryawanKu.', tone: 'success' })
      redirectTimer.current = setTimeout(() => router.push('/dashboard'), 800)
    } catch (e) {
      setSetupError(e instanceof Error ? e : new Error(String(e)))
      setToast({ message: 'Gagal membuat workspace', tone: 'danger' })
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-1">
      <header className="sticky top-0 z-raised flex h-appbar items-center gap-2.5 border-b border-outline-variant bg-surface/90 px-4 backdrop-blur">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-[15px] font-bold text-primary-on">
          K
        </span>
        <span className="text-[16.5px] font-semibold tracking-tight">KaryawanKu</span>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-e1">
          <Stepper steps={WIZARD_STEPS} currentStep={step} />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="t-caption tabular-nums">Langkah {step + 1}/3</p>
            <p className="t-caption">Draf disimpan otomatis</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-e1">
          <div className="p-5 sm:p-6">
            {step === 0 && (
              <BusinessProfileStep
                wizard={wizard}
                touched={touched}
                setTouched={setTouched}
                owner={owner}
                ownerTouched={ownerTouched}
                setOwnerTouched={setOwnerTouched}
                onOwnerChange={handleOwnerChange}
                sessionHasBusiness={sessionHasBusiness}
              />
            )}
            {step === 1 && <SalaryComponentsStep wizard={wizard} loading={defaultsLoading} />}
            {step === 2 && (
              <ConfirmationStep
                wizard={wizard}
                onComplete={() => void handleComplete()}
                setupError={setupError}
                completing={completing}
                ownerEmail={owner.email || null}
              />
            )}
          </div>
          <StepFooter wizard={wizard} step0Valid={ownerValid} />
        </div>

        <p className="t-caption mt-4 text-center">
          Butuh bantuan setup?{' '}
          <a href="#" className="text-primary underline">
            Chat dukungan
          </a>
        </p>
      </main>

      {toast && (
        <div
          role="status"
          className={cn(
            'fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full px-5 py-3 text-sm font-medium shadow-e4',
            toast.tone === 'success'
              ? 'bg-success text-success-on'
              : 'bg-danger text-danger-on',
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
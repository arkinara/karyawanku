'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Stepper } from '@/components/ui/stepper'
import { TextField } from '@/components/ui/text-field'
import { cn } from '@/lib/cn'
import { WIZARD_STEPS, useWizard } from './use-wizard'
import type { WizardApi } from './use-wizard'

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
}

function StepFooter({ wizard }: StepFooterProps) {
  const step = wizard.state.currentStep
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
          <Button onClick={wizard.goNext} disabled={!wizard.stepValid[step]}>
            Lanjut
          </Button>
        )}
      </div>
    </footer>
  )
}

function BusinessProfileStep({
  wizard,
  touched,
  setTouched,
}: {
  wizard: WizardApi
  touched: { namaBisnis: boolean; jenisUsaha: boolean; alamat: boolean }
  setTouched: (t: { namaBisnis: boolean; jenisUsaha: boolean; alamat: boolean }) => void
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

function SalaryComponentsStep({ wizard }: { wizard: WizardApi }) {
  const { state, activeEarnings, toggleComponent } = wizard

  return (
    <section aria-labelledby="h-step-2">
      <h1 id="h-step-2" className="t-h1">
        Komponen gaji standar
      </h1>
      <p className="t-body-sm t-muted mt-1.5">
        Jadi nilai bawaan untuk karyawan baru. Bisa disesuaikan per orang.
      </p>

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

function ConfirmationStep({ wizard, onComplete }: { wizard: WizardApi; onComplete: () => void }) {
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

      <div className="mt-6 flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-1">
          <div className="border-b border-outline-variant px-4 py-3">
            <h2 className="t-h3">Profil usaha</h2>
          </div>
          <dl className="text-[13.5px]">
            <SummaryRow label="Nama bisnis" value={state.namaBisnis} />
            <SummaryRow label="Jenis usaha" value={jenisLabel(state.jenisUsaha)} />
            <SummaryRow label="Alamat" value={state.alamat} />
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

        <Button size="lg" onClick={onComplete} className="mt-1 w-full">
          Selesaikan Setup
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
  const step = state.currentStep

  const [toast, setToast] = useState<string | null>(null)
  const [touched, setTouched] = useState({
    namaBisnis: false,
    jenisUsaha: false,
    alamat: false,
  })
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  const handleComplete = () => {
    wizard.complete()
    setToast('Setup selesai. Selamat datang di KaryawanKu.')
    redirectTimer.current = setTimeout(() => router.push('/dashboard'), 800)
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
              <BusinessProfileStep wizard={wizard} touched={touched} setTouched={setTouched} />
            )}
            {step === 1 && <SalaryComponentsStep wizard={wizard} />}
            {step === 2 && <ConfirmationStep wizard={wizard} onComplete={handleComplete} />}
          </div>
          <StepFooter wizard={wizard} />
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
          className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full bg-success px-5 py-3 text-sm font-medium text-success-on shadow-e4"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
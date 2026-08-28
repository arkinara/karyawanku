'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, TextField } from '@/components/ui'
import { cn } from '@/lib/cn'
import { KONTRAK_LABEL, type Employee } from '@/lib/api-client'

/**
 * KaryawanKu — shared add/edit employee form (ticket #6, wired #53).
 *
 * One component drives both `/employees/new` (empty) and
 * `/employees/[id]/edit` (prefilled via `initialValues`). Types come from the
 * BE API contract (`@/lib/api-client`), not the retired mock. Validation runs
 * on blur, all messages in Bahasa Indonesia. Parent `onSubmit` performs the
 * real API call; BE field errors are injected back via `ServerFieldErrors`.
 */

export interface EmployeeFormValues {
  nama_lengkap: string
  tanggal_lahir: string
  jenis_kontrak: string
  tanggal_masuk: string
  alamat: string
  kontak_darurat: string
  no_ktp: string
  npwp: string
}

export interface EmployeeFormProps {
  initialValues?: Partial<Employee>
  onSubmit: (values: EmployeeFormValues) => Promise<void>
  onCancel: () => void
}

export type FieldErrors = Partial<Record<keyof EmployeeFormValues, string>>

/**
 * Throw this from `onSubmit` to render BE validation failures against the
 * matching form fields (duplicate KTP, invalid NPWP, bad date, …).
 */
export class ServerFieldErrors extends Error {
  readonly fieldErrors: FieldErrors

  constructor(fieldErrors: FieldErrors, message?: string) {
    super(message ?? 'Data karyawan tidak valid')
    this.name = 'ServerFieldErrors'
    this.fieldErrors = fieldErrors
  }
}

const KONTRAK_OPTIONS = ['PKWTT', 'PKWT', 'PKL', 'Magang', 'Harian']

const EMPTY_VALUES: EmployeeFormValues = {
  nama_lengkap: '',
  tanggal_lahir: '',
  jenis_kontrak: '',
  tanggal_masuk: '',
  alamat: '',
  kontak_darurat: '',
  no_ktp: '',
  npwp: '',
}

/** BE snake_case employee → form values (contract enums become display labels). */
function fromEmployee(e?: Partial<Employee>): EmployeeFormValues {
  if (!e) return EMPTY_VALUES
  return {
    nama_lengkap: e.nama_lengkap ?? '',
    tanggal_lahir: e.tanggal_lahir ?? '',
    jenis_kontrak: e.jenis_kontrak ? KONTRAK_LABEL[e.jenis_kontrak] : '',
    tanggal_masuk: e.tanggal_masuk ?? '',
    alamat: e.alamat ?? '',
    kontak_darurat: e.kontak_darurat ?? '',
    no_ktp: e.no_ktp ?? '',
    npwp: e.npwp ?? '',
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

/** True when `iso` is on or before today minus `years` (cutoff end-of-day). */
function ageAtLeast(iso: string, years: number): boolean {
  const birth = new Date(iso)
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - years)
  cutoff.setHours(23, 59, 59, 999)
  return birth.getTime() <= cutoff.getTime()
}

/** True when `iso` is not a future date (today inclusive, end-of-day). */
function notInFuture(iso: string): boolean {
  const date = new Date(iso)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date.getTime() <= today.getTime()
}

/** NPWP is exactly 15 digits in canonical `XX.XXX.XXX.X-XXX.XXX` form. */
function npwpValid(value: string): boolean {
  return /^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/.test(value)
}

export function validateEmployee(values: EmployeeFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (!values.nama_lengkap.trim()) errors.nama_lengkap = 'Nama lengkap wajib diisi'
  else if (values.nama_lengkap.trim().length < 3)
    errors.nama_lengkap = 'Nama lengkap minimal 3 karakter'

  if (!values.tanggal_lahir) errors.tanggal_lahir = 'Tanggal lahir wajib diisi'
  else if (!isIsoDate(values.tanggal_lahir)) errors.tanggal_lahir = 'Tanggal lahir tidak valid'
  else if (!ageAtLeast(values.tanggal_lahir, 17))
    errors.tanggal_lahir = 'Usia minimal 17 tahun untuk menjadi karyawan'

  if (!values.jenis_kontrak) errors.jenis_kontrak = 'Jenis kontrak wajib dipilih'

  if (!values.tanggal_masuk) errors.tanggal_masuk = 'Tanggal masuk wajib diisi'
  else if (!isIsoDate(values.tanggal_masuk)) errors.tanggal_masuk = 'Tanggal masuk tidak valid'
  else if (!notInFuture(values.tanggal_masuk))
    errors.tanggal_masuk = 'Tanggal masuk tidak boleh di masa depan'

  if (!values.alamat.trim()) errors.alamat = 'Alamat wajib diisi'
  else if (values.alamat.trim().length < 10) errors.alamat = 'Alamat minimal 10 karakter'

  if (!values.kontak_darurat.trim()) errors.kontak_darurat = 'Kontak darurat wajib diisi'
  else if (!/^[+]?[\d\s-]{8,}$/.test(values.kontak_darurat.trim()))
    errors.kontak_darurat = 'Format kontak darurat tidak valid (angka, +, spasi, atau dash)'

  if (!values.no_ktp.trim()) errors.no_ktp = 'Nomor KTP wajib diisi'
  else if (!/^\d{16}$/.test(values.no_ktp.trim()))
    errors.no_ktp = 'Nomor KTP harus 16 digit angka'

  if (values.npwp.trim() && !npwpValid(values.npwp.trim()))
    errors.npwp = 'Format NPWP tidak valid (contoh: 01.234.567.8-901.000)'

  return errors
}

function fieldError(key: keyof EmployeeFormValues, values: EmployeeFormValues): string | undefined {
  return validateEmployee(values)[key]
}

function RequiredMark() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden="true">
      *
    </span>
  )
}

function FieldMessage({ id, message, error }: { id: string; message?: string; error?: string }) {
  const text = error ?? message
  if (!text) return null
  return (
    <p id={id} className={cn('text-body-sm', error ? 'text-danger' : 'text-onsurface-variant')}>
      {text}
    </p>
  )
}

const selectClass = (hasError: boolean) =>
  cn(
    'h-11 w-full rounded-xl border bg-surface-1 px-4 text-sm text-onsurface',
    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
    hasError ? 'border-danger bg-danger/5' : 'border-outline-variant',
  )

const textareaClass = (hasError: boolean) =>
  cn(
    'w-full min-h-[44px] px-4 py-3 rounded-xl',
    'bg-surface-1 border border-outline-variant text-onsurface',
    'placeholder:text-onsurface-variant outline-none transition-colors',
    'focus:border-primary focus:ring-1 focus:ring-primary',
    hasError && 'border-danger bg-danger/5 focus:border-danger focus:ring-danger',
  )

export function EmployeeForm({ initialValues, onSubmit, onCancel }: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(() => fromEmployee(initialValues))
  const [touched, setTouched] = useState<Partial<Record<keyof EmployeeFormValues, boolean>>>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof EmployeeFormValues, value: string) => {
    setValues((v) => {
      const next = { ...v, [key]: value }
      if (touched[key]) {
        const err = fieldError(key, next)
        setErrors((prev) => {
          const merged = { ...prev }
          if (err) merged[key] = err
          else delete merged[key]
          return merged
        })
      }
      return next
    })
  }

  const touch = (key: keyof EmployeeFormValues) => {
    setTouched((t) => ({ ...t, [key]: true }))
    const err = fieldError(key, values)
    setErrors((prev) => {
      const merged = { ...prev }
      if (err) merged[key] = err
      else delete merged[key]
      return merged
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const errs = validateEmployee(values)
    setErrors(errs)
    setTouched({
      nama_lengkap: true,
      tanggal_lahir: true,
      jenis_kontrak: true,
      tanggal_masuk: true,
      alamat: true,
      kontak_darurat: true,
      no_ktp: true,
      npwp: true,
    })
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (e) {
      if (e instanceof ServerFieldErrors) {
        // BE validation failures render as field-level errors; touch every
        // field so the mapped messages are visible.
        setErrors((prev) => ({ ...prev, ...e.fieldErrors }))
        setTouched({
          nama_lengkap: true,
          tanggal_lahir: true,
          jenis_kontrak: true,
          tanggal_masuk: true,
          alamat: true,
          kontak_darurat: true,
          no_ktp: true,
          npwp: true,
        })
        return
      }
      throw e
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Data Pribadi</CardTitle>
          <CardDescription>Identitas dan perjanjian kerja karyawan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="nama_lengkap"
              label="Nama Lengkap"
              required
              value={values.nama_lengkap}
              onChange={(e) => set('nama_lengkap', e.target.value)}
              onBlur={() => touch('nama_lengkap')}
              error={errors.nama_lengkap}
              disabled={submitting}
              placeholder="Contoh: Budi Santoso"
              className="sm:col-span-2"
            />

            <TextField
              id="tanggal_lahir"
              label="Tanggal Lahir"
              type="date"
              required
              value={values.tanggal_lahir}
              onChange={(e) => set('tanggal_lahir', e.target.value)}
              onBlur={() => touch('tanggal_lahir')}
              error={errors.tanggal_lahir}
              helperText="Usia minimal 17 tahun"
              disabled={submitting}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="jenis_kontrak" className="t-label text-onsurface">
                Jenis Kontrak
                <RequiredMark />
              </label>
              <select
                id="jenis_kontrak"
                value={values.jenis_kontrak}
                onChange={(e) => set('jenis_kontrak', e.target.value)}
                onBlur={() => touch('jenis_kontrak')}
                aria-invalid={Boolean(errors.jenis_kontrak) || undefined}
                aria-describedby={errors.jenis_kontrak ? 'jenis_kontrak-message' : undefined}
                disabled={submitting}
                className={selectClass(Boolean(errors.jenis_kontrak))}
              >
                <option value="">Pilih jenis kontrak…</option>
                {KONTRAK_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <FieldMessage id="jenis_kontrak-message" error={errors.jenis_kontrak} />
            </div>

            <TextField
              id="tanggal_masuk"
              label="Tanggal Masuk"
              type="date"
              required
              value={values.tanggal_masuk}
              onChange={(e) => set('tanggal_masuk', e.target.value)}
              onBlur={() => touch('tanggal_masuk')}
              error={errors.tanggal_masuk}
              disabled={submitting}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kontak</CardTitle>
          <CardDescription>Alamat dan kontak darurat</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="alamat" className="t-label text-onsurface">
                Alamat
                <RequiredMark />
              </label>
              <textarea
                id="alamat"
                rows={3}
                value={values.alamat}
                onChange={(e) => set('alamat', e.target.value)}
                onBlur={() => touch('alamat')}
                aria-invalid={Boolean(errors.alamat) || undefined}
                aria-describedby={errors.alamat ? 'alamat-message' : undefined}
                disabled={submitting}
                placeholder="Contoh: Jl. Melati No. 12, Jakarta Selatan"
                className={textareaClass(Boolean(errors.alamat))}
              />
              <FieldMessage id="alamat-message" error={errors.alamat} />
            </div>

            <TextField
              id="kontak_darurat"
              label="Kontak Darurat"
              required
              value={values.kontak_darurat}
              onChange={(e) => set('kontak_darurat', e.target.value)}
              onBlur={() => touch('kontak_darurat')}
              error={errors.kontak_darurat}
              helperText="Format: +62 812-3456-7890"
              disabled={submitting}
              className="sm:col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dokumen</CardTitle>
          <CardDescription>Nomor identitas resmi karyawan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="no_ktp"
              label="Nomor KTP"
              required
              value={values.no_ktp}
              onChange={(e) => set('no_ktp', e.target.value)}
              onBlur={() => touch('no_ktp')}
              error={errors.no_ktp}
              helperText="16 digit angka"
              disabled={submitting}
            />

            <TextField
              id="npwp"
              label="NPWP"
              value={values.npwp}
              onChange={(e) => set('npwp', e.target.value)}
              onBlur={() => touch('npwp')}
              error={errors.npwp}
              helperText="Format: XX.XXX.XXX.X-XXX.XXX (opsional)"
              disabled={submitting}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="text" type="button" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" aria-busy={submitting} disabled={submitting}>
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}
'use client'

import { useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { Check, ChevronLeft, Pencil, Plus } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { StatusVariant } from '@/components/ui/status-chip'
import { getEmployeeById } from '@/lib/employees-mock'
import type { EmployeeDetail, EmployeeStatus } from '@/lib/employees-mock'
import { formatTanggal } from '@/lib/format'
import { cn } from '@/lib/cn'

const KONTRAK_VARIANT: Record<string, StatusVariant> = {
  PKWTT: 'info',
  PKWT: 'warning',
  PKL: 'success',
  Harian: 'neutral',
  Magang: 'danger',
}

const KONTRAK_OPTIONS = ['PKWTT', 'PKWT', 'PKL', 'Magang', 'Harian']
const JENIS_KELAMIN_OPTIONS = ['Laki-laki', 'Perempuan']

interface Draft {
  nama: string
  jabatan: string
  tanggalLahir: string
  jenisKelamin: string
  alamat: string
  kontakDarurat: string
  noKtp: string
  npwp: string
  tanggalMasuk: string
  jenisKontrak: string
}

type FieldErrors = Partial<Record<keyof Draft, string>>

function toDraft(e: EmployeeDetail): Draft {
  return {
    nama: e.nama,
    jabatan: e.jabatan,
    tanggalLahir: e.tanggalLahir,
    jenisKelamin: e.jenisKelamin,
    alamat: e.alamat,
    kontakDarurat: e.kontakDarurat,
    noKtp: e.noKtp,
    npwp: e.npwp,
    tanggalMasuk: e.tanggalMasuk,
    jenisKontrak: e.jenisKontrak,
  }
}

const EMPTY_DRAFT: Draft = {
  nama: '',
  jabatan: '',
  tanggalLahir: '',
  jenisKelamin: '',
  alamat: '',
  kontakDarurat: '',
  noKtp: '',
  npwp: '',
  tanggalMasuk: '',
  jenisKontrak: '',
}

function npwpValid(value: string): boolean {
  return value.replace(/[^0-9]/g, '').length === 15
}

function phoneValid(value: string): boolean {
  return /^\+?\d{6,20}$/.test(value.replace(/[\s.-]/g, ''))
}

function tanggalLahirValid(iso: string): boolean {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 17)
  cutoff.setHours(23, 59, 59, 999)
  return date.getTime() <= cutoff.getTime()
}

function validate(d: Draft): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.nama.trim()) errors.nama = 'Nama lengkap wajib diisi'
  if (!d.jabatan.trim()) errors.jabatan = 'Jabatan wajib diisi'
  if (!d.tanggalLahir) errors.tanggalLahir = 'Tanggal lahir wajib diisi'
  else if (!tanggalLahirValid(d.tanggalLahir))
    errors.tanggalLahir = 'Tanggal lahir tidak valid atau usia di bawah 17 tahun'
  if (!d.jenisKelamin) errors.jenisKelamin = 'Jenis kelamin wajib diisi'
  if (!d.alamat.trim()) errors.alamat = 'Alamat wajib diisi'
  if (!d.kontakDarurat.trim()) errors.kontakDarurat = 'Kontak darurat wajib diisi'
  else if (!phoneValid(d.kontakDarurat))
    errors.kontakDarurat = 'Format kontak darurat tidak valid (hanya angka, +, spasi, dan dash)'
  if (!/^\d{16}$/.test(d.noKtp.trim())) errors.noKtp = 'Nomor KTP harus 16 digit'
  if (!npwpValid(d.npwp.trim())) errors.npwp = 'NPWP harus 15 digit (format XX.XXX.XXX.X-XXX.XXX)'
  if (!d.tanggalMasuk) errors.tanggalMasuk = 'Tanggal masuk wajib diisi'
  if (!d.jenisKontrak) errors.jenisKontrak = 'Jenis kontrak wajib diisi'
  return errors
}

interface FieldDef {
  key: keyof Draft
  label: string
  type?: 'text' | 'date' | 'select'
  options?: string[]
  helperText?: string
  span?: 1 | 2
  readRender?: (value: string) => string
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-fast',
          checked ? 'bg-primary' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform duration-fast',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const employee = getEmployeeById(id)

  const [saved, setSaved] = useState<Draft>(() => (employee ? toDraft(employee) : EMPTY_DRAFT))
  const [draft, setDraft] = useState<Draft>(saved)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<EmployeeStatus>(employee?.status ?? 'aktif')

  const [customFields, setCustomFields] = useState(employee?.customFields ?? [])
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldValue, setFieldValue] = useState('')
  const [fieldError, setFieldError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [dialogError, setDialogError] = useState('')

  if (!employee) return notFound()

  const set = (key: keyof Draft, value: string) => setDraft((d) => ({ ...d, [key]: value }))

  const startEdit = () => {
    setDraft(saved)
    setErrors({})
    setEditing(true)
  }

  const saveEdit = () => {
    const errs = validate(draft)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaved(draft)
    setEditing(false)
  }

  const cancelEdit = () => {
    setDraft(saved)
    setErrors({})
    setEditing(false)
  }

  const startEditField = (key: string, value: string) => {
    setEditingField(key)
    setFieldValue(value)
    setFieldError('')
  }

  const saveCustomField = () => {
    const value = fieldValue.trim()
    if (!value) {
      setFieldError('Nilai field wajib diisi')
      return
    }
    setCustomFields((fields) => fields.map((f) => (f.key === editingField ? { ...f, value } : f)))
    setEditingField(null)
    setFieldValue('')
    setFieldError('')
  }

  const cancelCustomField = () => {
    setEditingField(null)
    setFieldValue('')
    setFieldError('')
  }

  const submitNewField = () => {
    const key = newKey.trim()
    const value = newValue.trim()
    if (!key) {
      setDialogError('Nama field wajib diisi')
      return
    }
    if (!value) {
      setDialogError('Nilai field wajib diisi')
      return
    }
    if (customFields.some((f) => f.key === key)) {
      setDialogError('Field dengan nama tersebut sudah ada')
      return
    }
    setCustomFields((fields) => [...fields, { key, value }])
    closeDialog()
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setNewKey('')
    setNewValue('')
    setDialogError('')
  }

  const renderField = (f: FieldDef) => {
    const value = draft[f.key]
    const spanClass = f.span === 2 ? 'sm:col-span-2' : undefined

    if (!editing) {
      return (
        <div key={f.key} className={spanClass}>
          <p className="t-caption text-onsurface-variant">{f.label}</p>
          <p className="mt-0.5 t-body text-onsurface tabular-nums">
            {f.readRender ? f.readRender(value) : value || '—'}
          </p>
        </div>
      )
    }

    if (f.type === 'select') {
      return (
        <label key={f.key} className={cn('flex flex-col gap-1.5', spanClass)}>
          <span className="t-label text-onsurface">{f.label}</span>
          <select
            value={value}
            onChange={(e) => set(f.key, e.target.value)}
            aria-invalid={Boolean(errors[f.key])}
            className={cn(
              'h-11 w-full rounded-xl border bg-surface-1 px-4 text-sm text-onsurface',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              errors[f.key] ? 'border-danger bg-danger/5' : 'border-outline-variant',
            )}
          >
            <option value="">Pilih…</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {errors[f.key] && <p className="text-body-sm text-danger">{errors[f.key]}</p>}
        </label>
      )
    }

    return (
      <TextField
        key={f.key}
        id={`std-${f.key}`}
        label={f.label}
        type={f.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => set(f.key, e.target.value)}
        error={errors[f.key]}
        helperText={f.helperText}
        className={spanClass}
      />
    )
  }

  const PRIBADI_FIELDS: FieldDef[] = [
    { key: 'nama', label: 'Nama Lengkap' },
    { key: 'jabatan', label: 'Jabatan' },
    { key: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date', readRender: formatTanggal },
    { key: 'jenisKelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_OPTIONS },
    { key: 'kontakDarurat', label: 'Kontak Darurat', helperText: 'Format: +62 812-3456-7890' },
    { key: 'alamat', label: 'Alamat', span: 2 },
  ]

  const LEGAL_FIELDS: FieldDef[] = [
    { key: 'noKtp', label: 'Nomor KTP', helperText: '16 digit' },
    { key: 'npwp', label: 'NPWP', helperText: 'Format: XX.XXX.XXX.X-XXX.XXX' },
  ]

  const KONTRAK_FIELDS: FieldDef[] = [
    { key: 'tanggalMasuk', label: 'Tanggal Masuk', type: 'date', readRender: formatTanggal },
    { key: 'jenisKontrak', label: 'Jenis Kontrak', type: 'select', options: KONTRAK_OPTIONS },
  ]

  return (
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Detail Karyawan"
      subtitle={employee.nik}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="icon"
            size="sm"
            aria-label="Kembali ke daftar karyawan"
            onClick={() => router.push('/employees')}
            className="mt-1 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="t-h1">{draft.nama}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip
                variant={status === 'aktif' ? 'success' : 'neutral'}
                label={status === 'aktif' ? 'Aktif' : 'Nonaktif'}
              />
              <StatusChip
                variant={KONTRAK_VARIANT[draft.jenisKontrak] ?? 'neutral'}
                label={draft.jenisKontrak || '—'}
              />
              <span className="t-caption text-onsurface-variant">
                {draft.jabatan} · {employee.nik}
              </span>
            </div>
          </div>
        </div>

        {!editing && (
          <Button
            variant="secondary"
            className="border border-outline-variant"
            onClick={startEdit}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Data Pribadi</CardTitle>
          <CardDescription>Identitas dan kontak karyawan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar name={draft.nama} size="lg" />
            <div className="min-w-0">
              <p className="t-h3">{draft.nama}</p>
              <p className="t-caption text-onsurface-variant">{draft.jabatan}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {PRIBADI_FIELDS.map(renderField)}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Dokumen Legal</CardTitle>
          <CardDescription>Nomor identitas resmi karyawan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">{LEGAL_FIELDS.map(renderField)}</div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Kontrak</CardTitle>
          <CardDescription>Perjanjian kerja dan status kepegawaian</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">{KONTRAK_FIELDS.map(renderField)}</div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-1 p-4">
            <div>
              <p className="t-label text-onsurface">Status Kepegawaian</p>
              <p className="t-caption mt-0.5">Ubah status aktif / nonaktif karyawan</p>
            </div>
            <Switch
              checked={status === 'aktif'}
              onChange={(v) => setStatus(v ? 'aktif' : 'nonaktif')}
              label="Status kepegawaian"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription>(spesifik bisnis Anda)</CardDescription>
        </CardHeader>
        <CardContent>
          {customFields.length === 0 ? (
            <p className="t-body-sm text-onsurface-variant">
              Belum ada custom field untuk karyawan ini. Tambahkan data spesifik bisnis Anda.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {customFields.map((f) => (
                <li key={f.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="t-caption text-onsurface-variant">{f.key}</p>
                      {editingField === f.key ? (
                        <div className="mt-2">
                          <TextField
                            id={`cf-${f.key}`}
                            label={f.key}
                            value={fieldValue}
                            onChange={(e) => setFieldValue(e.target.value)}
                            error={fieldError}
                            placeholder="Nilai field"
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <Button variant="primary" size="sm" onClick={saveCustomField}>
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Simpan
                            </Button>
                            <Button variant="text" size="sm" onClick={cancelCustomField}>
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditField(f.key, f.value)}
                          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        >
                          <span className="t-body text-onsurface">{f.value || '—'}</span>
                          <span className="t-caption block text-primary">Klik untuk edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <Button variant="text" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah Field
            </Button>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="text" onClick={cancelEdit}>
            Batal
          </Button>
          <Button variant="primary" onClick={saveEdit}>
            Simpan Perubahan
          </Button>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Tambah Custom Field"
        description="Tambahkan data spesifik bisnis untuk karyawan ini."
        footer={
          <>
            <Button variant="text" onClick={closeDialog}>
              Batal
            </Button>
            <Button variant="primary" onClick={submitNewField}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            id="cf-new-key"
            label="Nama field"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Contoh: Ukuran Seragam"
          />
          <TextField
            id="cf-new-value"
            label="Nilai"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Contoh: M"
          />
          {dialogError && <p className="text-body-sm text-danger">{dialogError}</p>}
        </div>
      </Dialog>
    </AppShell>
  )
}
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  AppShell,
  Button,
  DataTable,
  Dialog,
  ErrorSurface,
  LoadingSurface,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { cn } from '@/lib/cn'
import { JENIS_USAHA_OPTIONS } from '@/lib/settings-mock'
import type { BusinessProfile, CarryOverPolicy, LeaveTypeSetting, UserRole, WorkspaceUser } from '@/lib/settings-mock'
import { api } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { AuthGuard, OWNER_ONLY } from '@/lib/route-guard'
import { formatIDR } from '@/lib/format'
import { apiRequest } from '@/lib/api-client'
import type { BeLeaveTypeListResponse } from '@/lib/leave-adapter'

interface BeUser {
  id: string
  email: string
  nama: string
  role: 'owner' | 'manager' | 'employee'
  status: 'aktif' | 'nonaktif'
  employee_id: string | null
  created_at: string
}

interface BeUserListResponse {
  users: BeUser[]
  total: number
  limit: number
  offset: number
}

type TabKey = 'profile' | 'leave' | 'salary' | 'users'

const TABS: { key: TabKey; label: string; hash: string }[] = [
  { key: 'profile', label: 'Profil Bisnis', hash: '#profile' },
  { key: 'leave', label: 'Jenis Cuti', hash: '#leave' },
  { key: 'salary', label: 'Komponen Gaji', hash: '#salary' },
  { key: 'users', label: 'Pengguna', hash: '#users' },
]

function initialTab(): TabKey {
  if (typeof window === 'undefined') return 'profile'
  const hash = window.location.hash
  const found = TABS.find((t) => t.hash === hash)
  return found?.key ?? 'profile'
}

const fieldSelectClass = cn(
  'h-11 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 text-sm text-onsurface',
  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
)

function BusinessProfileTab() {
  const { user } = useAuth()
  const businessId = user?.business_id
  const [profile, setProfile] = useState<BusinessProfile>({
    namaBisnis: '',
    jenisUsaha: 'fnb',
    alamat: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [touched, setTouched] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    if (!businessId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{
        business: { nama_bisnis: string; jenis_usaha: BusinessProfile['jenisUsaha']; alamat: string | null }
      }>(`/api/businesses/${businessId}`)
      setProfile({
        namaBisnis: res.business.nama_bisnis,
        jenisUsaha: res.business.jenis_usaha,
        alamat: res.business.alamat ?? '',
      })
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const nameError = profile.namaBisnis.trim() === '' ? 'Nama bisnis wajib diisi' : undefined

  const save = async () => {
    if (profile.namaBisnis.trim() === '') {
      setTouched(true)
      return
    }
    if (!businessId) return
    setSaving(true)
    try {
      await api.patch(`/api/businesses/${businessId}`, {
        nama_bisnis: profile.namaBisnis,
        jenis_usaha: profile.jenisUsaha,
        alamat: profile.alamat,
      })
      setToast('Perubahan profil bisnis tersimpan.')
      setTimeout(() => setToast(null), 3000)
    } catch {
      // Global error toast fires via the api-client error bus.
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setTouched(false)
    void load()
  }

  if (loading) {
    return (
      <div>
        <LoadingSurface label="Memuat profil bisnis…" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <ErrorSurface error={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4">
        <TextField
          id="settings-nama-bisnis"
          label="Nama bisnis"
          required
          value={profile.namaBisnis}
          onChange={(e) => setProfile({ ...profile, namaBisnis: e.target.value })}
          error={touched ? nameError : undefined}
          placeholder="cth: Warung Kopi Nusantara"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-jenis-usaha" className="t-label text-onsurface">
            Jenis usaha
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="settings-jenis-usaha"
            value={profile.jenisUsaha}
            onChange={(e) => setProfile({ ...profile, jenisUsaha: e.target.value as BusinessProfile['jenisUsaha'] })}
            className={fieldSelectClass}
          >
            {JENIS_USAHA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-alamat" className="t-label text-onsurface">
            Alamat
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="settings-alamat"
            rows={3}
            value={profile.alamat}
            onChange={(e) => setProfile({ ...profile, alamat: e.target.value })}
            placeholder="cth: Jl. Melati No. 12, Jakarta Selatan"
            className={cn(fieldSelectClass, 'min-h-[88px] resize-y py-3')}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Button onClick={() => void save()} disabled={saving} aria-busy={saving}>
          {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </Button>
        <Button variant="text" onClick={reset}>
          Batal
        </Button>
      </div>

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

type PolicyKind = 'hangus' | 'carry-over'

function LeaveTypesTab() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveTypeSetting | null>(null)
  const [deleting, setDeleting] = useState<LeaveTypeSetting | null>(null)
  const [nama, setNama] = useState('')
  const [kuota, setKuota] = useState('')
  const [policy, setPolicy] = useState<PolicyKind>('hangus')
  const [maxHari, setMaxHari] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<BeLeaveTypeListResponse>('/api/leave-types', {
        query: { includeInactive: 'true' },
      })
      setLeaveTypes(
        res.leave_types.map((lt) => ({
          id: lt.id,
          nama: lt.nama_jenis_cuti,
          defaultKuotaHari: lt.default_kuota_hari,
          kebijakanSisa:
            lt.kebijakan_sisa === 'carry-over' && lt.carry_over_max_days !== null
              ? { type: 'carry-over', maxHari: lt.carry_over_max_days }
              : { type: 'hangus' },
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setNama('')
    setKuota('')
    setPolicy('hangus')
    setMaxHari('5')
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = (lt: LeaveTypeSetting) => {
    setEditing(lt)
    setNama(lt.nama)
    setKuota(String(lt.defaultKuotaHari))
    setPolicy(lt.kebijakanSisa.type)
    setMaxHari(lt.kebijakanSisa.type === 'carry-over' ? String(lt.kebijakanSisa.maxHari) : '5')
    setErrors({})
    setDialogOpen(true)
  }

  const save = async () => {
    const errs: Record<string, string> = {}
    const trimmed = nama.trim()
    if (!trimmed) errs.nama = 'Nama jenis cuti wajib diisi'
    const kuotaNum = Number(kuota)
    if (kuota.trim() === '' || !Number.isInteger(kuotaNum) || kuotaNum < 0) {
      errs.kuota = 'Kuota harus angka minimal 0'
    }
    const maxNum = Number(maxHari)
    if (policy === 'carry-over' && (!Number.isInteger(maxNum) || maxNum < 0)) {
      errs.maxHari = 'Carry-over harus angka minimal 0'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const body = {
      nama_jenis_cuti: trimmed,
      default_kuota_hari: kuotaNum,
      kebijakan_sisa: policy,
      carry_over_max_days: policy === 'carry-over' ? maxNum : null,
    }

    const optimistic: LeaveTypeSetting = {
      id: editing?.id ?? `tmp-${Date.now()}`,
      nama: trimmed,
      defaultKuotaHari: kuotaNum,
      kebijakanSisa:
        policy === 'carry-over' ? { type: 'carry-over', maxHari: maxNum } : { type: 'hangus' },
    }
    setLeaveTypes((prev) => {
      if (!editing) return [...prev, optimistic]
      return prev.map((lt) => (lt.id === editing.id ? optimistic : lt))
    })
    setDialogOpen(false)
    setEditing(null)
    try {
      if (editing && !editing.id.startsWith('tmp-')) {
        await apiRequest(`/api/leave-types/${editing.id}`, { method: 'PATCH', body })
      } else {
        await apiRequest('/api/leave-types', { method: 'POST', body })
      }
      void reload()
    } catch {
      // Silent — optimistic stays.
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    setLeaveTypes((prev) => prev.filter((lt) => lt.id !== target.id))
    setDeleting(null)
    try {
      await apiRequest(`/api/leave-types/${target.id}`, { method: 'DELETE' })
    } catch {
      // Silent.
    }
  }

  const columns: Array<DataTableColumn<LeaveTypeSetting>> = [
    { key: 'nama', label: 'Nama', sortable: true },
    { key: 'defaultKuotaHari', label: 'Default Kuota (hari)', numeric: true },
    {
      key: 'kebijakanSisa',
      label: 'Kebijakan Sisa',
      render: (lt) =>
        lt.kebijakanSisa.type === 'hangus' ? (
          <StatusChip variant="neutral" label="Hangus" />
        ) : (
          <StatusChip variant="info" label={`Carry-over max ${lt.kebijakanSisa.maxHari} hari`} />
        ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (lt) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="icon" size="sm" aria-label={`Edit ${lt.nama}`} onClick={() => openEdit(lt)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="sm" aria-label={`Hapus ${lt.nama}`} onClick={() => setDeleting(lt)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-caption tabular-nums">{leaveTypes.length} jenis cuti terdaftar</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Jenis Cuti
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <LoadingSurface label="Memuat jenis cuti…" />
        ) : (
          <DataTable columns={columns} rows={leaveTypes} rowKey={(lt) => lt.id} caption="Daftar jenis cuti" />
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Edit Jenis Cuti' : 'Tambah Jenis Cuti'}
        description="Atur jenis cuti dan kuota default untuk seluruh karyawan."
        footer={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void save()}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            id="lt-nama"
            label="Nama jenis cuti"
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            error={errors.nama}
            placeholder="cth: Cuti Tahunan"
          />
          <TextField
            id="lt-kuota"
            label="Default Kuota (hari)"
            required
            type="text"
            inputMode="numeric"
            value={kuota}
            onChange={(e) => setKuota(e.target.value)}
            error={errors.kuota}
            placeholder="0"
          />

          <div className="flex flex-col gap-1.5">
            <span className="t-label text-onsurface">Kebijakan sisa cuti tahun lalu</span>
            <div className="flex flex-wrap gap-2">
              {(['hangus', 'carry-over'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setPolicy(kind)}
                  aria-pressed={policy === kind}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    policy === kind
                      ? 'border-primary bg-primary text-primary-on'
                      : 'border-outline-variant bg-surface text-onsurface-variant',
                  )}
                >
                  {kind === 'hangus' ? 'Hangus' : 'Carry-over'}
                </button>
              ))}
            </div>
          </div>

          {policy === 'carry-over' && (
            <TextField
              id="lt-max"
              label="Maksimal carry-over (hari)"
              required
              type="text"
              inputMode="numeric"
              value={maxHari}
              onChange={(e) => setMaxHari(e.target.value)}
              error={errors.maxHari}
              placeholder="0"
            />
          )}
        </div>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Hapus Jenis Cuti"
        description={`Hapus jenis cuti ${deleting?.nama}? Tindakan ini tidak bisa dibatalkan.`}
        footer={
          <>
            <Button variant="text" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Hapus
            </Button>
          </>
        }
      />
    </div>
  )
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

type DefaultValueMode = 'fixed' | 'formula'

interface DefaultComponentDraft {
  nama: string
  tipe: 'earning' | 'deduction'
  nominal: number | null
  formula: string | null
}

function parseNominalInput(s: string): number | null {
  const cleaned = s.replace(/\./g, '').replace(',', '.')
  if (cleaned.trim() === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function DefaultComponentDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: BeSalaryComponent | null
  onClose: () => void
  onSave: (draft: DefaultComponentDraft) => void
}) {
  const [nama, setNama] = useState('')
  const [tipe, setTipe] = useState<'' | 'earning' | 'deduction'>('')
  const [mode, setMode] = useState<DefaultValueMode>('fixed')
  const [nominal, setNominal] = useState('')
  const [formula, setFormula] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setNama(initial?.nama_komponen ?? '')
    setTipe(initial?.tipe ?? '')
    setMode(initial && initial.formula ? 'formula' : 'fixed')
    setNominal(initial && initial.nominal != null ? String(initial.nominal) : '')
    setFormula(initial?.formula ?? '')
    setErrors({})
  }, [open, initial])

  const submit = () => {
    const errs: Record<string, string> = {}
    const trimmed = nama.trim()
    if (!trimmed) errs.nama = 'Nama komponen wajib diisi'
    if (!tipe) errs.tipe = 'Tipe komponen wajib dipilih'
    if (mode === 'fixed') {
      if (!nominal.trim()) errs.nominal = 'Nominal wajib diisi'
      else if (parseNominalInput(nominal) === null) errs.nominal = 'Nominal harus angka minimal 0'
    } else if (!formula.trim()) {
      errs.formula = 'Formula wajib diisi'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    onSave({
      nama: trimmed,
      tipe: tipe as 'earning' | 'deduction',
      nominal: mode === 'fixed' ? parseNominalInput(nominal) : null,
      formula: mode === 'formula' ? formula.trim() : null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Komponen Default' : 'Tambah Komponen Default'}
      description="Komponen default dipakai sebagai seed saat onboarding karyawan baru."
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          id="def-nama"
          label="Nama Komponen"
          required
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          error={errors.nama}
          placeholder="Contoh: Tunjangan Makan"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="def-tipe" className="t-label text-onsurface">
            Tipe
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="def-tipe"
            value={tipe}
            onChange={(e) => setTipe(e.target.value as 'earning' | 'deduction')}
            aria-invalid={Boolean(errors.tipe) || undefined}
            className={cn(fieldSelectClass, errors.tipe ? 'border-danger' : '')}
          >
            <option value="">Pilih tipe…</option>
            <option value="earning">Pendapatan</option>
            <option value="deduction">Potongan</option>
          </select>
          {errors.tipe && <p className="t-caption text-danger">{errors.tipe}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="t-label text-onsurface">Nilai</span>
          <div className="flex flex-wrap gap-2">
            {(['fixed', 'formula'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  mode === m
                    ? 'border-primary bg-primary text-primary-on'
                    : 'border-outline-variant bg-surface text-onsurface-variant',
                )}
              >
                {m === 'fixed' ? 'Nominal tetap' : 'Formula'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'fixed' ? (
          <TextField
            id="def-nominal"
            label="Nominal (Rp)"
            required
            inputMode="numeric"
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            error={errors.nominal}
            placeholder="0"
          />
        ) : (
          <TextField
            id="def-formula"
            label="Formula"
            required
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            error={errors.formula}
            helperText="Contoh: gaji_pokok * 0.01"
          />
        )}
      </div>
    </Dialog>
  )
}

function SalaryComponentsTab() {
  const { user } = useAuth()
  const businessId = user?.business_id
  const [components, setComponents] = useState<BeSalaryComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BeSalaryComponent | null>(null)
  const [deleting, setDeleting] = useState<BeSalaryComponent | null>(null)

  const reload = async (): Promise<void> => {
    if (!businessId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ components: BeSalaryComponent[] }>(
        `/api/businesses/${businessId}/default-salary-components`,
      )
      setComponents(res.components)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (c: BeSalaryComponent) => {
    setEditing(c)
    setDialogOpen(true)
  }

  const save = async (draft: DefaultComponentDraft) => {
    if (!businessId) return
    const body = {
      nama_komponen: draft.nama,
      tipe: draft.tipe,
      nominal: draft.formula ? null : draft.nominal,
      formula: draft.formula,
      aktif: true,
    }
    try {
      if (editing) {
        await api.patch(`/api/salary-components/${editing.id}`, body)
      } else {
        const created = await api.post<{ component: BeSalaryComponent }>(
          '/api/salary-components',
          body,
        )
        // The POST endpoint doesn't set is_default, so add the new row to the
        // business's default set explicitly.
        await api.put(`/api/businesses/${businessId}/default-salary-components`, {
          component_ids: [...components.map((c) => c.id), created.component.id],
        })
      }
      setDialogOpen(false)
      setEditing(null)
      void reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const confirmDelete = async () => {
    if (!deleting || !businessId) return
    try {
      await api.delete(`/api/salary-components/${deleting.id}`)
      const remaining = components.filter((c) => c.id !== deleting.id)
      // Remove it from the default set (PUT rejects an empty array).
      if (remaining.length > 0) {
        await api.put(`/api/businesses/${businessId}/default-salary-components`, {
          component_ids: remaining.map((c) => c.id),
        })
      }
      setDeleting(null)
      void reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const columns: Array<DataTableColumn<BeSalaryComponent>> = [
    {
      key: 'nama',
      label: 'Nama Komponen',
      sortable: true,
      render: (c) => <p className="font-medium text-onsurface">{c.nama_komponen}</p>,
    },
    {
      key: 'tipe',
      label: 'Tipe',
      render: (c) =>
        c.tipe === 'earning' ? (
          <StatusChip variant="success" label="Pendapatan" />
        ) : (
          <StatusChip variant="danger" label="Potongan" />
        ),
    },
    {
      key: 'nilai',
      label: 'Nominal / Formula',
      render: (c) =>
        c.formula ? (
          <span className="text-onsurface-variant">{c.formula}</span>
        ) : (
          <span className="tabular-nums text-onsurface">
            {c.nominal != null ? formatIDR(c.nominal) : '—'}
          </span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (c) =>
        c.aktif === true ? (
          <StatusChip variant="success" label="Aktif" />
        ) : (
          <StatusChip variant="neutral" label="Nonaktif" />
        ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="icon" size="sm" aria-label={`Edit ${c.nama_komponen}`} onClick={() => openEdit(c)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="sm" aria-label={`Hapus ${c.nama_komponen}`} onClick={() => setDeleting(c)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-caption mt-1 tabular-nums">{components.length} komponen default</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openCreate} disabled={loading}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Komponen
          </Button>
          <Link
            href="/salary-components"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-outline bg-surface px-5 text-sm font-medium text-primary shadow-e1 transition-all duration-fast ease-standard hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            Kelola Komponen Gaji
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <LoadingSurface label="Memuat komponen default…" />
        ) : (
          <DataTable
            columns={columns}
            rows={components}
            rowKey={(c) => c.id}
            caption="Daftar komponen gaji default"
            emptyState={
              <div className="px-6 py-12 text-center text-sm text-onsurface-variant">
                Belum ada komponen default.
              </div>
            }
          />
        )}
      </div>

      <DefaultComponentDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSave={(draft) => void save(draft)}
      />

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Hapus Komponen Default"
        description={`Hapus komponen ${deleting?.nama_komponen} dari daftar default? Tindakan ini tidak bisa dibatalkan.`}
        footer={
          <>
            <Button variant="text" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Hapus
            </Button>
          </>
        }
      />
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteNama, setInviteNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<BeUserListResponse>('/api/users')
      setUsers(
        res.users.map((u) => ({
          id: u.id,
          nama: u.nama,
          email: u.email,
          role: u.role,
          status: u.status,
          employeeId: u.employee_id,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const ownerCount = users.filter((u) => u.role === 'owner' && u.status === 'aktif').length

  const changeRole = async (id: string, next: UserRole) => {
    const current = users.find((u) => u.id === id)
    if (!current) return
    if (current.role === 'owner' && next === 'employee' && ownerCount <= 1) return
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: next } : u)))
    try {
      await apiRequest(`/api/users/${id}`, { method: 'PATCH', body: { role: next } })
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: current.role } : u)))
    }
  }

  const toggleStatus = async (id: string) => {
    const current = users.find((u) => u.id === id)
    if (!current) return
    if (current.role === 'owner' && current.status === 'aktif' && ownerCount <= 1) return
    const nextStatus = current.status === 'aktif' ? 'nonaktif' : 'aktif'
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)))
    try {
      await apiRequest(`/api/users/${id}`, { method: 'PATCH', body: { status: nextStatus } })
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: current.status } : u)))
    }
  }

  const openInvite = () => {
    setInviteNama('')
    setEmail('')
    setPassword('')
    setRole('employee')
    setErrors({})
    setInviteOpen(true)
  }

  const invite = async () => {
    const errs: Record<string, string> = {}
    const trimmed = email.trim()
    if (!trimmed) errs.email = 'Email wajib diisi'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) errs.email = 'Format email tidak valid'
    if (!password || password.length < 6) errs.password = 'Kata sandi minimal 6 karakter'
    if (!inviteNama.trim()) errs.nama = 'Nama wajib diisi'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: { email: trimmed, password, nama: inviteNama.trim(), role },
      })
      setInviteOpen(false)
      void reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const columns: Array<DataTableColumn<WorkspaceUser>> = [
    { key: 'nama', label: 'Nama', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      render: (u) =>
        u.role === 'owner' ? (
          <StatusChip variant="info" label="Owner" />
        ) : u.role === 'manager' ? (
          <StatusChip variant="warning" label="Manager" />
        ) : (
          <StatusChip variant="neutral" label="Employee" />
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (u) =>
        u.status === 'aktif' ? (
          <StatusChip variant="success" label="Aktif" />
        ) : (
          <StatusChip variant="neutral" label="Nonaktif" />
        ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-2">
          <select
            aria-label={`Ubah role ${u.nama}`}
            value={u.role}
            onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
            className={cn(fieldSelectClass, 'w-auto px-2 py-1 text-xs')}
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
          <Button variant="text" size="sm" onClick={() => toggleStatus(u.id)}>
            {u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-caption tabular-nums">{users.length} pengguna terdaftar</p>
        <Button onClick={openInvite}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Undang Pengguna
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <LoadingSurface label="Memuat pengguna…" />
        ) : (
          <DataTable columns={columns} rows={users} rowKey={(u) => u.id} caption="Daftar pengguna workspace" />
        )}
      </div>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Undang Pengguna"
        description="Buat akun pengguna baru di workspace ini."
        footer={
          <>
            <Button variant="text" onClick={() => setInviteOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void invite()}>Undang</Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            id="invite-nama"
            label="Nama"
            required
            value={inviteNama}
            onChange={(e) => setInviteNama(e.target.value)}
            error={errors.nama}
            placeholder="cth: Budi Santoso"
          />
          <TextField
            id="invite-email"
            label="Email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="nama@perusahaan.id"
          />
          <TextField
            id="invite-password"
            label="Kata sandi"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            helperText="Minimal 6 karakter"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className="t-label text-onsurface">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={fieldSelectClass}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>(initialTab)
  const { user } = useAuth()

  useEffect(() => {
    const found = TABS.find((t) => t.key === tab)
    if (found) window.history.replaceState(null, '', found.hash)
  }, [tab])

  return (
    <AuthGuard requiredRoles={OWNER_ONLY}>
      <AppShell
        userRole={user?.role ?? 'owner'}
        activeNav="settings"
        title="Pengaturan"
        subtitle="Warung Kopi Nusantara"
      >
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav
          aria-label="Pengaturan"
          className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-2xl border border-outline-variant bg-surface p-1 shadow-e1 lg:w-56 lg:flex-col"
        >
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary text-primary-on'
                    : 'text-onsurface-variant hover:bg-surface-2 hover:text-onsurface',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </nav>

        <section role="tabpanel" className="min-w-0 flex-1">
          {tab === 'profile' && <BusinessProfileTab />}
          {tab === 'leave' && <LeaveTypesTab />}
          {tab === 'salary' && <SalaryComponentsTab />}
          {tab === 'users' && <UsersTab />}
        </section>
      </div>
    </AppShell>
    </AuthGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { AppShell, Button, DataTable, Dialog, StatusChip, TextField } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  ACTIVE_SALARY_COMPONENTS,
  BUSINESS_PROFILE,
  JENIS_USAHA_OPTIONS,
  LEAVE_TYPE_SETTINGS,
  WORKSPACE_USERS,
  kebijakanSisaLabel,
} from '@/lib/settings-mock'
import type { BusinessProfile, CarryOverPolicy, LeaveTypeSetting, UserRole, WorkspaceUser } from '@/lib/settings-mock'

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
  const [profile, setProfile] = useState<BusinessProfile>(BUSINESS_PROFILE)
  const [touched, setTouched] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const error = profile.namaBisnis.trim() === '' ? 'Nama bisnis wajib diisi' : undefined

  const save = () => {
    if (profile.namaBisnis.trim() === '') {
      setTouched(true)
      return
    }
    setToast('Perubahan profil bisnis tersimpan.')
    setTimeout(() => setToast(null), 3000)
  }

  const reset = () => {
    setProfile(BUSINESS_PROFILE)
    setTouched(false)
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
          error={touched ? error : undefined}
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
        <Button onClick={save}>Simpan Perubahan</Button>
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeSetting[]>(LEAVE_TYPE_SETTINGS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveTypeSetting | null>(null)
  const [deleting, setDeleting] = useState<LeaveTypeSetting | null>(null)
  const [nama, setNama] = useState('')
  const [kuota, setKuota] = useState('')
  const [policy, setPolicy] = useState<PolicyKind>('hangus')
  const [maxHari, setMaxHari] = useState('5')
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const save = () => {
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

    const kebijakanSisa: CarryOverPolicy =
      policy === 'carry-over' ? { type: 'carry-over', maxHari: maxNum } : { type: 'hangus' }

    const next: LeaveTypeSetting = {
      id: editing?.id ?? `lt-${Date.now()}`,
      nama: trimmed,
      defaultKuotaHari: kuotaNum,
      kebijakanSisa,
    }
    setLeaveTypes((prev) => {
      const idx = prev.findIndex((lt) => lt.id === next.id)
      if (idx === -1) return [...prev, next]
      const arr = [...prev]
      arr[idx] = next
      return arr
    })
    setDialogOpen(false)
    setEditing(null)
  }

  const confirmDelete = () => {
    if (!deleting) return
    setLeaveTypes((prev) => prev.filter((lt) => lt.id !== deleting.id))
    setDeleting(null)
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

      <div className="mt-4">
        <DataTable columns={columns} rows={leaveTypes} rowKey={(lt) => lt.id} caption="Daftar jenis cuti" />
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
            <Button onClick={save}>Simpan</Button>
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
            <Button variant="danger" onClick={confirmDelete}>
              Hapus
            </Button>
          </>
        }
      />
    </div>
  )
}

function SalaryComponentsTab() {
  return (
    <div>
      <p className="t-caption mt-1 tabular-nums">{ACTIVE_SALARY_COMPONENTS} komponen aktif</p>
      <div className="mt-4 rounded-2xl border border-outline-variant bg-surface p-5 shadow-e1">
        <h2 className="t-h3">Komponen Gaji Default</h2>
        <p className="t-body-sm mt-1 text-onsurface-variant">
          Atur komponen gaji default di halaman Komponen Gaji. Komponen aktif dipakai sebagai
          seed saat onboarding karyawan baru.
        </p>
        <div className="mt-4">
          <a
            href="/salary-components"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-outline bg-surface px-5 text-sm font-medium text-primary shadow-e1 transition-all duration-fast ease-standard hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            Kelola Komponen Gaji
          </a>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<WorkspaceUser[]>(WORKSPACE_USERS)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const ownerCount = users.filter((u) => u.role === 'owner' && u.status === 'aktif').length

  const changeRole = (id: string, next: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u
        if (u.role === 'owner' && next === 'employee' && ownerCount <= 1) {
          return u
        }
        return { ...u, role: next }
      }),
    )
  }

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u
        if (u.role === 'owner' && u.status === 'aktif' && ownerCount <= 1) return u
        return { ...u, status: u.status === 'aktif' ? 'nonaktif' : 'aktif' }
      }),
    )
  }

  const openInvite = () => {
    setEmail('')
    setRole('employee')
    setErrors({})
    setInviteOpen(true)
  }

  const invite = () => {
    const errs: Record<string, string> = {}
    const trimmed = email.trim()
    if (!trimmed) errs.email = 'Email wajib diisi'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) errs.email = 'Format email tidak valid'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setUsers((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, nama: trimmed.split('@')[0], email: trimmed, role, status: 'aktif', employeeId: null },
    ])
    setInviteOpen(false)
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

      <div className="mt-4">
        <DataTable columns={columns} rows={users} rowKey={(u) => u.id} caption="Daftar pengguna workspace" />
      </div>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Undang Pengguna"
        description="Kirim undangan email dengan role tertentu ke workspace."
        footer={
          <>
            <Button variant="text" onClick={() => setInviteOpen(false)}>
              Batal
            </Button>
            <Button onClick={invite}>Undang</Button>
          </>
        }
      >
        <div className="space-y-4">
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

  useEffect(() => {
    const found = TABS.find((t) => t.key === tab)
    if (found) window.history.replaceState(null, '', found.hash)
  }, [tab])

  return (
    <AppShell
      userRole="owner"
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
  )
}

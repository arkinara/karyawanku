'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  SegmentedControl,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import type { StatusVariant } from '@/components/ui/status-chip'
import { MetricCard } from '@/components/dashboard/metric-card'
import { MetricGrid } from '@/components/dashboard/metric-grid'
import { useAuth } from '@/lib/auth-mock'
import {
  buildManualRecord,
  getTodayAttendance,
  summarizeAttendance,
  timeToDate,
} from '@/lib/attendance-mock'
import type { AttendanceRecord, ManualEntryInput } from '@/lib/attendance-mock'
import { computeStatus } from '@/lib/attendance-status'
import type { AttendanceStatus } from '@/lib/attendance-status'
import { OfflineQueue } from '@/lib/offline-queue'
import type { QueuedItem } from '@/lib/offline-queue'
import { EMPLOYEES } from '@/lib/employees-mock'
import { NAV } from '@/lib/nav-config'
import { cn } from '@/lib/cn'
import { formatJam } from '@/lib/format'

type Role = 'owner' | 'employee'

interface ClockEventPayload {
  employeeId: string
  type: 'clock-in' | 'clock-out'
  catatan?: string
}

const RANGES = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: '30 hari' },
]

const RANGE_LABEL: Record<string, string> = {
  today: 'hari ini',
  week: '7 hari terakhir',
  month: '30 hari terakhir',
}

const STATUS_VARIANT: Record<AttendanceStatus, StatusVariant> = {
  hadir: 'success',
  telat: 'warning',
  absen: 'danger',
  izin: 'info',
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  telat: 'Telat',
  absen: 'Absen',
  izin: 'Izin',
}

function readRoleParam(): Role | null {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'owner' || role === 'employee' ? role : null
}

function toIsoToday(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatTodayLong(): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function TimeCell({ value }: { value: string | null }) {
  return value ? (
    <span className="tabular-nums text-onsurface">{value} WIB</span>
  ) : (
    <span className="text-onsurface-variant">—</span>
  )
}

function OwnerView() {
  const [range, setRange] = useState('today')
  const [records, setRecords] = useState<AttendanceRecord[]>(() => getTodayAttendance())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)

  const summary = useMemo(() => summarizeAttendance(records), [records])

  const openManual = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (record: AttendanceRecord) => {
    setEditing(record)
    setDialogOpen(true)
  }

  const handleSubmit = (input: ManualEntryInput) => {
    setRecords((prev) => {
      const record = {
        ...buildManualRecord(input),
        id: editing?.id ?? `att-manual-${Date.now()}`,
      }
      if (!editing) return [record, ...prev]
      return prev.map((r) => (r.id === editing.id ? record : r))
    })
    setDialogOpen(false)
  }

  const columns: Array<DataTableColumn<AttendanceRecord>> = [
    {
      key: 'nama',
      label: 'Nama',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.nama} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-onsurface">{r.nama}</p>
            <p className="truncate text-xs text-onsurface-variant">{r.jabatan}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'clockIn',
      label: 'Clock In',
      render: (r) => <TimeCell value={r.clockIn} />,
    },
    {
      key: 'clockOut',
      label: 'Clock Out',
      render: (r) => <TimeCell value={r.clockOut} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <StatusChip variant={STATUS_VARIANT[r.status]} label={STATUS_LABEL[r.status]} />
      ),
    },
    {
      key: 'lateMinutes',
      label: 'Telat (menit)',
      numeric: true,
      render: (r) =>
        r.lateMinutes > 0 ? (
          <span className="tabular-nums text-onsurface">{r.lateMinutes} mnt</span>
        ) : (
          <span className="text-onsurface-variant">—</span>
        ),
    },
    {
      key: 'catatan',
      label: 'Catatan',
      render: (r) =>
        r.catatan ? (
          <span className="text-onsurface-variant">{r.catatan}</span>
        ) : (
          <span className="text-onsurface-variant">—</span>
        ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (r) => (
        <Button variant="icon" size="sm" aria-label={`Edit ${r.nama}`} onClick={() => openEdit(r)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const summaryMetrics = [
    { label: 'Hadir', value: summary.hadir, icon: CheckCircle2 },
    { label: 'Telat', value: summary.telat, icon: AlertTriangle },
    { label: 'Absen', value: summary.absen, icon: XCircle },
    { label: 'Izin', value: summary.izin, icon: CalendarCheck2 },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Absensi</h1>
          <p className="t-caption mt-1">
            {records.length} karyawan · {RANGE_LABEL[range]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={RANGES} value={range} onChange={setRange} aria-label="Rentang waktu" />
          <Button onClick={openManual}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Input Manual
          </Button>
        </div>
      </div>

      <div data-testid="attendance-summary" className="mt-4">
        <MetricGrid>
          {summaryMetrics.map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              icon={m.icon}
              caption={`${m.value} dari ${records.length} karyawan`}
            />
          ))}
        </MetricGrid>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(r) => r.id}
          caption="Absensi hari ini"
          emptyState={
            <EmptyState
              icon={Clock}
              title="Belum ada absensi hari ini"
              description="Absensi akan muncul di sini setelah karyawan clock in atau input manual."
            />
          }
        />
      </div>

      <ManualEntryDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}

interface ManualEntryDialogProps {
  open: boolean
  initial?: AttendanceRecord | null
  onClose: () => void
  onSubmit: (input: ManualEntryInput) => void
}

function ManualEntryDialog({ open, initial, onClose, onSubmit }: ManualEntryDialogProps) {
  const [employeeId, setEmployeeId] = useState('')
  const [empQuery, setEmpQuery] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [catatan, setCatatan] = useState('')
  const [errors, setErrors] = useState<{ employee?: string; clockIn?: string }>({})

  // Re-seed the form each time the dialog opens (create vs edit).
  useEffect(() => {
    if (!open) return
    setEmployeeId(initial?.employeeId ?? '')
    setEmpQuery('')
    setTanggal(initial?.tanggal ?? toIsoToday())
    setClockIn(initial?.clockIn ?? '')
    setClockOut(initial?.clockOut ?? '')
    setCatatan(initial?.catatan ?? '')
    setErrors({})
  }, [open, initial])

  const activeEmployees = useMemo(() => EMPLOYEES.filter((e) => e.status === 'aktif'), [])

  const filtered = useMemo(() => {
    const query = empQuery.trim().toLowerCase()
    if (!query) return activeEmployees
    return activeEmployees.filter((e) =>
      (e.nama + ' ' + e.nik + ' ' + e.jabatan).toLowerCase().includes(query),
    )
  }, [empQuery, activeEmployees])

  const selected = useMemo(() => EMPLOYEES.find((e) => e.id === employeeId), [employeeId])

  const preview = useMemo(() => {
    if (!clockIn) return null
    return computeStatus(timeToDate(new Date(), clockIn))
  }, [clockIn])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const errs: { employee?: string; clockIn?: string } = {}
    if (!employeeId) errs.employee = 'Pilih karyawan terlebih dahulu'
    if (!clockIn) errs.clockIn = 'Clock in wajib diisi'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSubmit({ employeeId, tanggal, clockIn, clockOut, catatan })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Input Absensi Manual"
      description="Koreksi atau tambah absensi untuk karyawan yang lupa clock in."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <p className="t-label text-onsurface">
            Pilih Karyawan
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </p>
          <div className="mt-1.5">
            <TextField
              id="emp-search"
              label="Cari karyawan"
              placeholder="Cari nama atau NIK…"
              value={empQuery}
              onChange={(e) => setEmpQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          <ul
            aria-label="Daftar karyawan"
            className="mt-2 max-h-44 overflow-auto rounded-xl border border-outline-variant bg-surface-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-onsurface-variant">Tidak ditemukan</li>
            ) : (
              filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEmployeeId(e.id)}
                    aria-pressed={e.id === employeeId}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors',
                      e.id === employeeId
                        ? 'bg-primary-container text-primary-oncontainer'
                        : 'text-onsurface hover:bg-surface-2',
                    )}
                  >
                    <Avatar name={e.nama} size="sm" />
                    <span className="min-w-0 truncate">{e.nama}</span>
                    <span className="ml-auto shrink-0 text-xs text-onsurface-variant">{e.nik}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {errors.employee && <p className="mt-1 text-body-sm text-danger">{errors.employee}</p>}
        </div>

        <TextField
          id="tanggal"
          label="Tanggal"
          type="date"
          required
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
        />

        <TextField
          id="clock-in"
          label="Clock In"
          type="time"
          required
          value={clockIn}
          onChange={(e) => setClockIn(e.target.value)}
          error={errors.clockIn}
        />

        <TextField
          id="clock-out"
          label="Clock Out"
          type="time"
          value={clockOut}
          onChange={(e) => setClockOut(e.target.value)}
          helperText="Opsional — kosongkan jika karyawan belum clock out"
        />

        <div className="rounded-xl bg-surface-2 px-4 py-3">
          {preview ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-onsurface-variant">Status otomatis</span>
              <StatusChip variant={STATUS_VARIANT[preview.status]} label={STATUS_LABEL[preview.status]} />
            </div>
          ) : (
            <p className="text-body-sm text-onsurface-variant">
              Tanpa clock in, status dianggap <strong>Absen</strong>.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="catatan" className="t-label text-onsurface">
            Catatan
          </label>
          <textarea
            id="catatan"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: izin datang telat karena urusan keluarga"
            className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 text-sm text-onsurface placeholder:text-onsurface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="text" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit">Simpan</Button>
        </div>
      </form>
    </Dialog>
  )
}

function EmployeeView() {
  const queue = useMemo(() => new OfflineQueue<ClockEventPayload>(), [])
  const [entries, setEntries] = useState<QueuedItem<ClockEventPayload>[]>(() => queue.getAll())
  const [offline, setOffline] = useState(() => queue.isOffline())
  const [catatan, setCatatan] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = queue.subscribe(() => {
      setEntries(queue.getAll())
      setOffline(queue.isOffline())
    })
    return unsubscribe
  }, [queue])

  // Live clock so the employee always sees the current time.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const selfName = NAV.employee.user.name
  const self = useMemo(
    () => EMPLOYEES.find((e) => e.nama === selfName) ?? EMPLOYEES[0],
    [selfName],
  )

  const active = useMemo(() => {
    const clockIns = entries.filter((e) => e.item.type === 'clock-in').length
    const clockOuts = entries.filter((e) => e.item.type === 'clock-out').length
    return clockIns > clockOuts
  }, [entries])

  const pendingCount = useMemo(
    () => entries.filter((e) => e.submittedAt === null).length,
    [entries],
  )

  const clockIn = () => {
    setError('')
    if (active) {
      setError('Sudah ada sesi aktif. Double clock in tidak diizinkan.')
      return
    }
    queue.enqueue({
      employeeId: self.id,
      type: 'clock-in',
      catatan: catatan.trim() || undefined,
    })
    setCatatan('')
  }

  const clockOut = () => {
    setError('')
    if (!active) {
      setError('Belum ada sesi aktif. Clock in terlebih dahulu.')
      return
    }
    queue.enqueue({ employeeId: self.id, type: 'clock-out' })
  }

  return (
    <div className="mx-auto max-w-xl">
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant bg-surface p-6 text-center shadow-e1">
        <StatusChip
          variant={active ? 'success' : 'neutral'}
          label={active ? 'Sedang bekerja' : 'Belum check-in'}
        />
        <p className="mt-4 text-[42px] font-bold leading-none tabular-nums text-onsurface">
          {formatJam(now)}
        </p>
        <p className="mt-1 text-sm text-onsurface-variant">WIB</p>

        <Button size="lg" className="mt-6 w-full" onClick={active ? clockOut : clockIn}>
          <Clock className="h-5 w-5" aria-hidden="true" />
          {active ? 'Clock Out' : 'Clock In'}
        </Button>

        {!active && (
          <div className="mt-4 text-left">
            <label htmlFor="catatan-in" className="t-label text-onsurface">
              Catatan (opsional)
            </label>
            <textarea
              id="catatan-in"
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: mulai shift pagi"
              className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 text-sm text-onsurface placeholder:text-onsurface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-onsurface-variant">
          {offline ? (
            <>
              <WifiOff className="h-4 w-4 text-warning" aria-hidden="true" />
              Mode offline — {pendingCount} entri menunggu sinkronisasi
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-success" aria-hidden="true" />
              Terhubung online
            </>
          )}
        </span>
        <Button variant="text" size="sm" onClick={() => queue.simulateOffline(!offline)}>
          {offline ? 'Kembali online' : 'Simulasi offline'}
        </Button>
      </div>

      <section className="mt-6" aria-labelledby="h-log">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="h-log" className="t-h2">
            Absensi Hari Ini
          </h2>
          {pendingCount > 0 && (
            <StatusChip variant="warning" label={`${pendingCount} menunggu sinkronisasi`} />
          )}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Belum ada absensi hari ini"
            description="Klik Clock In untuk mulai mencatat kehadiran."
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => {
              const event = entry.item
              const isIn = event.type === 'clock-in'
              const pending = entry.submittedAt === null
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface px-4 py-3"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      isIn ? 'bg-success' : 'bg-primary',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-onsurface">
                      {isIn ? 'Clock In' : 'Clock Out'}
                    </p>
                    {isIn && event.catatan && (
                      <p className="truncate text-xs text-onsurface-variant">{event.catatan}</p>
                    )}
                  </div>
                  {pending && <StatusChip variant="warning" label="Menunggu sinkronisasi" />}
                  <time
                    dateTime={entry.originalTimestamp}
                    className="text-sm tabular-nums text-onsurface-variant"
                  >
                    {formatJam(entry.originalTimestamp)} WIB
                  </time>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function AttendancePage() {
  const { user } = useAuth()
  const [paramRole] = useState(readRoleParam)
  const role: Role = paramRole ?? user?.role ?? 'owner'

  if (role === 'employee') {
    return (
      <AppShell
        userRole="employee"
        activeNav="attendance"
        title="Absensi"
        subtitle={NAV.employee.user.name}
      >
        <EmployeeView />
      </AppShell>
    )
  }

  return (
    <AppShell userRole="owner" activeNav="attendance" title="Absensi Hari Ini" subtitle={formatTodayLong()}>
      <OwnerView />
    </AppShell>
  )
}
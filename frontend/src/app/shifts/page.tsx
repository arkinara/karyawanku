'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  AppShell,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  ErrorSurface,
  LoadingSurface,
  StatusChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-context'
import { NAV } from '@/lib/nav-config'
import type { UserRole } from '@/lib/nav-config'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api-client'
import type { Employee } from '@/lib/api-client'
import { formatTanggal } from '@/lib/format'
import {
  type BeShift,
  type BeShiftAssignment,
  activeShifts,
  buildCellMatrix,
  DAY_LABELS,
  formatDayLong,
  formatWeekLabel,
  getEmployeeWeekShifts,
  getWeekStart,
  shiftWeek,
  SHIFT_NAMES,
  type ShiftName,
  weekDates,
  weekEndIso,
  weekPublishMeta,
} from '@/lib/shifts-adapter'
import { AuthGuard, ANY_ROLE, MANAGER_ROLES } from '@/lib/route-guard'
import { capabilitiesForRole } from '@/lib/role-capabilities'

function readRoleParam(): UserRole | null {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'owner' || role === 'manager' || role === 'employee' ? role : null
}

const SHIFT_COLOR: Record<string, string> = {
  Pagi: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  Siang: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  Malam: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Libur: 'bg-surface-2 text-onsurface-variant',
}

function ShiftBadge({ shift }: { shift: BeShift | null }) {
  const nama = shift?.nama_shift ?? 'Libur'
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-medium leading-tight',
        SHIFT_COLOR[nama],
      )}
    >
      <span>{shift?.nama_shift ?? 'Libur'}</span>
      {shift && <span className="text-[10px] opacity-80">{shift.jam_mulai}-{shift.jam_selesai}</span>}
    </span>
  )
}

function WeekNav({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="icon" size="sm" aria-label="Minggu sebelumnya" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="icon" size="sm" aria-label="Minggu berikutnya" onClick={onNext}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

interface ShiftDialogProps {
  open: boolean
  initial: BeShift | null
  onClose: () => void
  onSave: (body: { nama_shift: ShiftName; jam_mulai: string; jam_selesai: string; aktif: boolean }) => void
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function ShiftDialog({ open, initial, onClose, onSave }: ShiftDialogProps) {
  const [nama, setNama] = useState<ShiftName>('Pagi')
  const [mulai, setMulai] = useState('07:00')
  const [selesai, setSelesai] = useState('15:00')
  const [aktif, setAktif] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setNama(initial?.nama_shift ?? 'Pagi')
    setMulai(initial?.jam_mulai ?? '07:00')
    setSelesai(initial?.jam_selesai ?? '15:00')
    setAktif(initial?.aktif ?? true)
    setErrors({})
  }, [open, initial])

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!TIME_RE.test(mulai)) errs.mulai = 'Format jam wajib HH:MM'
    if (!TIME_RE.test(selesai)) errs.selesai = 'Format jam wajib HH:MM'
    else if (selesai < mulai) errs.selesai = 'Jam selesai harus lebih besar atau sama dengan jam mulai'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSave({ nama_shift: nama, jam_mulai: mulai, jam_selesai: selesai, aktif })
  }

  const fieldClass = cn(
    'h-11 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 text-sm text-onsurface',
    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Shift' : 'Tambah Shift'}
      description="Shift yang aktif tersedia sebagai pilihan di grid jadwal."
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit}>{initial ? 'Simpan' : 'Tambah'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="shift-nama" className="t-label text-onsurface">
            Nama shift
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="shift-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value as ShiftName)}
            className={fieldClass}
          >
            {SHIFT_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="shift-mulai" className="t-label text-onsurface">
              Jam mulai
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="shift-mulai"
              type="time"
              value={mulai}
              onChange={(e) => setMulai(e.target.value)}
              aria-invalid={Boolean(errors.mulai) || undefined}
              className={cn(fieldClass, errors.mulai ? 'border-danger' : '')}
            />
            {errors.mulai && <p className="t-caption text-danger">{errors.mulai}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="shift-selesai" className="t-label text-onsurface">
              Jam selesai
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="shift-selesai"
              type="time"
              value={selesai}
              onChange={(e) => setSelesai(e.target.value)}
              aria-invalid={Boolean(errors.selesai) || undefined}
              className={cn(fieldClass, errors.selesai ? 'border-danger' : '')}
            />
            {errors.selesai && <p className="t-caption text-danger">{errors.selesai}</p>}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-onsurface">
          <input
            type="checkbox"
            checked={aktif}
            onChange={(e) => setAktif(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Shift aktif
        </label>
      </div>
    </Dialog>
  )
}

type CellStatus = 'idle' | 'saving' | 'saved' | 'error'

interface BeUser {
  id: string
  nama: string
}

function OwnerView() {
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [matrix, setMatrix] = useState<ReturnType<typeof buildCellMatrix>>([])
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({})
  const [shifts, setShifts] = useState<BeShift[]>([])
  const [published, setPublished] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [publishedByUserId, setPublishedByUserId] = useState<string | null>(null)
  const [userNameById, setUserNameById] = useState<Map<string, string>>(new Map())
  const [pattern, setPattern] = useState('')
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<BeShift | null>(null)
  const [deletingShift, setDeletingShift] = useState<BeShift | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const loadWeek = useCallback(
    async (ws: string): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const [empRes, shiftsRes, assignmentsRes] = await Promise.all([
          api.get<{ items: Employee[] }>('/api/employees', { limit: 100 }),
          api.get<{ shifts: BeShift[] }>('/api/shifts', { includeInactive: 'true' }),
          api.get<{ items: BeShiftAssignment[] }>('/api/shift-assignments', {
            start: ws,
            end: weekEndIso(ws),
            limit: 100,
          }),
        ])
        // Only aktif employees get roster rows (nonaktif are filtered at FE).
        const roster = empRes.items.filter((e) => e.status === 'aktif')
        setEmployees(roster)
        setShifts(shiftsRes.shifts)
        setMatrix(buildCellMatrix(assignmentsRes.items, ws, roster))
        const meta = weekPublishMeta(assignmentsRes.items)
        setPublished(meta.published)
        setPublishedAt(meta.publishedAt)
        setPublishedByUserId(meta.publishedByUserId)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadWeek(weekStart)
  }, [weekStart, loadWeek])

  // Publisher names come from the workspace users API (best-effort).
  useEffect(() => {
    let cancelled = false
    api
      .get<{ items: BeUser[] }>('/api/users', { limit: 100 })
      .then((res) => {
        if (!cancelled) setUserNameById(new Map(res.items.map((u) => [u.id, u.nama])))
      })
      .catch(() => {
        // best-effort — the publisher line falls back to "pemilik"
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keep the pattern picker pointing at an active shift (survives catalogue edits).
  useEffect(() => {
    setPattern((prev) => {
      if (prev && activeShifts(shifts).some((s) => s.id === prev)) return prev
      return activeShifts(shifts)[0]?.id ?? ''
    })
  }, [shifts])

  // Re-fetch only the assignments so the grid stays authoritative without
  // flashing the full-page skeleton on every cell edit.
  const refreshAssignments = useCallback(
    async (ws: string): Promise<void> => {
      try {
        const res = await api.get<{ items: BeShiftAssignment[] }>('/api/shift-assignments', {
          start: ws,
          end: weekEndIso(ws),
          limit: 100,
        })
        setMatrix(buildCellMatrix(res.items, ws, employees))
        const meta = weekPublishMeta(res.items)
        setPublished(meta.published)
        setPublishedAt(meta.publishedAt)
        setPublishedByUserId(meta.publishedByUserId)
      } catch {
        // best-effort — the original save already committed optimistically
      }
    },
    [employees],
  )

  const navigate = (delta: number) => {
    setWeekStart(shiftWeek(weekStart, delta))
  }

  const goCurrent = () => {
    setWeekStart(getWeekStart())
  }

  const changeCell = async (empIdx: number, dayIdx: number, nextShiftId: string) => {
    const key = `${empIdx}:${dayIdx}`
    if (cellStatus[key] === 'saving') return
    const employee = employees[empIdx]
    const current = matrix[empIdx]?.[dayIdx]
    if (!employee || !current) return
    const nextId = nextShiftId === '' ? null : nextShiftId
    if (nextId === current.shiftId) return
    const tanggal = weekDates(weekStart)[dayIdx]

    // Optimistic local update — the spinner overlays the cell while saving.
    setMatrix((prev) =>
      prev.map((row, i) => (i === empIdx ? row.map((c, d) => (d === dayIdx ? { ...c, shiftId: nextId } : c)) : row)),
    )
    setCellStatus((prev) => ({ ...prev, [key]: 'saving' }))

    try {
      let newAssignmentId = current.assignmentId
      if (current.assignmentId && nextId === null) {
        await api.delete(`/api/shift-assignments/${current.assignmentId}`)
        newAssignmentId = null
      } else if (current.assignmentId && nextId !== null) {
        await api.patch(`/api/shift-assignments/${current.assignmentId}`, { shift_id: nextId })
      } else if (!current.assignmentId && nextId !== null) {
        const res = await api.post<{ assignment: BeShiftAssignment }>('/api/shift-assignments', {
          employee_id: employee.id,
          shift_id: nextId,
          tanggal,
        })
        newAssignmentId = res.assignment.id
      } else {
        // Libur on an empty cell — nothing to persist.
        setCellStatus((prev) => ({ ...prev, [key]: 'idle' }))
        return
      }
      setMatrix((prev) =>
        prev.map((row, i) =>
          i === empIdx ? row.map((c, d) => (d === dayIdx ? { ...c, assignmentId: newAssignmentId } : c)) : row,
        ),
      )
      setCellStatus((prev) => ({ ...prev, [key]: 'saved' }))
      window.setTimeout(() => setCellStatus((prev) => ({ ...prev, [key]: 'idle' })), 1500)
      void refreshAssignments(weekStart)
    } catch {
      // Revert on failure — never leave an optimistically-wrong value.
      setMatrix((prev) =>
        prev.map((row, i) =>
          i === empIdx
            ? row.map((c, d) =>
                d === dayIdx ? { assignmentId: current.assignmentId, shiftId: current.shiftId } : c,
              )
            : row,
        ),
      )
      setCellStatus((prev) => ({ ...prev, [key]: 'error' }))
      window.setTimeout(() => setCellStatus((prev) => ({ ...prev, [key]: 'idle' })), 2500)
    }
  }

  const applyPattern = async () => {
    if (!pattern || applying) return
    const target = shifts.find((s) => s.id === pattern)
    if (!target) return
    setApplying(true)
    setError(null)
    const dates = weekDates(weekStart)
    try {
      await Promise.all(
        employees.flatMap((emp, empIdx) =>
          dates.map((tanggal, dayIdx) => {
            const cell = matrix[empIdx]?.[dayIdx]
            if (!cell || cell.shiftId === target.id) return Promise.resolve()
            if (cell.assignmentId) {
              return api.patch(`/api/shift-assignments/${cell.assignmentId}`, { shift_id: target.id })
            }
            return api.post('/api/shift-assignments', {
              employee_id: emp.id,
              shift_id: target.id,
              tanggal,
            })
          }),
        ),
      )
      void loadWeek(weekStart)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setApplying(false)
    }
  }

  const publish = async () => {
    if (publishing || published) return
    setPublishing(true)
    setError(null)
    try {
      const res = await api.post<{
        updated: number
        published_at: string | null
        published_by_user_id: string
      }>('/api/roster/publish', { start: weekStart, end: weekEndIso(weekStart) })
      if (res.updated === 0) {
        showToast('Tidak ada penugasan untuk dipublikasikan pada minggu ini.')
      } else {
        setPublished(true)
        setPublishedAt(res.published_at)
        setPublishedByUserId(res.published_by_user_id)
        showToast('Jadwal dipublikasikan')
      }
    } catch (e) {
      // Stays draft — the global error toast explains the failure.
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setPublishing(false)
    }
  }

  const openCreateShift = () => {
    setEditingShift(null)
    setShiftDialogOpen(true)
  }

  const openEditShift = (s: BeShift) => {
    setEditingShift(s)
    setShiftDialogOpen(true)
  }

  const saveShift = async (body: { nama_shift: ShiftName; jam_mulai: string; jam_selesai: string; aktif: boolean }) => {
    try {
      if (editingShift) {
        await api.patch(`/api/shifts/${editingShift.id}`, body)
      } else {
        await api.post('/api/shifts', body)
      }
      setShiftDialogOpen(false)
      setEditingShift(null)
      showToast(editingShift ? 'Perubahan shift tersimpan.' : 'Shift baru ditambahkan.')
      void loadWeek(weekStart)
    } catch {
      // Global error toast fires via the api-client error bus.
    }
  }

  const deactivateShift = async () => {
    if (!deletingShift) return
    try {
      await api.delete(`/api/shifts/${deletingShift.id}`)
      setDeletingShift(null)
      showToast(`Shift ${deletingShift.nama_shift} dinonaktifkan.`)
      void loadWeek(weekStart)
    } catch {
      // Global error toast fires via the api-client error bus.
    }
  }

  const active = activeShifts(shifts)
  const publisherName =
    published && publishedByUserId
      ? (userNameById.get(publishedByUserId) ?? (publishedByUserId === user?.id ? 'Anda' : 'pemilik'))
      : null

  const statusFor = (empIdx: number, dayIdx: number): CellStatus => cellStatus[`${empIdx}:${dayIdx}`] ?? 'idle'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Jadwal Shift</h1>
          <p data-testid="week-label" className="t-caption mt-1">
            {formatWeekLabel(weekStart)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekNav onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
          <Button variant="tonal" size="sm" onClick={goCurrent}>
            Minggu ini
          </Button>
          <Button onClick={() => void publish()} disabled={published || publishing} aria-busy={publishing}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {publishing ? 'Mempublikasikan…' : published ? 'Telah Dipublikasikan' : 'Publikasikan Jadwal'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void loadWeek(weekStart)} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {published ? (
          <StatusChip variant="success" label="Dipublikasikan" />
        ) : (
          <StatusChip variant="warning" label="Draft" />
        )}
        <span className="text-sm text-onsurface-variant">
          {published
            ? `Jadwal dipublikasikan ${publishedAt ? `pada ${formatTanggal(publishedAt)}` : ''}${publisherName ? ` oleh ${publisherName}` : ''}.`
            : 'Jadwal draft hanya terlihat oleh Anda.'}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-1 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-onsurface-variant">
          <span className="t-caption">Pola shift</span>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            aria-label="Pilih pola shift"
            disabled={active.length === 0}
            className="h-9 rounded-full border border-outline-variant bg-surface-2 px-3 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama_shift} {s.jam_mulai}-{s.jam_selesai}
              </option>
            ))}
          </select>
        </label>
        <Button variant="tonal" size="sm" onClick={() => void applyPattern()} disabled={!pattern || applying} aria-busy={applying}>
          {applying ? 'Menerapkan…' : 'Terapkan pola ke semua'}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        <div>
          {loading ? (
            <LoadingSurface label="Memuat jadwal…" />
          ) : active.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant bg-surface shadow-e1">
              <EmptyState
                icon={CalendarDays}
                title="Belum ada shift aktif"
                description="Tambahkan shift di kartu Kelola Shift agar bisa menyusun jadwal mingguan."
                action={
                  <Button size="sm" onClick={openCreateShift}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Tambah Shift
                  </Button>
                }
              />
            </div>
          ) : (
            <div data-testid="shift-grid" className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface shadow-e1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 whitespace-nowrap border-b border-outline-variant bg-surface-1 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-onsurface-variant"
                    >
                      Karyawan
                    </th>
                    {DAY_LABELS.map((day) => (
                      <th
                        key={day}
                        scope="col"
                        className="whitespace-nowrap border-b border-outline-variant bg-surface-1 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-onsurface-variant"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, empIdx) => {
                    const employee = employees[empIdx]
                    if (!employee) return null
                    return (
                      <tr key={employee.id} className="transition-colors hover:bg-surface-1">
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-outline-variant bg-surface px-4 py-2 align-middle">
                          <p className="font-medium text-onsurface">{employee.nama_lengkap}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-xs text-onsurface-variant">{employee.no_ktp}</span>
                            <StatusChip variant="success" label="Aktif" className="px-2 py-0.5 text-[10px]" />
                          </div>
                        </td>
                        {row.map((cell, dayIdx) => {
                          const status = statusFor(empIdx, dayIdx)
                          const cellShift = shifts.find((s) => s.id === cell.shiftId)
                          const color = SHIFT_COLOR[cellShift?.nama_shift ?? 'Libur'] ?? SHIFT_COLOR.Libur
                          return (
                            <td key={dayIdx} className="relative border-b border-outline-variant px-2 py-2 align-middle">
                              <select
                                value={cell.shiftId ?? ''}
                                onChange={(e) => void changeCell(empIdx, dayIdx, e.target.value)}
                                disabled={status === 'saving'}
                                aria-label={`Shift ${employee.nama_lengkap} ${DAY_LABELS[dayIdx]}`}
                                className={cn(
                                  'h-9 w-full min-w-[92px] cursor-pointer rounded-lg border-0 px-2 text-center text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary',
                                  status === 'saving' && 'opacity-50',
                                  color,
                                )}
                              >
                                <option value="">—</option>
                                {shifts.map((s) => (
                                  <option key={s.id} value={s.id} disabled={!s.aktif}>
                                    {s.nama_shift}
                                  </option>
                                ))}
                              </select>
                              {status !== 'idle' && (
                                <span
                                  data-testid={`cell-status-${empIdx}-${dayIdx}`}
                                  role="status"
                                  aria-label={
                                    status === 'saving' ? 'Menyimpan' : status === 'saved' ? 'Tersimpan' : 'Gagal menyimpan'
                                  }
                                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-surface/70"
                                >
                                  {status === 'saving' ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                                  ) : status === 'saved' ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
                                  )}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Card data-testid="shift-legend" className="mt-6 self-start">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Kelola Shift</CardTitle>
            <Button variant="icon" size="sm" aria-label="Tambah shift" onClick={openCreateShift}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {shifts.length === 0 ? (
              <p className="text-sm text-onsurface-variant">
                Belum ada shift. Tambahkan shift untuk mulai menyusun jadwal.
              </p>
            ) : (
              <ul className="space-y-2">
                {shifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'w-16 shrink-0 rounded-md px-2 py-1 text-center text-xs font-medium',
                          SHIFT_COLOR[s.nama_shift] ?? SHIFT_COLOR.Libur,
                        )}
                      >
                        {s.nama_shift}
                      </span>
                      <span className="truncate text-xs tabular-nums text-onsurface-variant">
                        {s.jam_mulai}-{s.jam_selesai}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.aktif ? (
                        <StatusChip variant="success" label="Aktif" className="px-2 py-0.5 text-[10px]" />
                      ) : (
                        <StatusChip variant="neutral" label="Nonaktif" className="px-2 py-0.5 text-[10px]" />
                      )}
                      <Button variant="icon" size="sm" aria-label={`Edit shift ${s.nama_shift}`} onClick={() => openEditShift(s)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="icon"
                        size="sm"
                        aria-label={`Hapus shift ${s.nama_shift}`}
                        onClick={() => setDeletingShift(s)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ShiftDialog
        open={shiftDialogOpen}
        initial={editingShift}
        onClose={() => {
          setShiftDialogOpen(false)
          setEditingShift(null)
        }}
        onSave={(body) => void saveShift(body)}
      />

      <Dialog
        open={deletingShift !== null}
        onClose={() => setDeletingShift(null)}
        title="Hapus Shift"
        description={`Nonaktifkan shift ${deletingShift?.nama_shift}? Shift tidak akan tersedia sebagai pilihan baru di grid jadwal.`}
        footer={
          <>
            <Button variant="text" onClick={() => setDeletingShift(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void deactivateShift()}>
              Nonaktifkan
            </Button>
          </>
        }
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full bg-success px-5 py-3 text-sm font-medium text-success-on shadow-e4"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function EmployeeView() {
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [weekShifts, setWeekShifts] = useState<(BeShift | null)[]>(() =>
    Array.from({ length: 7 }, () => null),
  )
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadWeek = useCallback(
    async (ws: string): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const empRes = await api.get<{ items: Employee[] }>('/api/employees', { limit: 100 })
        // Prefer the session's employee link; demo fallback matches the nav user.
        const employeeId =
          user?.employee_id ??
          empRes.items.find((e) => e.nama_lengkap === NAV.employee.user.name)?.id ??
          empRes.items[0]?.id
        if (!employeeId) {
          setWeekShifts(Array.from({ length: 7 }, () => null))
          setPublished(false)
          return
        }
        const res = await api.get<{ items: BeShiftAssignment[] }>('/api/shift-assignments', {
          start: ws,
          end: weekEndIso(ws),
          employee_id: employeeId,
          limit: 100,
        })
        setWeekShifts(getEmployeeWeekShifts(res.items, employeeId, ws))
        setPublished(weekPublishMeta(res.items).published)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setLoading(false)
      }
    },
    [user?.employee_id],
  )

  useEffect(() => {
    void loadWeek(weekStart)
  }, [weekStart, loadWeek])

  const navigate = (delta: number) => {
    setWeekStart(shiftWeek(weekStart, delta))
  }

  const goCurrent = () => {
    setWeekStart(getWeekStart())
  }

  const dates = weekDates(weekStart)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Jadwal Saya</h1>
          <p data-testid="week-label" className="t-caption mt-1">
            {formatWeekLabel(weekStart)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekNav onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
          <Button variant="tonal" size="sm" onClick={goCurrent}>
            Minggu ini
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void loadWeek(weekStart)} />
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Shift Minggu Ini</CardTitle>
          <p className="text-sm text-onsurface-variant">
            {published
              ? 'Jadwal yang sudah dipublikasikan oleh pemilik.'
              : 'Jadwal minggu ini belum dipublikasikan.'}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSurface label="Memuat jadwal…" />
          ) : !published ? (
            <EmptyState
              icon={CalendarDays}
              title="Tidak ada shift terjadwal minggu ini"
              description="Jadwal akan muncul di sini setelah pemilik mempublikasikan roster minggu ini."
            />
          ) : (
            <ul className="divide-y divide-outline-variant" data-testid="my-shifts">
              {dates.map((iso, day) => (
                <li key={iso} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-onsurface">{DAY_LABELS[day]}</p>
                    <time dateTime={iso} className="text-xs text-onsurface-variant">
                      {formatDayLong(iso)}
                    </time>
                  </div>
                  <ShiftBadge shift={weekShifts[day]} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ShiftsPage() {
  const { user } = useAuth()
  const [paramRole] = useState(readRoleParam)
  const role: UserRole = paramRole ?? user?.role ?? 'owner'
  const canPublish = capabilitiesForRole(role).canPublishRoster

  if (!canPublish) {
    return (
      <AuthGuard requiredRoles={ANY_ROLE}>
        <AppShell
          userRole={role}
          activeNav="shifts"
          title="Jadwal Saya"
          subtitle={NAV.employee.user.name}
        >
          <EmployeeView />
        </AppShell>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard requiredRoles={MANAGER_ROLES}>
      <AppShell
        userRole={role}
        activeNav="shifts"
        title="Jadwal Shift"
        subtitle={formatWeekLabel(getWeekStart())}
      >
        <OwnerView />
      </AppShell>
    </AuthGuard>
  )
}
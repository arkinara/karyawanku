'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Send } from 'lucide-react'
import {
  AppShell,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  StatusChip,
} from '@/components/ui'
import { useAuth } from '@/lib/auth-mock'
import { EMPLOYEES } from '@/lib/employees-mock'
import { NAV } from '@/lib/nav-config'
import { cn } from '@/lib/cn'
import {
  DAY_LABELS,
  SHIFTS,
  SHIFT_OPTIONS,
  applyPatternToWeek,
  formatDayLong,
  formatWeekLabel,
  getEmployeeShifts,
  getWeekShifts,
  getWeekStart,
  isWeekPublished,
  publishWeek,
  setShift,
  shiftWeek,
} from '@/lib/shifts-mock'
import type { ShiftKey } from '@/lib/shifts-mock'

type Role = 'owner' | 'employee'

function readRoleParam(): Role | null {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'owner' || role === 'employee' ? role : null
}

/** Shift picker / badge color roles (dark aware). */
const SHIFT_COLOR: Record<ShiftKey, string> = {
  pagi: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  siang: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  malam: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  libur: 'bg-surface-2 text-onsurface-variant',
}

function ShiftBadge({ shift }: { shift: ShiftKey }) {
  const def = SHIFTS[shift]
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-medium leading-tight',
        SHIFT_COLOR[shift],
      )}
    >
      <span>{def.label}</span>
      {def.time && <span className="text-[10px] opacity-80">{def.time}</span>}
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

function Legend() {
  return (
    <Card data-testid="shift-legend" className="mt-6">
      <CardHeader>
        <CardTitle>Legenda Shift</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="space-y-2">
          {SHIFT_OPTIONS.map((def) => (
            <li key={def.key} className="flex items-center gap-2 text-sm">
              <span className={cn('w-16 rounded-md px-2 py-1 text-center text-xs font-medium', SHIFT_COLOR[def.key])}>
                {def.label}
              </span>
              <span className="text-onsurface-variant">{def.time ?? 'Libur'}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function OwnerView() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [matrix, setMatrix] = useState<ShiftKey[][]>(() => getWeekShifts(getWeekStart()))
  const [published, setPublished] = useState(() => isWeekPublished(getWeekStart()))
  const [pattern, setPattern] = useState<ShiftKey>('pagi')

  const currentWeek = getWeekStart()

  const navigate = (delta: number) => {
    const next = shiftWeek(weekStart, delta)
    setWeekStart(next)
    setMatrix(getWeekShifts(next))
    setPublished(isWeekPublished(next))
  }

  const goCurrent = () => {
    setWeekStart(currentWeek)
    setMatrix(getWeekShifts(currentWeek))
    setPublished(isWeekPublished(currentWeek))
  }

  const changeShift = (empIdx: number, dayIdx: number, value: ShiftKey) => {
    setShift(weekStart, EMPLOYEES[empIdx].id, dayIdx, value)
    setMatrix((prev) =>
      prev.map((row, i) => (i === empIdx ? row.map((c, d) => (d === dayIdx ? value : c)) : row)),
    )
  }

  const applyPattern = () => {
    applyPatternToWeek(weekStart, pattern)
    setMatrix(getWeekShifts(weekStart))
  }

  const publish = () => {
    publishWeek(weekStart)
    setPublished(true)
  }

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
          <Button onClick={publish} disabled={published}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {published ? 'Telah Dipublikasikan' : 'Publikasikan Jadwal'}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {published ? (
          <StatusChip variant="success" label="Dipublikasikan" />
        ) : (
          <StatusChip variant="warning" label="Draft" />
        )}
        <span className="text-sm text-onsurface-variant">
          {published
            ? 'Jadwal terlihat oleh seluruh karyawan.'
            : 'Jadwal draft hanya terlihat oleh Anda.'}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-1 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-onsurface-variant">
          <span className="t-caption">Pola shift</span>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value as ShiftKey)}
            aria-label="Pilih pola shift"
            className="h-9 rounded-full border border-outline-variant bg-surface-2 px-3 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SHIFT_OPTIONS.filter((o) => o.key !== 'libur').map((o) => (
              <option key={o.key} value={o.key}>
                {o.label} {o.time}
              </option>
            ))}
          </select>
        </label>
        <Button variant="tonal" size="sm" onClick={applyPattern}>
          Terapkan pola ke semua
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_220px]">
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
              {matrix.map((row, empIdx) => (
                <tr key={EMPLOYEES[empIdx].id} className="transition-colors hover:bg-surface-1">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-outline-variant bg-surface px-4 py-2 align-middle">
                    <p className="font-medium text-onsurface">{EMPLOYEES[empIdx].nama}</p>
                    <p className="text-xs text-onsurface-variant">{EMPLOYEES[empIdx].jabatan}</p>
                  </td>
                  {row.map((cell, dayIdx) => (
                    <td key={dayIdx} className="border-b border-outline-variant px-2 py-2 align-middle">
                      <select
                        value={cell}
                        onChange={(e) => changeShift(empIdx, dayIdx, e.target.value as ShiftKey)}
                        aria-label={`Shift ${EMPLOYEES[empIdx].nama} ${DAY_LABELS[dayIdx]}`}
                        className={cn(
                          'h-9 w-full min-w-[92px] cursor-pointer rounded-lg border-0 px-2 text-center text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary',
                          SHIFT_COLOR[cell],
                        )}
                      >
                        {SHIFT_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Legend />
      </div>
    </>
  )
}

function EmployeeView() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [published, setPublished] = useState(() => isWeekPublished(getWeekStart()))
  const [shifts, setShifts] = useState<ShiftKey[]>(() =>
    getEmployeeShifts(selfEmployeeId(), getWeekStart()),
  )

  const currentWeek = getWeekStart()

  const navigate = (delta: number) => {
    const next = shiftWeek(weekStart, delta)
    setWeekStart(next)
    setPublished(isWeekPublished(next))
    setShifts(getEmployeeShifts(selfEmployeeId(), next))
  }

  const goCurrent = () => {
    setWeekStart(currentWeek)
    setPublished(isWeekPublished(currentWeek))
    setShifts(getEmployeeShifts(selfEmployeeId(), currentWeek))
  }

  const dates = weekDatesOf(weekStart)

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
          {!published ? (
            <EmptyState
              icon={CalendarDays}
              title="Tidak ada shift terjadwal minggu ini"
              description="Jadwal akan muncul di sini setelah pemilik mempublikasikan roster minggu ini."
            />
          ) : (
            <ul className="divide-y divide-outline-variant" data-testid="my-shifts">
              {dates.map((iso, day) => (
                <li
                  key={iso}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-onsurface">{DAY_LABELS[day]}</p>
                    <time dateTime={iso} className="text-xs text-onsurface-variant">
                      {formatDayLong(iso)}
                    </time>
                  </div>
                  <ShiftBadge shift={shifts[day]} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Hoisted helpers kept tiny so the components above stay readable.
const selfEmployeeId = () => {
  const name = NAV.employee.user.name
  return EMPLOYEES.find((e) => e.nama === name)?.id ?? EMPLOYEES[0].id
}

function weekDatesOf(weekStart: string): string[] {
  const d = new Date(weekStart + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const copy = new Date(d)
    copy.setDate(d.getDate() + i)
    const month = String(copy.getMonth() + 1).padStart(2, '0')
    const day = String(copy.getDate()).padStart(2, '0')
    return `${copy.getFullYear()}-${month}-${day}`
  })
}

export default function ShiftsPage() {
  const { user } = useAuth()
  const [paramRole] = useState(readRoleParam)
  const role: Role = paramRole ?? user?.role ?? 'owner'

  if (role === 'employee') {
    return (
      <AppShell
        userRole="employee"
        activeNav="shifts"
        title="Jadwal Saya"
        subtitle={NAV.employee.user.name}
      >
        <EmployeeView />
      </AppShell>
    )
  }

  return (
    <AppShell
      userRole="owner"
      activeNav="shifts"
      title="Jadwal Shift"
      subtitle={formatWeekLabel(getWeekStart())}
    >
      <OwnerView />
    </AppShell>
  )
}

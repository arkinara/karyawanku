'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Plus,
  Users,
  Wallet,
} from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  ErrorSurface,
  Icon,
  LoadingSurface,
  PriorityBanner,
  SegmentedControl,
  StatusChip,
} from '@/components/ui'
import { MetricCard } from '@/components/dashboard/metric-card'
import { MetricGrid } from '@/components/dashboard/metric-grid'
import { apiRequest, ApiError, getStoredUser } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api-client'
import { formatIDR, formatJam, formatTanggal } from '@/lib/format'

const RANGES = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: '30 hari' },
]

interface OwnerDashboard {
  today_attendance: { hadir: number; telat: number; absen: number; izin: number }
  pending_leaves: Array<{
    id: string
    employee: { nama: string }
    leave_type: string
    tanggal_mulai: string
    tanggal_selesai: string
    alasan: string
    created_at: string | number
  }>
  upcoming_shifts: Array<{
    employee: { nama: string; avatar: string | null }
    shift: string
    tanggal: string
    jam_mulai: string
    jam_selesai: string
  }>
  payroll_summary: {
    current_month_total: number
    current_month_take_home: number
    last_run_periode: string | null
  }
  metrics: { total_karyawan: number; total_aktif: number }
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function indonesianDate(iso = todayIso()): string {
  const [y, m, d] = iso.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatIdr(n: number): string {
  return formatIDR(n)
}

interface EmployeeDashboardData {
  my_today: {
    clock_in: string | null
    clock_out: string | null
    status: string
    late_minutes: number | null
    catatan: string | null
  } | null
  upcoming_shifts: Array<{
    shift: string
    tanggal: string
    jam_mulai: string
    jam_selesai: string
  }>
  my_recent_payslips: Array<{ periode: string; take_home: number; pdf_url: string | null }>
}

function EmployeeDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<EmployeeDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<EmployeeDashboardData>('/api/dashboard')
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const myToday = data?.my_today ?? null
  const checkedIn = Boolean(myToday?.clock_in && !myToday?.clock_out)
  const employeeId = user?.employee_id

  const clock = async (type: 'clock-in' | 'clock-out') => {
    if (!employeeId || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/api/attendance/${type}`, {
        employee_id: employeeId,
        client_timestamp: new Date().toISOString(),
      })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      {loading && !data && (
        <div className="mt-4">
          <LoadingSurface label="Memuat ringkasan…" />
        </div>
      )}

      {data && (
        <>
          <section className="mt-4 rounded-2xl border border-outline-variant bg-surface p-6 text-center shadow-e1">
            <StatusChip
              variant={checkedIn ? 'success' : 'neutral'}
              label={checkedIn ? 'Sedang bekerja' : 'Belum check-in'}
            />
            <p className="mt-3 text-lg font-semibold text-onsurface">
              {myToday?.clock_in ? `Check-in sejak ${formatJam(myToday.clock_in)}` : 'Belum ada clock-in hari ini'}
            </p>
            <Button
              size="lg"
              className="mt-5 w-full max-w-sm"
              aria-busy={busy}
              disabled={busy}
              onClick={() => void clock(checkedIn ? 'clock-out' : 'clock-in')}
            >
              <Clock className="h-5 w-5" aria-hidden="true" />
              {checkedIn ? 'Clock Out' : 'Clock In'}
            </Button>
          </section>

          <section className="mt-4 rounded-2xl border border-outline-variant bg-surface p-5 shadow-e1" aria-labelledby="h-shifts">
            <h2 id="h-shifts" className="t-h2">
              Jadwal 3 Hari ke Depan
            </h2>
            {data.upcoming_shifts.length === 0 ? (
              <p className="mt-3 text-body-sm text-onsurface-variant">Tidak ada shift terjadwal.</p>
            ) : (
              <ul className="mt-3 divide-y divide-outline-variant">
                {data.upcoming_shifts.slice(0, 3).map((s, idx) => (
                  <li key={`${s.tanggal}-${idx}`} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-onsurface">{s.shift}</p>
                      <p className="text-xs tabular-nums text-onsurface-variant">
                        {formatTanggal(s.tanggal)} · {s.jam_mulai} – {s.jam_selesai}
                      </p>
                    </div>
                    <StatusChip variant="info" label={s.shift} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-2xl border border-outline-variant bg-surface p-5 shadow-e1" aria-labelledby="h-payslips">
            <h2 id="h-payslips" className="t-h2">
              Slip Gaji Terakhir
            </h2>
            {data.my_recent_payslips.length === 0 ? (
              <p className="mt-3 text-body-sm text-onsurface-variant">Belum ada slip gaji.</p>
            ) : (
              <ul className="mt-3 divide-y divide-outline-variant">
                {data.my_recent_payslips.map((p) => (
                  <li key={p.periode} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm text-onsurface">Periode {p.periode}</span>
                    <span className="tabular-nums font-semibold text-onsurface">{formatIdr(p.take_home)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="text" size="sm" className="mt-2" onClick={() => router.push('/payslips')}>
              Lihat semua slip gaji
            </Button>
          </section>
        </>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [range, setRange] = useState('today')
  const [data, setData] = useState<OwnerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { user: authUser } = useAuth()
  const user = authUser ?? getStoredUser()
  const greeting = user?.nama ? `Selamat pagi, ${user.nama}` : 'Selamat pagi, Pak Darmawan'

  const role = user?.role ?? 'owner'

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<OwnerDashboard>('/api/dashboard')
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || role !== 'owner') return
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const attendanceStats = useMemo(() => {
    const t = data?.today_attendance ?? { hadir: 0, telat: 0, absen: 0, izin: 0 }
    return [
      { count: t.hadir, label: 'Hadir', variant: 'success' as const },
      { count: t.telat, label: 'Telat', variant: 'warning' as const },
      { count: t.absen, label: 'Absen', variant: 'danger' as const },
      { count: t.izin, label: 'Izin', variant: 'info' as const },
    ]
  }, [data])

  const metrics = useMemo(() => {
    const m = data?.metrics
    const total = m?.total_karyawan ?? 0
    const aktif = m?.total_aktif ?? 0
    const att = data?.today_attendance ?? { hadir: 0, telat: 0, absen: 0, izin: 0 }
    const hadirToday = att.hadir
    const payrollTotal = data?.payroll_summary.current_month_total ?? 0
    const leavesPending = data?.pending_leaves.length ?? 0
    return [
      {
        label: 'Total karyawan',
        value: total,
        icon: Users,
        caption: `${aktif} aktif · ${total - aktif} nonaktif`,
        delta: { value: `${total} total`, trend: 'flat' as const },
      },
      {
        label: 'Hadir hari ini',
        value: hadirToday,
        unit: total > 0 ? `/${total}` : undefined,
        icon: CheckCircle2,
        caption: total > 0 ? `${Math.round((hadirToday / total) * 100)}% kehadiran` : 'Belum ada data',
        delta: { value: `${att.telat} telat`, trend: 'flat' as const },
      },
      {
        label: 'Cuti menunggu',
        value: leavesPending,
        icon: Calendar,
        caption: data?.pending_leaves[0]?.leave_type ?? 'Tidak ada pengajuan',
        delta: { value: `${leavesPending} pending`, trend: 'flat' as const },
      },
      {
        label: 'Gaji bulan ini',
        value: formatIdr(payrollTotal),
        icon: Wallet,
        caption: data?.payroll_summary.last_run_periode
          ? `Run terakhir ${data.payroll_summary.last_run_periode}`
          : 'Belum ada run bulan ini',
      },
    ]
  }, [data])

  if (role === 'employee') {
    return (
      <AppShell
        userRole="employee"
        activeNav="home"
        title={greeting}
        subtitle={user?.nama ?? 'Karyawan'}
      >
        <EmployeeDashboard />
      </AppShell>
    )
  }

  return (
    <AppShell
      userRole="owner"
      activeNav="dashboard"
      title={greeting}
      subtitle={`Warung Kopi Nusantara · ${indonesianDate()}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Ringkasan hari ini</h1>
          <p className="t-caption mt-1">{indonesianDate()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={RANGES}
            value={range}
            onChange={setRange}
            aria-label="Rentang waktu"
          />
          <Button variant="secondary" size="sm">
            <Icon name="download" size={16} />
            Unduh laporan
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="mt-4">
          <LoadingSurface label="Memuat ringkasan…" />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={reload} />
        </div>
      )}

      {data && (
        <>
          {data.pending_leaves.length > 0 && (
            <div className="mt-4">
              <PriorityBanner
                variant="warning"
                icon={AlertTriangle}
                title={`${data.pending_leaves.length} pengajuan cuti menunggu keputusan Anda`}
                description={`Paling lama menunggu ${
                  data.pending_leaves.length > 0 ? 'beberapa hari' : '0 hari'
                }. Karyawan tidak bisa mengatur jadwal sebelum disetujui.`}
                action={{ label: 'Tinjau', href: '/leave' }}
              />
            </div>
          )}

          <MetricGrid className="mt-4">
            {metrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                unit={m.unit}
                icon={m.icon}
                caption={m.caption}
                delta={m.delta}
              />
            ))}
          </MetricGrid>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section
              className="rounded-2xl border border-outline-variant bg-surface shadow-e1"
              aria-labelledby="h-attendance"
            >
              <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
                <div>
                  <h2 className="t-h2" id="h-attendance">
                    Kehadiran Hari Ini
                  </h2>
                  <p className="t-caption mt-0.5">Shift Pagi · 07:00 mulai</p>
                </div>
                <Button variant="text" size="sm" onClick={() => router.push('/attendance')}>
                  Semua
                </Button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {attendanceStats.map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col items-start gap-2 rounded-xl bg-surface-2 p-3"
                    >
                      <StatusChip variant={s.variant} label={s.label} />
                      <p className="text-[22px] font-bold leading-none tabular-nums text-onsurface">
                        {s.count}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="rounded-2xl border border-outline-variant bg-surface shadow-e1"
              aria-labelledby="h-leave"
            >
              <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
                <div>
                  <h2 className="t-h2" id="h-leave">
                    Cuti Menunggu Persetujuan
                  </h2>
                  <p className="t-caption mt-0.5">
                    {data.pending_leaves.length} pengajuan · urut dari yang paling lama
                  </p>
                </div>
                <Button variant="text" size="sm" onClick={() => router.push('/leave')}>
                  Lihat semua
                </Button>
              </div>

              <ul className="divide-y divide-outline-variant">
                {data.pending_leaves.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-center gap-3 p-5">
                    <Avatar name={l.employee.nama} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="t-h3">{l.employee.nama}</p>
                        <StatusChip
                          variant={l.leave_type.toLowerCase().includes('sakit') ? 'warning' : 'info'}
                          label={l.leave_type}
                        />
                      </div>
                      <p className="t-body-sm mt-1 tabular-nums">
                        {l.tanggal_mulai} – {l.tanggal_selesai}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="tonal"
                        size="sm"
                        onClick={() => router.push('/leave')}
                      >
                        Setujui
                      </Button>
                      <Button variant="text" size="sm" onClick={() => router.push('/leave')}>
                        Tolak
                      </Button>
                    </div>
                  </li>
                ))}
                {data.pending_leaves.length === 0 && (
                  <li className="p-5 text-center text-on-surface-variant">
                    Tidak ada cuti menunggu saat ini.
                  </li>
                )}
              </ul>
            </section>
          </div>

          <section className="mt-4" aria-labelledby="h-quick">
            <h2 className="t-h2" id="h-quick">
              Aksi cepat
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Rekap absensi', icon: Clock, href: '/attendance' },
                { label: 'Tambah karyawan', icon: Plus, href: '/employees' },
                { label: 'Jalankan payroll', icon: Wallet, href: '/payroll' },
              ].map((a) => {
                const IconCmp = a.icon
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-card p-4 transition hover:shadow-e2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary-oncontainer">
                      <IconCmp className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-onsurface-variant" />
                  </Link>
                )
              })}
            </div>
          </section>
        </>
      )}
    </AppShell>
  )
}
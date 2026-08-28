'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Button, ErrorSurface, LoadingSurface, StatusChip } from '@/components/ui'
import { api } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { formatIDR, formatJam, formatTanggal } from '@/lib/format'

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

export function EmployeeDashboard() {
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
                    <span className="tabular-nums font-semibold text-onsurface">{formatIDR(p.take_home)}</span>
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
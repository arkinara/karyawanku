'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, X } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  Dialog,
  EmptyState,
  ErrorSurface,
  LoadingSurface,
  SegmentedControl,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { getEmployeeById } from '@/lib/employees-mock'
import { formatIDR, formatTanggal } from '@/lib/format'
import {
  formatPeriode,
  payslipPendapatan,
  payslipPotongan,
} from '@/lib/payslips-mock'
import type { Payslip } from '@/lib/payslips-mock'
import { composePayslip, type BePayslipRow } from '@/lib/payslips-adapter'
import { apiRequest } from '@/lib/api-client'

const EMPLOYEE_ID = '2'

type YearFilter = 'semua' | '2026' | '2025'

const FILTER_OPTIONS: Array<{ value: YearFilter; label: string }> = [
  { value: 'semua', label: 'Semua' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
]

function slugName(nama: string): string {
  return nama.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/** Mock download: a plain text file with the payslip content. Real PDF is fetched from BE. */
function buildPayslipTxt(payslip: Payslip): string {
  const pendapatan = payslipPendapatan(payslip)
  const potongan = payslipPotongan(payslip)

  const lines = [
    'SLIP GAJI — KARYAWANKU',
    '=======================',
    `Nama: ${payslip.nama}`,
    `Jabatan: ${payslip.jabatan}`,
    `Periode: ${formatPeriode(payslip.period)}`,
    `Tanggal generate: ${formatTanggal(payslip.generatedAt)}`,
    '',
    'PENDAPATAN',
    `Gaji Pokok: ${formatIDR(payslip.gajiPokok)}`,
    ...payslip.tunjangan.map((t) => `${t.nama}: ${formatIDR(t.nominal)}`),
    `Total Pendapatan: ${formatIDR(pendapatan)}`,
    '',
    'POTONGAN',
    ...payslip.potongan.map((p) => `${p.nama}: ${formatIDR(p.nominal)}`),
    `Total Potongan: ${formatIDR(potongan)}`,
    '',
    `TAKE-HOME: ${formatIDR(payslip.takeHome)}`,
    '',
    'Slip gaji ini dihasilkan otomatis oleh sistem.',
  ]
  return lines.join('\n')
}

async function downloadPayslip(payslip: Payslip): Promise<void> {
  // Prefer the BE's authoritative PDF (when available).
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'}/api/payslips/${payslip.id}/download`,
    )
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `slip-gaji-${slugName(payslip.nama)}-${payslip.period}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }
  } catch {
    // Fall through to local fallback.
  }
  const text = buildPayslipTxt(payslip)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `slip-gaji-${slugName(payslip.nama)}-${payslip.period}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function ItemizedRows({ rows }: { rows: Array<{ nama: string; nominal: number }> }) {
  return (
    <ul className="divide-y divide-outline-variant">
      {rows.map((r) => (
        <li key={r.nama} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-onsurface-variant">{r.nama}</span>
          <span className="tabular-nums font-medium text-onsurface">{formatIDR(r.nominal)}</span>
        </li>
      ))}
    </ul>
  )
}

function BreakdownSection({
  title,
  total,
  className,
  children,
}: {
  title: string
  total: number
  className: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-2xl border p-4', className)}>
      <header className="mb-1 flex items-center justify-between gap-3">
        <h3 className="t-h3 text-onsurface">{title}</h3>
        <span className="tabular-nums text-sm font-bold">{formatIDR(total)}</span>
      </header>
      {children}
    </section>
  )
}

function PayslipDetailDialog({
  payslip,
  onClose,
}: {
  payslip: Payslip
  onClose: () => void
}) {
  const pendapatan = payslipPendapatan(payslip)
  const potongan = payslipPotongan(payslip)
  const periode = formatPeriode(payslip.period)

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Slip Gaji · ${periode}`}
      size="lg"
      header={
        <>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              Slip Gaji · {periode}
            </h2>
            <p className="mt-0.5 text-sm text-onsurface-variant tabular-nums">
              Digenerate {formatTanggal(payslip.generatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={() => void downloadPayslip(payslip)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Unduh PDF
            </Button>
            <Button variant="icon" size="sm" aria-label="Tutup" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </>
      }
    >
      <div className="-mx-1 max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant bg-surface-1 p-4">
          <Avatar name={payslip.nama} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-onsurface">{payslip.nama}</p>
            <p className="text-sm text-onsurface-variant">{payslip.jabatan}</p>
          </div>
          <dl className="ml-auto grid shrink-0 gap-x-8 gap-y-1 text-sm">
            <div>
              <dt className="t-caption text-onsurface-variant">Periode</dt>
              <dd className="tabular-nums font-medium text-onsurface">{periode}</dd>
            </div>
            <div>
              <dt className="t-caption text-onsurface-variant">Tanggal generate</dt>
              <dd className="tabular-nums font-medium text-onsurface">
                {formatTanggal(payslip.generatedAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <BreakdownSection
              title="Pendapatan"
              total={pendapatan}
              className="border-success/25 bg-success/5 text-success"
            >
              <ul className="divide-y divide-outline-variant">
                <li className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-onsurface-variant">Gaji Pokok</span>
                  <span className="tabular-nums font-medium text-onsurface">
                    {formatIDR(payslip.gajiPokok)}
                  </span>
                </li>
              </ul>
              <ItemizedRows rows={payslip.tunjangan} />
            </BreakdownSection>

            <BreakdownSection
              title="Potongan"
              total={potongan}
              className="border-danger/25 bg-danger/5 text-danger"
            >
              <ItemizedRows rows={payslip.potongan} />
            </BreakdownSection>
          </div>

          <div className="lg:col-span-1">
            <aside className="space-y-3 rounded-2xl border border-outline-variant bg-surface-2 p-4 lg:sticky lg:top-0">
              <div>
                <p className="t-caption text-onsurface-variant">Total Pendapatan</p>
                <p className="tabular-nums font-semibold text-onsurface">{formatIDR(pendapatan)}</p>
              </div>
              <div>
                <p className="t-caption text-onsurface-variant">Total Potongan</p>
                <p className="tabular-nums font-semibold text-danger">{formatIDR(potongan)}</p>
              </div>
              <div className="rounded-xl bg-primary-container px-4 py-4 text-center">
                <p className="t-caption text-primary-oncontainer">Take-home</p>
                <p
                  data-testid="take-home-summary"
                  className="tabular-nums text-3xl font-bold text-primary-oncontainer"
                >
                  {formatIDR(payslip.takeHome)}
                </p>
              </div>
            </aside>
          </div>
        </div>

        <p className="pt-1 text-center text-xs text-onsurface-variant">
          Slip gaji ini dihasilkan otomatis oleh sistem. Hubungi Owner untuk koreksi.
        </p>
      </div>
    </Dialog>
  )
}

export default function PayslipsPage() {
  const employee = getEmployeeById(EMPLOYEE_ID)
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [filter, setFilter] = useState<YearFilter>('semua')
  const [selected, setSelected] = useState<Payslip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<{ payslips: BePayslipRow[] }>('/api/payslips')
      // BE-only mode: each row already has the take_home; the component
      // breakdown requires fetching the underlying payroll run, which would
      // add N requests. We compose with no breakdown and let the viewer show
      // the take-home totals; the per-component view is a future enhancement.
      const composed = res.payslips.map((row) => composePayslip(row, null))
      setPayslips(composed)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    if (filter === 'semua') return payslips
    return payslips.filter((p) => p.period.startsWith(`${filter}-`))
  }, [payslips, filter])

  return (
    <AppShell
      userRole="employee"
      activeNav="payslip"
      title="Slip Gaji"
      subtitle={employee?.nama ?? 'Siti Nurhaliza'}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Slip Gaji</h1>
          <p className="t-caption mt-1 text-onsurface-variant">Riwayat slip gaji Anda</p>
        </div>
        <SegmentedControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as YearFilter)}
        />
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      {loading ? (
        <div className="mt-4">
          <LoadingSurface label="Memuat slip gaji…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada slip gaji tersedia"
          description="Slip gaji akan muncul di sini setelah payroll periode berjalan disetujui."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-outline-variant bg-surface p-4 shadow-e1"
            >
              <div className="min-w-0 flex-1">
                <p data-testid={`period-${p.period}`} className="font-semibold text-onsurface">
                  {formatPeriode(p.period)}
                </p>
                <p className="t-caption mt-0.5 tabular-nums text-onsurface-variant">
                  Digenerate {formatTanggal(p.generatedAt)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums text-xl font-bold text-primary">
                {formatIDR(p.takeHome)}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" onClick={() => setSelected(p)}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Lihat
                </Button>
                <Button
                  variant="icon"
                  aria-label={`Unduh slip ${formatPeriode(p.period)}`}
                  onClick={() => void downloadPayslip(p)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && <PayslipDetailDialog payslip={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  )
}

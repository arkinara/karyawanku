'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Coins, Download, Pencil, PiggyBank, Users, Wallet } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  DataTable,
  Dialog,
  ErrorSurface,
  LoadingSurface,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { MetricCard } from '@/components/dashboard/metric-card'
import { MetricGrid } from '@/components/dashboard/metric-grid'
import { cn } from '@/lib/cn'
import { formatIDR } from '@/lib/format'
import { api } from '@/lib/api-client'
import { AuthGuard, OWNER_ONLY } from '@/lib/route-guard'
import {
  gross,
  potongan,
  summarize,
  takeHome,
  type BePayrollRunResponse,
  type PayrollItem,
  type PayrollRun,
  emptyPayrollRun,
  mapPayrollRun,
} from '@/lib/payroll-adapter'

const PERIOD = '2026-08'

/** Accepts comma decimals and a leading minus — e.g. "100000" or "-25.000". */
function parsePenyesuaian(s: string): number | null {
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function ComponentRows({ rows }: { rows: Array<{ nama: string; nominal: number }> }) {
  return (
    <ul className="divide-y divide-outline-variant">
      {rows.map((r) => (
        <li key={r.nama} className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-onsurface-variant">{r.nama}</span>
          <span className="tabular-nums font-medium text-onsurface">{formatIDR(r.nominal)}</span>
        </li>
      ))}
    </ul>
  )
}

function BreakdownDetail({ item }: { item: PayrollItem }) {
  const totalTunjangan = gross(item) - item.gajiPokok
  const totalPotongan = potongan(item)
  const total = takeHome(item)
  const hasPenyesuaian = item.penyesuaian !== 0

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section aria-label="Pendapatan">
        <h4 className="t-label mb-1 text-onsurface">Pendapatan</h4>
        <ul className="divide-y divide-outline-variant">
          <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="text-onsurface-variant">Gaji Pokok</span>
            <span className="tabular-nums font-medium text-onsurface">
              {formatIDR(item.gajiPokok)}
            </span>
          </li>
        </ul>
        <ComponentRows rows={item.tunjangan} />
        {hasPenyesuaian && (
          <ul className="divide-y divide-outline-variant">
            <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="text-onsurface-variant">Penyesuaian</span>
              <span
                className={cn(
                  'tabular-nums font-medium',
                  item.penyesuaian > 0 ? 'text-success' : 'text-danger',
                )}
              >
                {item.penyesuaian > 0 ? '+' : ''}
                {formatIDR(item.penyesuaian)}
              </span>
            </li>
          </ul>
        )}
        {item.catatan && (
          <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-onsurface-variant">
            Catatan: {item.catatan}
          </p>
        )}
      </section>

      <section aria-label="Potongan">
        <h4 className="t-label mb-1 text-onsurface">Potongan</h4>
        <ComponentRows rows={item.potongan} />
      </section>

      <div className="sm:col-span-2 mt-1 flex items-center justify-between gap-3 border-t border-outline-variant pt-3">
        <span className="t-label text-onsurface">Take-home</span>
        <span className="tabular-nums text-lg font-bold text-onsurface">{formatIDR(total)}</span>
      </div>
    </div>
  )
}

interface KoreksiDialogProps {
  item: PayrollItem | null
  onClose: () => void
  onSave: (itemId: string, penyesuaian: number, catatan: string) => void
}

function KoreksiDialog({ item, onClose, onSave }: KoreksiDialogProps) {
  const [penyesuaian, setPenyesuaian] = useState('')
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!item) return
    setPenyesuaian(item.penyesuaian === 0 ? '' : String(item.penyesuaian))
    setCatatan(item.catatan)
    setError(undefined)
  }, [item])

  const handleSave = () => {
    if (!item) return
    const value = parsePenyesuaian(penyesuaian)
    if (value === null) {
      setError('Penyesuaian harus berupa angka, bisa negatif')
      return
    }
    onSave(item.employeeId, value, catatan.trim())
  }

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      title="Edit Koreksi"
      description="Penyesuaian manual, misalnya lembur yang belum tercatat."
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave}>Simpan</Button>
        </>
      }
    >
      {item && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <Avatar name={item.nama} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium text-onsurface">{item.nama}</p>
              <p className="truncate text-xs text-onsurface-variant">
                {item.jabatan} · {item.nik}
              </p>
            </div>
            <p className="ml-auto shrink-0 tabular-nums text-sm font-semibold text-onsurface">
              {formatIDR(takeHome(item))}
            </p>
          </div>

          <TextField
            id="koreksi-penyesuaian"
            label="Penyesuaian"
            type="text"
            inputMode="numeric"
            value={penyesuaian}
            onChange={(e) => setPenyesuaian(e.target.value)}
            error={error}
            helperText="Angka positif menambah, negatif mengurangi. Contoh: 100000 atau -25000"
            placeholder="0"
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="koreksi-catatan" className="t-label text-onsurface">
              Catatan
            </label>
            <textarea
              id="koreksi-catatan"
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: lembur 2 jam belum tercatat"
              className="w-full rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 text-sm text-onsurface placeholder:text-onsurface-variant outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </Dialog>
  )
}

export default function PayrollPage() {
  // The page renders against a BE-backed payroll run. We seed with the mock
  // shape so the very first paint matches what the test fixtures expect, then
  // swap in the BE response (or create the run) once it resolves.
  const [run, setRun] = useState<PayrollRun>(() => emptyPayrollRun(PERIOD))
  const [runId, setRunId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [koreksiItem, setKoreksiItem] = useState<PayrollItem | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const approved = run.status === 'approved'

  const summary = useMemo(() => summarize(run), [run])
  const totalTunjangan = useMemo(
    () => run.items.reduce((sum, i) => sum + gross(i) - i.gajiPokok, 0),
    [run],
  )

  const ensureRun = useCallback(async (): Promise<string> => {
    if (runId) return runId
    const res = await api.post<{ run: { id: string } & Record<string, unknown> }>('/api/payroll-runs', {
      periode: PERIOD,
    })
    setRunId(res.run.id)
    return res.run.id
  }, [runId])

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.get<{ runs: Array<{ id: string; status: string; periode: string }> }>(
        '/api/payroll-runs',
        { periode: PERIOD },
      )
      const existing = list.runs[0]
      if (existing) {
        setRunId(existing.id)
        const detail = await api.get<BePayrollRunResponse>(`/api/payroll-runs/${existing.id}`)
        setRun(mapPayrollRun(detail))
      } else {
        // Auto-create the run on first visit so the screen has live data.
        const created = await api.post<BePayrollRunResponse>('/api/payroll-runs', {
          periode: PERIOD,
        })
        setRunId(created.run.id)
        setRun(mapPayrollRun(created))
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveKoreksi = async (itemId: string, penyesuaian: number, catatan: string) => {
    // Optimistic update — apply the correction to the local item.
    setRun((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.employeeId === itemId
          ? { ...i, penyesuaian, catatan }
          : i,
      ),
    }))
    setKoreksiItem(null)
    try {
      const id = await ensureRun()
      const fresh = await api.get<BePayrollRunResponse>(`/api/payroll-runs/${id}`)
      const target = fresh.items.find((i) => i.employee_id === itemId)
      if (target) {
        await api.patch(`/api/payroll-items/${target.id}`, {
          koreksi: penyesuaian,
          catatan_koreksi: catatan,
        })
      }
    } catch {
      // Silent — optimistic stays.
    }
  }

  const approve = async () => {
    setRun((prev) => ({ ...prev, status: 'approved' }))
    setApproveOpen(false)
    try {
      const id = await ensureRun()
      await api.post(`/api/payroll-runs/${id}/approve`)
    } catch (e) {
      setRun((prev) => ({ ...prev, status: 'draft' }))
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const handleExport = async () => {
    if (!runId || !approved) {
      setToast('Ekspor hanya tersedia untuk payroll yang sudah disetujui')
      return
    }
    try {
      const blob = await api.download(`/api/payroll-runs/${runId}/export.csv`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payroll-${PERIOD}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setToast('File CSV berhasil diunduh')
    } catch {
      setToast('Gagal mengunduh file')
    }
  }

  const toggleExpand = (item: PayrollItem) => {
    setExpandedId((prev) => (prev === item.employeeId ? null : item.employeeId))
  }

  const columns: Array<DataTableColumn<PayrollItem>> = [
    {
      key: 'nama',
      label: 'Nama',
      sortable: true,
      render: (i) => (
        <div className="flex items-center gap-3">
          <Avatar name={i.nama} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-onsurface">{i.nama}</p>
            <p className="truncate text-xs text-onsurface-variant">{i.jabatan}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'gajiPokok',
      label: 'Gaji Pokok',
      numeric: true,
      sortable: true,
      render: (i) => formatIDR(i.gajiPokok),
    },
    {
      key: 'tunjangan',
      label: 'Tunjangan',
      numeric: true,
      sortable: true,
      render: (i) => formatIDR(gross(i) - i.gajiPokok),
    },
    {
      key: 'potongan',
      label: 'Potongan',
      numeric: true,
      sortable: true,
      render: (i) => formatIDR(potongan(i)),
    },
    {
      key: 'takeHome',
      label: 'Take-Home',
      numeric: true,
      sortable: true,
      render: (i) => (
        <span data-testid={`take-home-${i.employeeId}`} className="font-semibold">
          {formatIDR(takeHome(i))}
        </span>
      ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="icon"
            size="sm"
            aria-label={`Edit ${i.nama}`}
            disabled={approved}
            onClick={() => setKoreksiItem(i)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            aria-label={`Detail ${i.nama}`}
            aria-expanded={expandedId === i.employeeId}
            onClick={() => toggleExpand(i)}
          >
            {expandedId === i.employeeId ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AuthGuard requiredRoles={OWNER_ONLY}>
      <AppShell
        userRole="owner"
        activeNav="payroll"
        title="Payroll"
        subtitle="Periode Agustus 2026"
      >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Payroll Run</h1>
          <p className="t-caption mt-1 tabular-nums">
            {summary.count} karyawan · periode Agustus 2026
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {approved ? (
            <StatusChip variant="success" label="Disetujui" icon={Check} />
          ) : (
            <StatusChip variant="warning" label="Draft — Belum disetujui" />
          )}
          {!approved && (
            <Button onClick={() => setApproveOpen(true)}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Setujui Payroll
            </Button>
          )}
          <Button variant="secondary" disabled={!approved} onClick={() => void handleExport()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      <MetricGrid className="mt-4">
        <MetricCard label="Total Karyawan" value={summary.count} icon={Users} />
        <MetricCard label="Total Gaji" value={formatIDR(summary.totalGaji)} icon={Wallet} />
        <MetricCard label="Total Potongan" value={formatIDR(summary.totalPotongan)} icon={Coins} />
        <MetricCard label="Take-Home" value={formatIDR(summary.totalTakeHome)} icon={PiggyBank} />
      </MetricGrid>

      <div className="mt-4">
        {loading ? (
          <LoadingSurface label="Memuat payroll…" />
        ) : (
          <DataTable
            columns={columns}
            rows={run.items}
            rowKey={(i) => i.employeeId}
            caption="Breakdown payroll per karyawan"
            expandedRowKey={expandedId}
            renderExpandedRow={(item) => <BreakdownDetail item={item} />}
            footer={
              <tr>
                <td className="border-t border-outline-variant bg-surface-1 px-4 py-3">
                  <span className="t-label text-onsurface">Total</span>
                </td>
                <td className="border-t border-outline-variant bg-surface-1 px-4 py-3 text-right tabular-nums font-semibold text-onsurface">
                  {formatIDR(summary.totalGaji - totalTunjangan)}
                </td>
                <td className="border-t border-outline-variant bg-surface-1 px-4 py-3 text-right tabular-nums font-semibold text-onsurface">
                  {formatIDR(totalTunjangan)}
                </td>
                <td className="border-t border-outline-variant bg-surface-1 px-4 py-3 text-right tabular-nums font-semibold text-onsurface">
                  {formatIDR(summary.totalPotongan)}
                </td>
                <td className="border-t border-outline-variant bg-surface-1 px-4 py-3 text-right tabular-nums font-semibold text-onsurface">
                  {formatIDR(summary.totalTakeHome)}
                </td>
                <td className="border-t border-outline-variant bg-surface-1 px-4 py-3" />
              </tr>
            }
          />
        )}
      </div>

      <KoreksiDialog
        item={koreksiItem}
        onClose={() => setKoreksiItem(null)}
        onSave={saveKoreksi}
      />

      <Dialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Setujui Payroll?"
        footer={
          <>
            <Button variant="text" onClick={() => setApproveOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void approve()}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Setujui
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-onsurface">
            <span className="tabular-nums font-semibold">{summary.count} karyawan</span>
            <span aria-hidden="true"> · </span>
            Take-home total{' '}
            <span className="tabular-nums font-semibold">{formatIDR(summary.totalTakeHome)}</span>
          </p>
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            Setelah disetujui, payroll tidak bisa diedit lagi
          </p>
        </div>
      </Dialog>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full bg-success px-5 py-3 text-sm font-medium text-success-on shadow-e4"
        >
          {toast}
        </div>
      )}
      </AppShell>
    </AuthGuard>
  )
}

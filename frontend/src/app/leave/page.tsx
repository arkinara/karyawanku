'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Calendar, CheckCircle2, Plus, XCircle } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  EmptyState,
  ErrorSurface,
  LoadingSurface,
  SegmentedControl,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { MetricCard } from '@/components/dashboard/metric-card'
import { MetricGrid } from '@/components/dashboard/metric-grid'
import { useAuth } from '@/lib/auth-context'
import { AuthGuard, ANY_ROLE } from '@/lib/route-guard'
import { formatTanggal } from '@/lib/format'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api-client'
import {
  JENIS_BALANCE,
  JENIS_LABEL,
  hitungDurasi,
  leaveBalanceSisa,
  summarizeLeave,
  type BeLeaveBalanceResponse,
  type BeLeaveRequest,
  type BeLeaveTypeListResponse,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
  mapLeaveBalances,
  mapLeaveRequests,
} from '@/lib/leave-adapter'

type Role = 'owner' | 'employee'

type StatusFilter = 'semua' | LeaveStatus

const STATUS_FILTERS = [
  { value: 'semua', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const STATUS_CHIP: Record<LeaveStatus, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  pending: { variant: 'warning', label: 'Menunggu' },
  approved: { variant: 'success', label: 'Disetujui' },
  rejected: { variant: 'danger', label: 'Ditolak' },
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

function JenisChip({ jenis }: { jenis: LeaveType }) {
  return (
    <span className="inline-flex rounded-full bg-surface-3 px-3 py-1 text-xs font-medium text-onsurface-variant">
      {JENIS_LABEL[jenis]}
    </span>
  )
}

function TanggalCell({ mulai, selesai }: { mulai: string; selesai: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums text-onsurface">
      <time dateTime={mulai}>{formatTanggal(mulai)}</time>
      {selesai !== mulai && (
        <>
          {' – '}
          <time dateTime={selesai}>{formatTanggal(selesai)}</time>
        </>
      )}
    </span>
  )
}

const jenisFilterClass =
  'h-9 min-w-[140px] rounded-full border border-outline-variant bg-surface-1 px-3 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary'

function OwnerView() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua')
  const [jenisFilter, setJenisFilter] = useState('semua')
  const [decision, setDecision] = useState<{ request: LeaveRequest; action: 'approve' | 'reject' } | null>(
    null,
  )

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ requests: BeLeaveRequest[] }>('/api/leave-requests')
      setRequests(mapLeaveRequests(res.requests))
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const summary = useMemo(() => summarizeLeave(requests), [requests])

  const pending = useMemo(
    () =>
      requests.filter(
        (r) => r.status === 'pending' && (jenisFilter === 'semua' || r.jenis === jenisFilter),
      ),
    [requests, jenisFilter],
  )

  const allFiltered = useMemo(
    () =>
      requests.filter(
        (r) =>
          (statusFilter === 'semua' || r.status === statusFilter) &&
          (jenisFilter === 'semua' || r.jenis === jenisFilter),
      ),
    [requests, statusFilter, jenisFilter],
  )

  const confirmDecision = async (catatan: string) => {
    if (!decision) return
    const { request, action } = decision
    const nextStatus: LeaveStatus = action === 'approve' ? 'approved' : 'rejected'
    const previousStatus = request.status
    const previousCatatan = request.catatan
    // Optimistic update + close dialog; rolled back below if the BE write fails.
    setRequests((prev) =>
      prev.map((r) =>
        r.id === request.id ? { ...r, status: nextStatus, catatan: catatan.trim() } : r,
      ),
    )
    setDecision(null)
    try {
      await api.patch(
        `/api/leave-requests/${request.id}/${action === 'approve' ? 'approve' : 'reject'}`,
        { catatan_approver: catatan.trim() || undefined },
      )
    } catch {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, status: previousStatus, catatan: previousCatatan } : r,
        ),
      )
    }
  }

  const karyawanCell = (r: LeaveRequest) => (
    <div className="flex items-center gap-3">
      <Avatar name={r.nama} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-medium text-onsurface">{r.nama}</p>
        <p className="truncate text-xs text-onsurface-variant">{r.jabatan}</p>
      </div>
    </div>
  )

  const jenisCell = (r: LeaveRequest) => <JenisChip jenis={r.jenis} />

  const queueColumns: Array<DataTableColumn<LeaveRequest>> = [
    { key: 'nama', label: 'Karyawan', sortable: true, render: karyawanCell },
    { key: 'jenis', label: 'Jenis Cuti', render: jenisCell },
    {
      key: 'tanggalMulai',
      label: 'Tanggal',
      sortable: true,
      render: (r) => <TanggalCell mulai={r.tanggalMulai} selesai={r.tanggalSelesai} />,
    },
    {
      key: 'durasi',
      label: 'Durasi',
      numeric: true,
      render: (r) => (
        <span className="tabular-nums text-onsurface">
          {r.durasi} <span className="text-xs text-onsurface-variant">hari</span>
        </span>
      ),
    },
    {
      key: 'alasan',
      label: 'Alasan',
      render: (r) => <span className="text-onsurface-variant">{r.alasan}</span>,
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="tonal"
            onClick={() => setDecision({ request: r, action: 'approve' })}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Setujui
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setDecision({ request: r, action: 'reject' })}
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Tolak
          </Button>
        </div>
      ),
    },
  ]

  const allColumns: Array<DataTableColumn<LeaveRequest>> = [
    { key: 'nama', label: 'Karyawan', sortable: true, render: karyawanCell },
    { key: 'jenis', label: 'Jenis Cuti', render: jenisCell },
    {
      key: 'tanggalMulai',
      label: 'Tanggal',
      sortable: true,
      render: (r) => <TanggalCell mulai={r.tanggalMulai} selesai={r.tanggalSelesai} />,
    },
    {
      key: 'durasi',
      label: 'Durasi',
      numeric: true,
      render: (r) => (
        <span className="tabular-nums text-onsurface">
          {r.durasi} <span className="text-xs text-onsurface-variant">hari</span>
        </span>
      ),
    },
    {
      key: 'alasan',
      label: 'Alasan',
      render: (r) => <span className="text-onsurface-variant">{r.alasan}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <StatusChip variant={STATUS_CHIP[r.status].variant} label={STATUS_CHIP[r.status].label} />
      ),
    },
    {
      key: 'catatan',
      label: 'Catatan Approver',
      render: (r) =>
        r.catatan ? (
          <span className="text-onsurface-variant">{r.catatan}</span>
        ) : (
          <span className="text-onsurface-variant">—</span>
        ),
    },
  ]

  const summaryMetrics = [
    { label: 'Total Menunggu', value: summary.pending, icon: AlertTriangle },
    { label: 'Disetujui Bulan Ini', value: summary.approvedThisMonth, icon: CheckCircle2 },
    { label: 'Ditolak Bulan Ini', value: summary.rejectedThisMonth, icon: XCircle },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Cuti</h1>
          <p className="t-caption mt-1">Kelola pengajuan cuti karyawan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            aria-label="Filter status cuti"
          />
          <label className="flex items-center gap-2 text-sm text-onsurface-variant">
            <span className="t-caption">Jenis cuti</span>
            <select
              value={jenisFilter}
              onChange={(e) => setJenisFilter(e.target.value)}
              aria-label="Filter jenis cuti"
              className={jenisFilterClass}
            >
              <option value="semua">Semua jenis</option>
              {(Object.keys(JENIS_LABEL) as LeaveType[]).map((jenis) => (
                <option key={jenis} value={jenis}>
                  {JENIS_LABEL[jenis]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      <div data-testid="leave-summary" className="mt-4">
        <MetricGrid>
          {summaryMetrics.map((m) => (
            <MetricCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
          ))}
        </MetricGrid>
      </div>

      <section data-testid="approval-queue" aria-labelledby="h-approval-queue" className="mt-6">
        <div className="flex items-center gap-2">
          <h2 id="h-approval-queue" className="t-h2">
            Cuti Menunggu Persetujuan
          </h2>
          <StatusChip variant="warning" label={`${pending.length} menunggu`} />
        </div>
        <div className="mt-3">
          {loading ? (
            <LoadingSurface label="Memuat antrean persetujuan…" />
          ) : (
            <DataTable
              columns={queueColumns}
              rows={pending}
              rowKey={(r) => r.id}
              emptyState={
                <EmptyState
                  icon={Calendar}
                  title="Tidak ada cuti menunggu"
                  description="Semua pengajuan cuti sudah diproses. Pengajuan baru akan muncul di sini."
                />
              }
            />
          )}
        </div>
      </section>

      <section data-testid="all-requests" aria-labelledby="h-all-requests" className="mt-8">
        <div className="flex items-center gap-2">
          <h2 id="h-all-requests" className="t-h2">
            Semua Pengajuan
          </h2>
          <span className="t-caption tabular-nums text-onsurface-variant">{allFiltered.length} entri</span>
        </div>
        <div className="mt-3">
          {loading ? (
            <LoadingSurface label="Memuat semua pengajuan…" />
          ) : (
            <DataTable
              columns={allColumns}
              rows={allFiltered}
              rowKey={(r) => r.id}
              emptyState={
                <EmptyState
                  icon={Calendar}
                  title="Tidak ada pengajuan"
                  description="Tidak ada pengajuan cuti yang cocok dengan filter saat ini."
                />
              }
            />
          )}
        </div>
      </section>

      <DecisionDialog
        open={decision !== null}
        request={decision?.request ?? null}
        action={decision?.action ?? 'approve'}
        onClose={() => setDecision(null)}
        onConfirm={confirmDecision}
      />
    </>
  )
}

interface DecisionDialogProps {
  open: boolean
  request: LeaveRequest | null
  action: 'approve' | 'reject'
  onClose: () => void
  onConfirm: (catatan: string) => void | Promise<void>
}

function DecisionDialog({ open, request, action, onClose, onConfirm }: DecisionDialogProps) {
  const [catatan, setCatatan] = useState('')

  useEffect(() => {
    if (open) setCatatan('')
  }, [open])

  const isApprove = action === 'approve'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isApprove ? 'Setujui Cuti' : 'Tolak Cuti'}
      description={request ? `Konfirmasi keputusan untuk ${request.nama}.` : undefined}
    >
      {request && (
        <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={request.nama} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-onsurface">{request.nama}</p>
              <p className="text-xs text-onsurface-variant">{request.jabatan}</p>
            </div>
            <div className="ml-auto">
              <JenisChip jenis={request.jenis} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="tabular-nums text-onsurface-variant">
              <time dateTime={request.tanggalMulai}>{formatTanggal(request.tanggalMulai)}</time>
              {request.tanggalSelesai !== request.tanggalMulai && (
                <>
                  {' – '}
                  <time dateTime={request.tanggalSelesai}>
                    {formatTanggal(request.tanggalSelesai)}
                  </time>
                </>
              )}
            </span>
            <span className="tabular-nums text-onsurface-variant">{request.durasi} hari</span>
          </div>
          <p className="text-sm text-onsurface">{request.alasan}</p>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="catatan-decision" className="t-label text-onsurface">
          Catatan
        </label>
        <textarea
          id="catatan-decision"
          rows={3}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder={
            isApprove
              ? 'Contoh: pengganti shift diatur oleh supervisor'
              : 'Contoh: bentrok dengan jadwal operasional'
          }
          className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 text-sm text-onsurface placeholder:text-onsurface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {!isApprove && (
          <p className="mt-1 text-body-sm text-onsurface-variant">
            Catatan boleh kosong, namun disarankan diisi agar karyawan memahami alasan.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="text" type="button" onClick={onClose}>
          Batal
        </Button>
        {isApprove ? (
          <Button type="button" onClick={() => void onConfirm(catatan)}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Setujui
          </Button>
        ) : (
          <Button type="button" variant="danger" onClick={() => void onConfirm(catatan)}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Tolak
          </Button>
        )}
      </div>
    </Dialog>
  )
}

function EmployeeView() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [balance, setBalance] = useState<LeaveBalance>({
    tahunan: { kuota: 0, terpakai: 0 },
    sakit: { kuota: 0, terpakai: 0 },
    izin: { kuota: 0, terpakai: 0 },
  })
  const [leaveTypes, setLeaveTypes] = useState<BeLeaveTypeListResponse['leave_types']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const self = useMemo(
    () => ({ id: user?.employee_id ?? '', nama: user?.nama ?? 'Karyawan', jabatan: '—' }),
    [user],
  )

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const tahun = new Date().getFullYear()
      const [reqRes, balRes, typesRes] = await Promise.all([
        api.get<{ requests: BeLeaveRequest[] }>('/api/leave-requests'),
        api.get<BeLeaveBalanceResponse>('/api/leave-balances', {
          employee_id: user?.employee_id,
          tahun,
        }),
        api.get<BeLeaveTypeListResponse>('/api/leave-types'),
      ])
      setRequests(mapLeaveRequests(reqRes.requests))
      setBalance(mapLeaveBalances(balRes))
      setLeaveTypes(typesRes.leave_types)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const submit = async (input: {
    jenis: LeaveType
    leaveTypeId: string
    tanggalMulai: string
    tanggalSelesai: string
    alasan: string
  }) => {
    const optimistic: LeaveRequest = {
      id: `tmp-${Date.now()}`,
      employeeId: self.id,
      nama: self.nama,
      jabatan: self.jabatan,
      jenis: input.jenis,
      tanggalMulai: input.tanggalMulai,
      tanggalSelesai: input.tanggalSelesai,
      durasi: hitungDurasi(input.tanggalMulai, input.tanggalSelesai),
      alasan: input.alasan.trim(),
      status: 'pending',
      catatan: '',
    }
    setRequests((prev) => [optimistic, ...prev])
    setDialogOpen(false)
    try {
      await api.post('/api/leave-requests', {
        leave_type_id: input.leaveTypeId,
        tanggal_mulai: input.tanggalMulai,
        tanggal_selesai: input.tanggalSelesai,
        alasan: input.alasan.trim(),
      })
      void reload()
    } catch {
      // Silent — optimistic entry stays; next reload reconciles.
    }
  }

  const balanceItems = [
    { label: JENIS_LABEL.tahunan, jenis: 'tahunan' as const, note: 'Sisa tahun lalu hangus per 31 Des' },
    { label: JENIS_LABEL.sakit, jenis: 'sakit' as const, note: 'Cuti sakit dengan surat keterangan' },
    { label: JENIS_LABEL.izin, jenis: 'izin' as const, note: 'Cuti izin keperluan pribadi' },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Cuti</h1>
          <p className="t-caption mt-1">Ajukan cuti dan pantau status pengajuan Anda</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajukan Cuti
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={() => void reload()} />
        </div>
      )}

      <Card data-testid="leave-balance" className="mt-4">
        <CardHeader>
          <CardTitle>Saldo Cuti 2026</CardTitle>
          <p className="text-sm text-onsurface-variant">
            Saldo dihitung ulang setiap awal tahun berdasarkan masa kerja.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {balanceItems.map((item) => {
              const sisa = leaveBalanceSisa(balance, item.jenis)
              const kuota = balance[item.jenis].kuota
              return (
                <div
                  key={item.jenis}
                  className="rounded-xl border border-outline-variant bg-surface-1 p-4"
                >
                  <p className="text-sm font-medium text-onsurface-variant">{item.label}</p>
                  <p className="mt-2 text-[27px] font-bold leading-[1.1] tracking-tight tabular-nums text-onsurface">
                    {`${sisa}/${kuota} hari`}
                  </p>
                  <p className="mt-1 text-xs text-onsurface-variant">{item.note}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Histori Pengajuan</CardTitle>
          <p className="text-sm text-onsurface-variant">
            {requests.length} pengajuan tercatat untuk Anda
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSurface label="Memuat histori…" />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Belum ada pengajuan cuti"
              description="Klik Ajukan Cuti untuk mengirim pengajuan pertama Anda."
            />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-outline-variant bg-surface-1 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-onsurface">{JENIS_LABEL[r.jenis]}</span>
                    <span className="ml-auto">
                      <StatusChip variant={STATUS_CHIP[r.status].variant} label={STATUS_CHIP[r.status].label} />
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-onsurface-variant">
                    <time dateTime={r.tanggalMulai}>{formatTanggal(r.tanggalMulai)}</time>
                    {r.tanggalSelesai !== r.tanggalMulai && (
                      <>
                        <span>–</span>
                        <time dateTime={r.tanggalSelesai}>{formatTanggal(r.tanggalSelesai)}</time>
                      </>
                    )}
                    <span>{r.durasi} hari</span>
                  </div>
                  <p className="mt-1 text-sm text-onsurface">{r.alasan}</p>
                  {r.catatan && (
                    <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-onsurface-variant">
                      <span className="font-medium text-onsurface">Catatan:</span> {r.catatan}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AjukanCutiDialog
        open={dialogOpen}
        balance={balance}
        leaveTypes={leaveTypes}
        onClose={() => setDialogOpen(false)}
        onSubmit={submit}
      />
    </div>
  )
}

interface AjukanCutiDialogProps {
  open: boolean
  balance: LeaveBalance
  leaveTypes: BeLeaveTypeListResponse['leave_types']
  onClose: () => void
  onSubmit: (input: {
    jenis: LeaveType
    leaveTypeId: string
    tanggalMulai: string
    tanggalSelesai: string
    alasan: string
  }) => void | Promise<void>
}

function nameToLeaveType(name: string): LeaveType {
  const lower = name.toLowerCase()
  if (lower.includes('tahunan')) return 'tahunan'
  if (lower.includes('sakit')) return 'sakit'
  if (lower.includes('izin')) return 'izin'
  if (lower.includes('melahirkan')) return 'melahirkan'
  if (lower.includes('penting')) return 'penting'
  return 'tahunan'
}

function AjukanCutiDialog({ open, balance, leaveTypes, onClose, onSubmit }: AjukanCutiDialogProps) {
  const [jenis, setJenis] = useState<LeaveType>('tahunan')
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
  const [alasan, setAlasan] = useState('')
  const [errors, setErrors] = useState<{ mulai?: string; selesai?: string; alasan?: string }>({})

  useEffect(() => {
    if (!open) return
    setJenis('tahunan')
    setTanggalMulai('')
    setTanggalSelesai('')
    setAlasan('')
    setErrors({})
  }, [open])

  const today = toIsoToday()

  const durasi = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return 0
    return hitungDurasi(tanggalMulai, tanggalSelesai)
  }, [tanggalMulai, tanggalSelesai])

  const sisa = useMemo(() => leaveBalanceSisa(balance, jenis), [balance, jenis])

  const tanggalError = useMemo(() => {
    if (tanggalSelesai && tanggalMulai && tanggalSelesai < tanggalMulai) {
      return 'Tanggal selesai harus setelah atau sama dengan tanggal mulai'
    }
    return undefined
  }, [tanggalSelesai, tanggalMulai])

  const alasanError = useMemo(() => {
    const trimmed = alasan.trim()
    if (trimmed && trimmed.length < 10) return 'Alasan minimal 10 karakter'
    return undefined
  }, [alasan])

  const overBudget =
    JENIS_BALANCE.includes(jenis) && durasi > sisa && tanggalError === undefined

  const currentType = useMemo(
    () => leaveTypes.find((t) => nameToLeaveType(t.nama_jenis_cuti) === jenis),
    [leaveTypes, jenis],
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const errs: { mulai?: string; selesai?: string; alasan?: string } = {}
    if (!tanggalMulai) errs.mulai = 'Tanggal mulai wajib diisi'
    if (tanggalMulai && tanggalMulai < today) errs.mulai = 'Tanggal mulai harus hari ini atau setelahnya'
    if (!tanggalSelesai) errs.selesai = 'Tanggal selesai wajib diisi'
    if (tanggalSelesai && tanggalMulai && tanggalSelesai < tanggalMulai) {
      errs.selesai = tanggalError
    }
    if (overBudget) {
      errs.selesai = `Sisa saldo ${JENIS_LABEL[jenis]} tidak cukup — tersisa ${sisa} hari`
    }
    if (!alasan.trim()) errs.alasan = 'Alasan wajib diisi'
    if (alasan.trim() && alasan.trim().length < 10) errs.alasan = alasanError
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    if (!currentType) {
      setErrors({ mulai: 'Jenis cuti belum tersedia di server. Coba lagi.' })
      return
    }
    onSubmit({
      jenis,
      leaveTypeId: currentType.id,
      tanggalMulai,
      tanggalSelesai,
      alasan,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ajukan Cuti"
      description="Isi detail cuti yang ingin diajukan untuk persetujuan."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="jenis-cuti" className="t-label text-onsurface">
            Jenis Cuti
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="jenis-cuti"
            value={jenis}
            onChange={(e) => setJenis(e.target.value as LeaveType)}
            className="mt-1.5 h-11 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {(Object.keys(JENIS_LABEL) as LeaveType[]).map((j) => (
              <option key={j} value={j}>
                {JENIS_LABEL[j]}
              </option>
            ))}
          </select>
        </div>

        <TextField
          id="tanggal-mulai"
          label="Tanggal Mulai"
          type="date"
          required
          min={today}
          value={tanggalMulai}
          onChange={(e) => setTanggalMulai(e.target.value)}
          error={errors.mulai}
        />

        <TextField
          id="tanggal-selesai"
          label="Tanggal Selesai"
          type="date"
          required
          min={tanggalMulai || today}
          value={tanggalSelesai}
          onChange={(e) => setTanggalSelesai(e.target.value)}
          error={errors.selesai ?? tanggalError}
        />

        <div>
          <label htmlFor="alasan-cuti" className="t-label text-onsurface">
            Alasan
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="alasan-cuti"
            rows={3}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: liburan keluarga selama 3 hari"
            aria-invalid={Boolean(errors.alasan) || undefined}
            className={cn(
              'mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 text-sm text-onsurface placeholder:text-onsurface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              (errors.alasan || alasanError) && 'border-danger bg-danger/5 focus:border-danger focus:ring-danger',
            )}
          />
          {errors.alasan ? (
            <p className="mt-1 text-body-sm text-danger">{errors.alasan}</p>
          ) : (
            alasanError && <p className="mt-1 text-body-sm text-danger">{alasanError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-onsurface-variant">Durasi</span>
          <span className="text-sm font-semibold tabular-nums text-onsurface">
            {durasi > 0 ? `${durasi} hari` : '—'}
          </span>
        </div>

        {overBudget && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Sisa saldo {JENIS_LABEL[jenis]} tidak cukup — tersisa {sisa} hari, pengajuan{' '}
              {durasi} hari.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="text" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit">Kirim Pengajuan</Button>
        </div>
      </form>
    </Dialog>
  )
}

export default function LeavePage() {
  const { user } = useAuth()
  const [paramRole] = useState(readRoleParam)
  const role: Role = paramRole ?? user?.role ?? 'owner'

  if (role === 'employee') {
    return (
      <AuthGuard requiredRoles={ANY_ROLE}>
        <AppShell
          userRole="employee"
          activeNav="leave"
          title="Cuti"
          subtitle={user?.nama ?? 'Karyawan'}
        >
          <EmployeeView />
        </AppShell>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard requiredRoles={ANY_ROLE}>
      <AppShell userRole="owner" activeNav="leave" title="Cuti" subtitle={formatTodayLong()}>
        <OwnerView />
      </AppShell>
    </AuthGuard>
  )
}

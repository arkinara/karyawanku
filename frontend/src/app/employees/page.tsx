'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  DataTable,
  EmptyState,
  ErrorSurface,
  LoadingSurface,
  SearchBar,
  SegmentedControl,
  StatusChip,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import type { StatusVariant } from '@/components/ui/status-chip'
import { apiRequest } from '@/lib/api-client'
import { formatTanggal } from '@/lib/format'

type EmployeeStatus = 'aktif' | 'nonaktif'
type JenisKontrak = 'pkwtt' | 'pkwt' | 'pkl' | 'magang' | 'harian'

interface Employee {
  id: string
  business_id: string
  nama_lengkap: string
  no_ktp: string
  npwp: string | null
  tanggal_lahir: string
  jenis_kelamin: 'L' | 'P'
  alamat: string | null
  kontak_darurat: string | null
  tanggal_masuk: string
  jenis_kontrak: JenisKontrak
  status: EmployeeStatus
  ptkp_status: string | null
  custom_fields: Record<string, unknown> | null
  created_at: string | number
}

const KONTRAK_OPTIONS = ['Semua', 'PKWTT', 'PKWT', 'PKL', 'Magang', 'Harian']

const KONTRAK_VARIANT: Record<string, StatusVariant> = {
  PKWTT: 'info',
  PKWT: 'warning',
  PKL: 'success',
  Harian: 'neutral',
  Magang: 'danger',
}

const KONTRAK_LABEL: Record<JenisKontrak, string> = {
  pkwtt: 'PKWTT',
  pkwt: 'PKWT',
  pkl: 'PKL',
  harian: 'Harian',
  magang: 'Magang',
}

const KONTRAK_VALUES: Record<string, JenisKontrak | undefined> = {
  PKWTT: 'pkwtt',
  PKWT: 'pkwt',
  PKL: 'pkl',
  Magang: 'magang',
  Harian: 'harian',
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | EmployeeStatus>('all')
  const [kontrak, setKontrak] = useState<string>('Semua')

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<{ employees: Employee[]; total: number }>(
        '/api/employees',
        { query: { limit: 200 } },
      )
      setEmployees(res.employees)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const counts = useMemo(() => {
    return {
      all: employees.length,
      aktif: employees.filter((e) => e.status === 'aktif').length,
      nonaktif: employees.filter((e) => e.status === 'nonaktif').length,
    }
  }, [employees])

  const STATUS_OPTIONS = [
    { value: 'all', label: 'Semua', count: counts.all },
    { value: 'aktif', label: 'Aktif', count: counts.aktif },
    { value: 'nonaktif', label: 'Nonaktif', count: counts.nonaktif },
  ]

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const kontrakValue = KONTRAK_VALUES[kontrak]
    return employees.filter((e) => {
      const okStatus = status === 'all' || e.status === status
      const okKontrak = !kontrakValue || e.jenis_kontrak === kontrakValue
      const hay = (
        e.nama_lengkap +
        ' ' +
        e.no_ktp +
        ' ' +
        e.jenis_kontrak
      ).toLowerCase()
      const okQuery = !term || hay.includes(term)
      return okStatus && okKontrak && okQuery
    })
  }, [employees, query, status, kontrak])

  const hasFilter = query.trim() !== '' || status !== 'all' || kontrak !== 'Semua'

  const resetAll = () => {
    setQuery('')
    setStatus('all')
    setKontrak('Semua')
  }

  const columns: Array<DataTableColumn<Employee>> = [
    {
      key: 'nama',
      label: 'Nama',
      sortable: true,
      render: (e) => (
        <div className="flex items-center gap-3">
          <Avatar name={e.nama_lengkap} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-onsurface">{e.nama_lengkap}</p>
            <p className="truncate text-xs text-onsurface-variant">{e.no_ktp}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'kontrak',
      label: 'Jenis Kontrak',
      render: (e) => (
        <StatusChip
          variant={KONTRAK_VARIANT[KONTRAK_LABEL[e.jenis_kontrak]] ?? 'neutral'}
          label={KONTRAK_LABEL[e.jenis_kontrak]}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (e) =>
        e.status === 'aktif' ? (
          <StatusChip variant="success" label="Aktif" />
        ) : (
          <StatusChip variant="neutral" label="Nonaktif" />
        ),
    },
    {
      key: 'tanggalMasuk',
      label: 'Tanggal Masuk',
      sortable: true,
      render: (e) => (
        <time dateTime={e.tanggal_masuk} className="tabular-nums text-onsurface-variant">
          {formatTanggal(e.tanggal_masuk)}
        </time>
      ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="icon" size="sm" aria-label={`Edit ${e.nama_lengkap}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="sm" aria-label={`Hapus ${e.nama_lengkap}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Karyawan"
      subtitle="Warung KopiKu"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Daftar Karyawan</h1>
          <p className="t-caption mt-1">{employees.length} karyawan terdaftar</p>
        </div>
        <a
          href="/employees/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-on shadow-e1 transition-all duration-fast ease-standard hover:opacity-90 hover:shadow-e2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Karyawan
        </a>
      </div>

      {loading && <div className="mt-4"><LoadingSurface label="Memuat karyawan…" /></div>}
      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={reload} />
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4 space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Cari nama, NIK, atau jenis kontrak…"
            aria-label="Cari karyawan"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as 'all' | EmployeeStatus)}
              aria-label="Filter status"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-onsurface-variant">
              <span className="t-caption">Jenis kontrak</span>
              <select
                value={kontrak}
                onChange={(e) => setKontrak(e.target.value)}
                aria-label="Jenis kontrak"
                className="h-9 min-w-[140px] rounded-full border border-outline-variant bg-surface-1 px-3 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {KONTRAK_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            {hasFilter && (
              <Button variant="text" size="sm" onClick={resetAll}>
                Reset filter
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(e) => e.id}
            caption="Daftar karyawan"
            emptyState={
              <EmptyState
                icon={Search}
                title="Tidak ada karyawan yang cocok"
                description="Coba kata kunci lain atau ubah filter status dan jenis kontrak."
                action={
                  <Button variant="secondary" size="sm" onClick={resetAll}>
                    Bersihkan pencarian & filter
                  </Button>
                }
              />
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-onsurface-variant">
            <p className="t-caption tabular-nums">
              Menampilkan 1-{filtered.length} dari {filtered.length}
            </p>
            <div className="flex items-center gap-3">
              <label className="t-caption flex items-center gap-2">
                Baris per halaman
                <select
                  defaultValue="10"
                  className="h-9 rounded-full border border-outline-variant bg-surface-1 px-3 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
              <div className="flex items-center gap-1">
                <Button variant="icon" size="sm" disabled aria-label="Halaman sebelumnya">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="t-caption px-2 tabular-nums">1 / 1</span>
                <Button variant="icon" size="sm" disabled aria-label="Halaman berikutnya">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
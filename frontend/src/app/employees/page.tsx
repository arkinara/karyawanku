'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  DataTable,
  EmptyState,
  SearchBar,
  SegmentedControl,
  StatusChip,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import type { StatusVariant } from '@/components/ui/status-chip'
import { formatTanggal } from '@/lib/format'

type EmployeeStatus = 'aktif' | 'nonaktif'

interface Employee {
  nik: string
  nama: string
  jabatan: string
  kontrak: string
  status: EmployeeStatus
  tanggalMasuk: string
}

const EMPLOYEES: Employee[] = [
  { nik: 'KRY-001', nama: 'Budi Santoso', jabatan: 'Kepala Barista', kontrak: 'PKWTT', status: 'aktif', tanggalMasuk: '2023-01-12' },
  { nik: 'KRY-002', nama: 'Siti Nurhaliza', jabatan: 'Kasir', kontrak: 'PKWTT', status: 'aktif', tanggalMasuk: '2023-03-03' },
  { nik: 'KRY-003', nama: 'Ahmad Fauzi', jabatan: 'Barista', kontrak: 'PKWT', status: 'aktif', tanggalMasuk: '2024-07-17' },
  { nik: 'KRY-004', nama: 'Dewi Lestari', jabatan: 'Pramusaji', kontrak: 'PKL', status: 'aktif', tanggalMasuk: '2026-02-02' },
  { nik: 'KRY-005', nama: 'Rudi Hermawan', jabatan: 'Kasir', kontrak: 'PKWTT', status: 'nonaktif', tanggalMasuk: '2022-09-08' },
  { nik: 'KRY-006', nama: 'Maya Sari', jabatan: 'Admin', kontrak: 'PKWT', status: 'aktif', tanggalMasuk: '2025-11-21' },
  { nik: 'KRY-007', nama: 'Fajar Nugraha', jabatan: 'Barista', kontrak: 'PKWT', status: 'aktif', tanggalMasuk: '2025-04-14' },
  { nik: 'KRY-008', nama: 'Lestari Wulandari', jabatan: 'Supervisor', kontrak: 'PKWTT', status: 'nonaktif', tanggalMasuk: '2022-06-20' },
  { nik: 'KRY-009', nama: 'Indra Permadi', jabatan: 'Pramusaji', kontrak: 'Harian', status: 'aktif', tanggalMasuk: '2026-01-05' },
  { nik: 'KRY-010', nama: 'Ratna Sari', jabatan: 'Kasir', kontrak: 'PKWT', status: 'aktif', tanggalMasuk: '2024-12-01' },
  { nik: 'KRY-011', nama: 'Hendro Wibowo', jabatan: 'Kurir', kontrak: 'Harian', status: 'aktif', tanggalMasuk: '2026-05-11' },
  { nik: 'KRY-012', nama: 'Ani Rahmawati', jabatan: 'Pramusaji', kontrak: 'Magang', status: 'aktif', tanggalMasuk: '2026-03-30' },
]

const KONTRAK_OPTIONS = ['Semua', 'PKWTT', 'PKWT', 'PKL', 'Magang', 'Harian']

const KONTRAK_VARIANT: Record<string, StatusVariant> = {
  PKWTT: 'info',
  PKWT: 'warning',
  PKL: 'success',
  Harian: 'neutral',
  Magang: 'danger',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua', count: EMPLOYEES.length },
  { value: 'aktif', label: 'Aktif', count: EMPLOYEES.filter((e) => e.status === 'aktif').length },
  { value: 'nonaktif', label: 'Nonaktif', count: EMPLOYEES.filter((e) => e.status === 'nonaktif').length },
]

export default function EmployeesPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [kontrak, setKontrak] = useState('Semua')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return EMPLOYEES.filter((e) => {
      const okStatus = status === 'all' || e.status === status
      const okKontrak = kontrak === 'Semua' || e.kontrak === kontrak
      const hay = (e.nama + ' ' + e.jabatan + ' ' + e.nik + ' ' + e.kontrak).toLowerCase()
      const okQuery = !term || hay.includes(term)
      return okStatus && okKontrak && okQuery
    })
  }, [query, status, kontrak])

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
          <Avatar name={e.nama} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-onsurface">{e.nama}</p>
            <p className="truncate text-xs text-onsurface-variant">{e.jabatan}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'kontrak',
      label: 'Jenis Kontrak',
      render: (e) => (
        <StatusChip variant={KONTRAK_VARIANT[e.kontrak] ?? 'neutral'} label={e.kontrak} />
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
        <time dateTime={e.tanggalMasuk} className="tabular-nums text-onsurface-variant">
          {formatTanggal(e.tanggalMasuk)}
        </time>
      ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="icon" size="sm" aria-label={`Edit ${e.nama}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="sm" aria-label={`Hapus ${e.nama}`}>
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
          <p className="t-caption mt-1">{EMPLOYEES.length} karyawan terdaftar</p>
        </div>
        <a
          href="/employees/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-on shadow-e1 transition-all duration-fast ease-standard hover:opacity-90 hover:shadow-e2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Karyawan
        </a>
      </div>

      <div className="mt-4 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Cari nama, jabatan, atau NIK…"
          aria-label="Cari karyawan"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            aria-label="Filter status"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-onsurface-variant">
            <span className="t-caption">Jenis kontrak</span>
            <select
              value={kontrak}
              onChange={(e) => setKontrak(e.target.value)}
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
          rowKey={(e) => e.nik}
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
    </AppShell>
  )
}
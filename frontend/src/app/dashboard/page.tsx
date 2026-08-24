'use client'

import { useState } from 'react'
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
  Icon,
  PriorityBanner,
  SegmentedControl,
  StatusChip,
} from '@/components/ui'
import { MetricCard } from '@/components/dashboard/metric-card'
import { MetricGrid } from '@/components/dashboard/metric-grid'

const RANGES = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: '30 hari' },
]

const METRICS = [
  {
    label: 'Total karyawan',
    value: 12,
    icon: Users,
    caption: '11 aktif · 1 nonaktif',
    delta: { value: '+1 bulan ini', trend: 'up' as const },
  },
  {
    label: 'Hadir hari ini',
    value: 10,
    unit: '/12',
    icon: CheckCircle2,
    caption: '83% kehadiran',
    delta: { value: '+4 poin vs rata-rata', trend: 'up' as const },
  },
  {
    label: 'Cuti menunggu',
    value: 2,
    icon: Calendar,
    caption: '1 tahunan · 1 sakit',
    delta: { value: '−1 dari kemarin', trend: 'down' as const },
  },
  {
    label: 'Gaji bulan ini',
    value: 'Rp 28.500.000',
    icon: Wallet,
    caption: 'Agustus 2026 · estimasi',
  },
]

const ATTENDANCE_STATS = [
  { count: 10, label: 'Hadir', variant: 'success' as const },
  { count: 2, label: 'Telat', variant: 'warning' as const },
  { count: 0, label: 'Absen', variant: 'danger' as const },
  { count: 0, label: 'Izin', variant: 'info' as const },
]

const PENDING_LEAVE = [
  {
    name: 'Siti Nurhaliza',
    role: 'Kasir',
    type: 'Cuti Tahunan',
    variant: 'info' as const,
    range: '22 – 23 Agustus 2026',
    days: '2 hari',
  },
  {
    name: 'Budi Prasetyo',
    role: 'Barista',
    type: 'Izin Sakit',
    variant: 'warning' as const,
    range: '20 Agustus 2026',
    days: '1 hari',
  },
]

const QUICK_ACTIONS = [
  { label: 'Rekap absensi', icon: Clock, href: '/attendance' },
  { label: 'Tambah karyawan', icon: Plus, href: '/employees' },
  { label: 'Jalankan payroll', icon: Wallet, href: '/payroll' },
]

export default function DashboardPage() {
  const [range, setRange] = useState('today')

  return (
    <AppShell
      userRole="owner"
      activeNav="dashboard"
      title="Selamat pagi, Pak Darmawan"
      subtitle="Warung Kopi Nusantara · Rabu, 19 Agustus 2026"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Ringkasan hari ini</h1>
          <p className="t-caption mt-1">
            Rabu, 19 Agustus 2026 · data terakhir masuk{' '}
            <time dateTime="2026-08-19T08:12">08:12 WIB</time>
          </p>
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

      <div className="mt-4">
        <PriorityBanner
          variant="warning"
          icon={AlertTriangle}
          title="2 pengajuan cuti menunggu keputusan Anda"
          description="Paling lama menunggu 2 hari. Karyawan tidak bisa mengatur jadwal sebelum disetujui."
          action={{ label: 'Tinjau', href: '/leave' }}
        />
      </div>

      <MetricGrid className="mt-4">
        {METRICS.map((m) => (
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
            <Button variant="text" size="sm">
              Semua
            </Button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ATTENDANCE_STATS.map((s) => (
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
              <p className="t-caption mt-0.5">2 pengajuan · urut dari yang paling lama</p>
            </div>
            <Button variant="text" size="sm">
              Lihat semua
            </Button>
          </div>

          <ul className="divide-y divide-outline-variant">
            {PENDING_LEAVE.map((l) => (
              <li key={l.name} className="flex items-center gap-3 p-5">
                <Avatar name={l.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="t-h3">{l.name}</p>
                    <StatusChip variant={l.variant} label={l.type} />
                    <span className="t-caption">{l.role}</span>
                  </div>
                  <p className="t-body-sm mt-1 tabular-nums">
                    {l.range} · <span className="font-semibold">{l.days}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="tonal" size="sm">
                    Setujui
                  </Button>
                  <Button variant="text" size="sm">
                    Tolak
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4" aria-labelledby="h-quick">
        <h2 className="t-h2" id="h-quick">
          Aksi cepat
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map((a) => {
            const IconCmp = a.icon
            return (
              <a
                key={a.label}
                href={a.href}
                className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-card p-4 transition hover:shadow-e2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary-oncontainer">
                  <IconCmp className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-onsurface-variant" />
              </a>
            )
          })}
        </div>
      </section>
    </AppShell>
  )
}

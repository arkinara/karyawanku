import { AppShell } from '@/components/ui'

/**
 * Owner dashboard shell demo (03-quick-dashboard-owner.html equivalent).
 * Real dashboard content lands in ticket #3+.
 */
export default function DashboardPage() {
  return (
    <AppShell
      userRole="owner"
      activeNav="dashboard"
      title="Selamat pagi, Pak Darmawan"
      subtitle="Warung Kopi Nusantara · Rabu, 19 Agustus 2026"
    >
      <h1 className="t-h1">Ringkasan hari ini</h1>
      <p className="t-body-sm t-muted mt-1">
        Konten dashboard (metric cards, banner, tabel) menyusul di ticket halaman.
      </p>
    </AppShell>
  )
}
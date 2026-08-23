import { AppShell } from '@/components/ui'

/**
 * Employee home shell demo (04-quick-dashboard-employee.html equivalent).
 * Real content lands in a later ticket.
 */
export default function BerandaPage() {
  return (
    <AppShell
      userRole="employee"
      activeNav="home"
      title="Selamat pagi, Siti"
      subtitle="Warung Kopi Nusantara · Rabu, 19 Agustus 2026"
    >
      <h1 className="t-h1">Beranda</h1>
      <p className="t-body-sm t-muted mt-1">
        Widget check-in dan jadwal menyusul di ticket halaman karyawan.
      </p>
    </AppShell>
  )
}
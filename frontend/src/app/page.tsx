import Link from 'next/link'

/**
 * Placeholder root. Real auth/routing lands in later tickets; for now this is
 * a simple landing that lets QA open either role's shell.
 */
export default function HomePage() {
  return (
    <main className="min-h-dvh grid place-items-center bg-surface-1 p-8 text-on-surface">
      <div className="max-w-md w-full rounded-2xl border border-outline-variant bg-surface p-8 text-center shadow-e1">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-xl font-bold text-on-primary">
          K
        </div>
        <h1 className="t-display mt-6">KaryawanKu</h1>
        <p className="t-body-sm t-muted mt-2">
          Manajemen karyawan, absensi, cuti, dan payroll — dalam satu tempat.
        </p>

        <nav aria-label="Demo shell" className="mt-8 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-container hover:bg-primary-container/70"
          >
            Buka shell — Pemilik (dashboard)
          </Link>
          <Link
            href="/beranda"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-container hover:bg-primary-container/70"
          >
            Buka shell — Karyawan (beranda)
          </Link>
        </nav>
      </div>
    </main>
  )
}
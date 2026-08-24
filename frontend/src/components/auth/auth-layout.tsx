import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'

/**
 * Shared auth layout (UX-SPEC §3, page 02). No AppShell — a standalone split:
 * desktop shows a brand panel on the left and the form card on the right;
 * mobile is card-only. The `<main>` column is where each page drops its card.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:grid-cols-2">
      {/* Brand panel — desktop only, decorative */}
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-between overflow-hidden bg-primary px-10 py-12 text-primary-on lg:flex xl:px-14"
      >
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-white/50 blur-3xl" />
          <div className="absolute -bottom-40 -right-24 h-[24rem] w-[24rem] rounded-full bg-white/30 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-white/15 text-xl font-bold ring-1 ring-white/25">
            K
          </span>
          <span className="text-xl font-semibold tracking-tight">KaryawanKu</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-[34px] font-bold leading-[1.15] tracking-tight xl:text-[40px]">
            Absensi, cuti, dan gaji.
            <br />
            Satu tempat, tanpa spreadsheet.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-primary-on/80">
            Kelola karyawan cafe Anda dengan mudah — dari absensi, cuti, sampai
            gaji, tanpa perlu tim HR.
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-primary-on/80">
          <span>2.000+ usaha kecil</span>
          <span aria-hidden="true">·</span>
          <span>Data disimpan di Indonesia</span>
          <span aria-hidden="true">·</span>
          <span>Sesuai UU Ketenagakerjaan</span>
        </div>
      </aside>

      {/* Form column */}
      <main id="main" className="flex flex-col px-4 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8">
          <Link
            href="/"
            className="flex w-fit items-center gap-1.5 text-sm text-onsurface-variant transition-colors hover:text-primary"
          >
            <Icon name="arrowLeft" size={16} />
            KaryawanKu
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

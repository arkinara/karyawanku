/**
 * KaryawanKu — Indonesian locale formatters.
 *
 * Formatter instances are module-level singletons: `Intl.*` constructors are
 * expensive and these are called once per table row.
 */

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const tanggalFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const jamFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Coerce a `Date | string` input into a Date, or `null` when unparseable. */
function toDate(d: Date | string): Date | null {
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `1500000` -> `"Rp 1.500.000"` */
export function formatIDR(n: number): string {
  if (!Number.isFinite(n)) return '-'
  return idrFormatter.format(n)
}

/** `"2026-08-19"` -> `"19/08/2026"` */
export function formatTanggal(d: Date | string): string {
  const date = toDate(d)
  if (!date) return '-'
  return tanggalFormatter.format(date)
}

/** `"2026-08-19T07:05:00"` -> `"07.05"` normalized to `"07:05"` (24h) */
export function formatJam(d: Date | string): string {
  const date = toDate(d)
  if (!date) return '-'
  // id-ID renders `HH.MM`; the app standard is a colon separator.
  return jamFormatter.format(date).replace('.', ':')
}

/** `"Budi Santoso"` -> `"BS"`; single-word names yield one letter. */
export function initials(nama: string): string {
  return nama
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

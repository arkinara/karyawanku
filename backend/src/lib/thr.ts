/**
 * KaryawanKu — kalkulasi THR (Tunjangan Hari Raya Keagamaan, ticket #55).
 *
 * Mengacu Permenaker 6/2016:
 * - THR wajib dibayarkan setahun sekali menjelang hari raya keagamaan,
 *   paling lambat 7 hari sebelum hari raya.
 * - Karyawan dengan masa kerja ≥ 12 bulan berhak 1× upah (THR penuh).
 * - Karyawan dengan masa kerja 1–11 bulan berhak prorata:
 *   `upah × masa_kerja / 12`.
 * - Karyawan dengan masa kerja < 1 bulan tidak berhak (0).
 * - Basis upah = gaji pokok + tunjangan tetap (komponen earning ber-`is_fixed=true`).
 *   Tunjangan variabel / tidak tetap tidak dihitung.
 *
 * Fungsi murni, tanpa dependensi DB — mudah diuji. Nilai komponen efektif
 * (override/formula/nominal) diselesaikan oleh pemanggil (route), komponen
 * di sini hanya menerima nilai jadi + flag is_fixed.
 */

export interface ThrSalaryComponent {
  nama_komponen: string
  is_fixed: boolean
  nilai: number
}

export interface ThrEmployee {
  /** Tanggal masuk karyawan, format 'YYYY-MM-DD'. Null → tidak berhak. */
  tanggal_masuk: string | null
  /** Komponen earning aktif karyawan dengan nilai efektif ter-solve. */
  salaryComponents: ThrSalaryComponent[]
}

export interface ComputeThrOptions {
  /**
   * Tanggal acuan untuk menghitung masa kerja (format 'YYYY-MM-DD' atau Date).
   * Default: sekarang. Untuk pencairan THR biasanya = tanggal_bayar.
   */
  referenceDate?: string | Date
}

export interface ThrResult {
  amount: number
  basis: number
  proratedMonths: number
  monthsOfService: number
  eligible: boolean
  /** Proporsi upah yang dibayarkan: 1 untuk penuh, masa_kerja/12 untuk prorata, 0 bila tidak berhak. */
  proportion: number
  formula: string
}

const roundRupiah = (value: number): number => Math.round(value)

function toDate(value: string | Date | undefined): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Jumlah bulan penuh antara dua tanggal (bulan belum lengkap bila tanggal belum lewat). */
function monthsBetween(hire: Date, ref: Date): number {
  let months = (ref.getFullYear() - hire.getFullYear()) * 12 + (ref.getMonth() - hire.getMonth())
  if (ref.getDate() < hire.getDate()) months -= 1
  return months
}

export function computeThr(employee: ThrEmployee, options: ComputeThrOptions = {}): ThrResult {
  const reference = toDate(options.referenceDate) ?? new Date()

  const basis = roundRupiah(
    (employee.salaryComponents ?? [])
      .filter((c) => c.is_fixed)
      .reduce((sum, c) => sum + (Number.isFinite(c.nilai) ? c.nilai : 0), 0),
  )

  if (!employee.tanggal_masuk) {
    return {
      amount: 0,
      basis,
      proratedMonths: 0,
      monthsOfService: 0,
      eligible: false,
      proportion: 0,
      formula: 'ineligible:no_hire_date',
    }
  }

  const hire = new Date(employee.tanggal_masuk)
  if (Number.isNaN(hire.getTime())) {
    return {
      amount: 0,
      basis,
      proratedMonths: 0,
      monthsOfService: 0,
      eligible: false,
      proportion: 0,
      formula: 'ineligible:invalid_hire_date',
    }
  }

  // Tanggal masuk di masa depan (relatif tanggal acuan) → belum punya masa kerja.
  if (hire.getTime() > reference.getTime()) {
    return {
      amount: 0,
      basis,
      proratedMonths: 0,
      monthsOfService: 0,
      eligible: false,
      proportion: 0,
      formula: 'ineligible:hire_date_in_future',
    }
  }

  const monthsOfService = monthsBetween(hire, reference)

  // Masa kerja < 1 bulan atau tanpa basis upah (tidak ada tunjangan tetap) → 0.
  if (monthsOfService < 1 || basis <= 0) {
    return {
      amount: 0,
      basis,
      proratedMonths: 0,
      monthsOfService,
      eligible: false,
      proportion: 0,
      formula: 'ineligible:months_or_basis_zero',
    }
  }

  if (monthsOfService >= 12) {
    return {
      amount: basis,
      basis,
      proratedMonths: 12,
      monthsOfService,
      eligible: true,
      proportion: 1,
      formula: `upah × 1 (masa kerja ${monthsOfService} bulan ≥ 12)`,
    }
  }

  const proratedMonths = monthsOfService
  const proportion = proratedMonths / 12
  const amount = roundRupiah(basis * proportion)

  return {
    amount,
    basis,
    proratedMonths,
    monthsOfService,
    eligible: true,
    proportion,
    formula: `upah × ${proratedMonths}/12 (masa kerja ${monthsOfService} bulan)`,
  }
}
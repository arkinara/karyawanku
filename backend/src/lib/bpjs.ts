/**
 * KaryawanKu — kalkulasi BPJS Kesehatan & BPJS Ketenagakerjaan (ticket #29).
 *
 * Semua persentase dihitung dari gaji pokok (bukan gross).
 * - BPJS Kesehatan: 1% karyawan + 4% pemberi kerja.
 * - BPJS Ketenagakerjaan (tarif UU Cipta Kerja):
 *   - JHT: 2% karyawan + 3,7% pemberi kerja
 *   - JP: 1% karyawan + 2% pemberi kerja
 *   - JKK: pemberi kerja saja (default 1%, risiko rendah)
 *   - JKM: pemberi kerja saja, 0,3%
 *
 * Hanya bagian karyawan (kesehatan 1%, JHT 2%, JP 1%) yang memotong take-home.
 */

export interface BpjsJhtJp {
  employee: number
  employer: number
}

export interface BpjsKesehatan {
  employee: number
  employer: number
}

export interface BpjsKetenagakerjaan {
  jht: BpjsJhtJp
  jp: BpjsJhtJp
  jkk: number
  jkm: number
}

export interface BpjsResult {
  bpjsKesehatan: BpjsKesehatan
  bpjsKetenagakerjaan: BpjsKetenagakerjaan
}

export const BPJS_KESEHATAN_RATES = {
  employee: 0.01,
  employer: 0.04,
} as const

export const BPJS_TK_RATES = {
  jht: { employee: 0.02, employer: 0.037 },
  jp: { employee: 0.01, employer: 0.02 },
  jkk: 0.01,
  jkm: 0.003,
} as const

function roundRupiah(value: number): number {
  return Math.round(value)
}

export function calculateBPJS(gajiPokok: number): BpjsResult {
  const base = Number.isFinite(gajiPokok) ? Math.max(0, gajiPokok) : 0
  const kes = BPJS_KESEHATAN_RATES
  const tk = BPJS_TK_RATES

  return {
    bpjsKesehatan: {
      employee: roundRupiah(base * kes.employee),
      employer: roundRupiah(base * kes.employer),
    },
    bpjsKetenagakerjaan: {
      jht: {
        employee: roundRupiah(base * tk.jht.employee),
        employer: roundRupiah(base * tk.jht.employer),
      },
      jp: {
        employee: roundRupiah(base * tk.jp.employee),
        employer: roundRupiah(base * tk.jp.employer),
      },
      jkk: roundRupiah(base * tk.jkk),
      jkm: roundRupiah(base * tk.jkm),
    },
  }
}

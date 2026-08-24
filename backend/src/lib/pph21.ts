/**
 * KaryawanKu — kalkulasi PPh 21 progresif (ticket #30).
 *
 * Perhitungan referensi (bukan layanan pelaporan pajak):
 * - PTKP tahunan per status (UU HPP / PPh 21):
 *     TK/0 54jt, K/0 58,5jt, K/1 63jt, K/2 67,5jt, K/3 72jt
 * - Biaya jabatan: 5% penghasilan bruto, maks 500rb/bulan = 6jt/tahun.
 * - PKP tahunan = penghasilan bruto tahunan - PTKP - biaya jabatan.
 * - Lapisan progresif diterapkan berjenjang:
 *     s.d. 60jt 5% | 60jt-250jt 15% | 250jt-500jt 25% | 500jt-5M 30% | >5M 35%
 * - PPh21 bulanan = PPh21 tahunan / 12.
 * - Jika status PTKP tidak diberikan, default TK/0 dengan penanda di breakdown.
 */

export const PTKP_CATEGORIES = ['TK/0', 'K/0', 'K/1', 'K/2', 'K/3'] as const
export type PtkpCategory = (typeof PTKP_CATEGORIES)[number]

export const PTKP_ANNUAL_THRESHOLDS: Record<PtkpCategory, number> = {
  'TK/0': 54_000_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
}

export const BIASA_JABATAN_RATE = 0.05
export const BIASA_JABATAN_MAX_ANNUAL = 6_000_000

export interface Pph21BracketInput {
  max: number
  rate: number
}

export const PPH21_BRACKETS: Pph21BracketInput[] = [
  { max: 60_000_000, rate: 0.05 },
  { max: 250_000_000, rate: 0.15 },
  { max: 500_000_000, rate: 0.25 },
  { max: 5_000_000_000, rate: 0.3 },
  { max: Infinity, rate: 0.35 },
]

export interface Pph21Bracket {
  bracket: string
  rate: number
  amount: number
}

export interface Pph21Result {
  annualPPh21: number
  monthlyPPh21: number
  breakdown: {
    ptkpCategory: string
    ptkpThreshold: number
    ptkpDefaulted: boolean
    annualGrossIncome: number
    biayaJabatan: number
    pkp: number
    brackets: Pph21Bracket[]
  }
}

export function isPtkpCategory(value: unknown): value is PtkpCategory {
  return typeof value === 'string' && (PTKP_CATEGORIES as readonly string[]).includes(value)
}

function formatBracket(lo: number, hi: number): string {
  if (hi === Infinity) return `>${lo / 1_000_000}jt`
  const maxInJt = hi / 1_000_000
  if (maxInJt >= 1_000) return `>500jt-${maxInJt / 1_000}M`
  return `${lo / 1_000_000}jt-${maxInJt}jt`
}

function roundRupiah(value: number): number {
  return Math.round(value)
}

export function calculatePPh21(annualGrossIncome: number, ptkpCategory?: PtkpCategory): Pph21Result {
  const ptkpDefaulted = !isPtkpCategory(ptkpCategory)
  const category: PtkpCategory = ptkpDefaulted ? 'TK/0' : ptkpCategory
  const ptkpThreshold = PTKP_ANNUAL_THRESHOLDS[category]

  const gross = Number.isFinite(annualGrossIncome) ? Math.max(0, annualGrossIncome) : 0
  const biayaJabatan = roundRupiah(Math.min(gross * BIASA_JABATAN_RATE, BIASA_JABATAN_MAX_ANNUAL))
  const pkp = Math.max(0, gross - ptkpThreshold - biayaJabatan)

  let remaining = pkp
  let lowerBound = 0
  const brackets: Pph21Bracket[] = []
  let annualPPh21 = 0

  for (const bracket of PPH21_BRACKETS) {
    if (remaining <= 0) break
    const slice = Math.min(remaining, bracket.max - lowerBound)
    if (slice <= 0) continue
    const amount = roundRupiah(slice * bracket.rate)
    brackets.push({ bracket: formatBracket(lowerBound, bracket.max), rate: bracket.rate, amount })
    annualPPh21 += amount
    remaining -= slice
    lowerBound = bracket.max
  }

  return {
    annualPPh21,
    monthlyPPh21: roundRupiah(annualPPh21 / 12),
    breakdown: {
      ptkpCategory: category,
      ptkpThreshold,
      ptkpDefaulted,
      annualGrossIncome: gross,
      biayaJabatan,
      pkp,
      brackets,
    },
  }
}

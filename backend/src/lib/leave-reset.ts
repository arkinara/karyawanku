import { and, eq } from 'drizzle-orm'
import { getDb, type DB } from '../db/index.js'
import {
  businesses,
  employees,
  leaveBalances,
  leaveTypes,
  systemState,
  type Employee,
  type LeaveBalance,
  type LeaveType,
} from '../db/schema.js'

/** Key `system_state` yang mencatat tahun terakhir reset tahunan saldo cuti. */
export const SYSTEM_STATE_KEY_LAST_LEAVE_RESET = 'last_leave_reset_year'
/** Key `system_state` yang dicadangkan untuk proses THR berkala (belum dipakai). */
export const SYSTEM_STATE_KEY_LAST_THR_RESET = 'last_thr_reset_year'

/** Jenis cuti tahunan dikenali dari nama (case-insensitive). */
export function isAnnualLeaveType(nama: string): boolean {
  return /tahunan/i.test(nama)
}

/**
 * Menghitung kuota cuti tahunan mengikuti UU Cipta Kerja:
 * masa kerja >= 1 tahun → kuota penuh (default_kuota_hari);
 * masa kerja < 1 tahun → prorata (default_kuota_hari x bulan kerja / 12).
 * Jenis cuti non-tahunan memakai default_kuota_hari apa adanya.
 */
export function computeQuotaForType(leaveType: LeaveType, tanggalMasuk: string, referenceDate: Date): number {
  const base = leaveType.default_kuota_hari
  if (!isAnnualLeaveType(leaveType.nama_jenis_cuti)) return base

  const months = fullMonthsSince(tanggalMasuk, referenceDate)
  if (months >= 12) return base
  return Math.floor((base * Math.max(months, 0)) / 12)
}

/** Jumlah bulan penuh dari tanggal_masuk sampai referenceDate. */
export function fullMonthsSince(tanggalMasuk: string, referenceDate: Date): number {
  const [y1, m1, d1] = tanggalMasuk.split('-').map(Number)
  const y2 = referenceDate.getUTCFullYear()
  const m2 = referenceDate.getUTCMonth() + 1
  const d2 = referenceDate.getUTCDate()
  let months = (y2 - y1) * 12 + (m2 - m1)
  if (d1 > d2) months -= 1
  return months
}

/**
 * Jenis cuti default yang di-seed saat pertama kali dipakai sebuah bisnis.
 * Tahunan memakai kebijakan carry-over (maks 5 hari), sisanya hangus.
 */
export const DEFAULT_LEAVE_TYPES: Array<{
  nama_jenis_cuti: string
  default_kuota_hari: number
  kebijakan_sisa: 'hangus' | 'carry-over'
  carry_over_max_days: number | null
}> = [
  { nama_jenis_cuti: 'Tahunan', default_kuota_hari: 12, kebijakan_sisa: 'carry-over', carry_over_max_days: 5 },
  { nama_jenis_cuti: 'Sakit', default_kuota_hari: 5, kebijakan_sisa: 'hangus', carry_over_max_days: null },
  { nama_jenis_cuti: 'Izin', default_kuota_hari: 3, kebijakan_sisa: 'hangus', carry_over_max_days: null },
  { nama_jenis_cuti: 'Melahirkan', default_kuota_hari: 90, kebijakan_sisa: 'hangus', carry_over_max_days: null },
]

/**
 * Menyediakan jenis cuti default bila bisnis belum punya satupun.
 * Idempoten — hanya menambah bila jumlah jenis cuti bisnis == 0.
 */
export function ensureLeaveTypesSeeded(businessId: string): void {
  const { db } = getDb()
  const count = db.select().from(leaveTypes).where(eq(leaveTypes.business_id, businessId)).all().length
  if (count > 0) return
  for (const t of DEFAULT_LEAVE_TYPES) {
    db.insert(leaveTypes)
      .values({
        business_id: businessId,
        nama_jenis_cuti: t.nama_jenis_cuti,
        default_kuota_hari: t.default_kuota_hari,
        kebijakan_sisa: t.kebijakan_sisa,
        carry_over_max_days: t.carry_over_max_days,
        aktif: true,
      })
      .run()
  }
}

function findBalance(employeeId: string, leaveTypeId: string, tahun: number): LeaveBalance | undefined {
  const { db } = getDb()
  return db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employee_id, employeeId),
        eq(leaveBalances.leave_type_id, leaveTypeId),
        eq(leaveBalances.tahun, tahun),
      ),
    )
    .get()
}

/**
 * Memastikan ada saldo cuti untuk (employee, leave_type, tahun).
 * Bila belum ada, buat dengan kuota dari masa kerja (referenceDate) + carry-over
 * dari tahun sebelumnya sesuai kebijakan. Idempoten.
 */
export function ensureLeaveBalance(
  employee: Employee,
  leaveType: LeaveType,
  tahun: number,
  referenceDate: Date,
): LeaveBalance {
  const { db } = getDb()
  const existing = findBalance(employee.id, leaveType.id, tahun)
  if (existing) return existing

  let kuota = computeQuotaForType(leaveType, employee.tanggal_masuk, referenceDate)
  if (leaveType.kebijakan_sisa === 'carry-over') {
    const prev = findBalance(employee.id, leaveType.id, tahun - 1)
    if (prev) {
      const sisa = Math.max(0, prev.kuota_hari - prev.terpakai_hari)
      const cap = leaveType.carry_over_max_days
      const carry = cap == null ? sisa : Math.min(sisa, cap)
      kuota += carry
    }
  }

  return db
    .insert(leaveBalances)
    .values({ employee_id: employee.id, leave_type_id: leaveType.id, tahun, kuota_hari: kuota, terpakai_hari: 0 })
    .returning()
    .get()
}

/**
 * Tanggal acuan untuk menghitung masa kerja pada tahun saldo:
 * tahun berjalan → sekarang (agar karyawan yang baru masuk dapat kuota prorata),
 * tahun lain → 1 Januari tahun tsb (sesuai aturan reset tahunan).
 */
export function referenceDateForYear(tahun: number): Date {
  const now = new Date()
  if (tahun === now.getUTCFullYear()) return now
  return new Date(Date.UTC(tahun, 0, 1))
}

export interface YearlyResetResult {
  business_id: string
  tahun: number
  created: number
  skipped: number
}

/**
 * Reset tahunan: menghitung ulang saldo cuti semua karyawan aktif untuk `tahun`.
 * Kuota cuti tahunan berdasar masa kerja per 1 Januari; sisa tahun lalu dipindah
 * bila kebijakan carry-over (maks carry_over_max_days), hangus bila hangus.
 * Idempoten — baris saldo yang sudah ada tidak dibuat ulang.
 */
export function runYearlyReset(businessId: string, tahun: number): YearlyResetResult {
  const { db } = getDb()
  ensureLeaveTypesSeeded(businessId)

  const types = db
    .select()
    .from(leaveTypes)
    .where(and(eq(leaveTypes.business_id, businessId), eq(leaveTypes.aktif, true)))
    .all()
  const activeEmps = db
    .select()
    .from(employees)
    .where(and(eq(employees.business_id, businessId), eq(employees.status, 'aktif')))
    .all()

  const referenceDate = new Date(Date.UTC(tahun, 0, 1))
  let created = 0
  let skipped = 0

  for (const emp of activeEmps) {
    for (const type of types) {
      const existing = findBalance(emp.id, type.id, tahun)
      if (existing) {
        skipped++
        continue
      }
      ensureLeaveBalance(emp, type, tahun, referenceDate)
      created++
    }
  }

  return { business_id: businessId, tahun, created, skipped }
}

export interface YearlyResetIfNeededResult {
  /** Tahun yang diperiksa/direset. */
  tahun: number
  /** true bila reset benar-benar dijalankan untuk tahun ini. */
  ran: boolean
  /** Alasan: first_run (baris system_state belum ada), new_year (tahun berganti), already_current (sudah dijalankan tahun ini). */
  reason: 'first_run' | 'new_year' | 'already_current'
  /** Hasil reset per bisnis (kosong bila tidak menjalankan apa-apa). */
  businesses: YearlyResetResult[]
}

/**
 * Reset tahunan terjadwal (ticket #56) — dipanggil otomatis saat server start.
 *
 * Memeriksa `system_state` untuk key `last_leave_reset_year`:
 * - Belum ada baris → catat `last_leave_reset_year = tahun` lalu jalankan reset
 *   saldo cuti untuk tahun ini di SEMUA bisnis (`reason: 'first_run'`).
 * - Baris ada dengan tahun sama → sudah dijalankan tahun ini, tidak melakukan
 *   apa-apa (`reason: 'already_current'`, idempoten).
 * - Baris ada dengan tahun lama → tahun berganti, jalankan reset untuk tahun
 *   berjalan (`reason: 'new_year'`).
 *
 * `runYearlyReset` sendiri sudah idempoten (baris saldo yang ada tidak dibuat
 * ulang), sehingga aman dipanggil berkali-kali untuk tahun yang sama.
 */
export async function runYearlyResetIfNeeded(tahun: number, db: DB): Promise<YearlyResetIfNeededResult> {
  const state = db.select().from(systemState).where(eq(systemState.key, SYSTEM_STATE_KEY_LAST_LEAVE_RESET)).get()

  if (state && Number(state.value) === tahun) {
    return { tahun, ran: false, reason: 'already_current', businesses: [] }
  }

  const bizRows = db.select({ id: businesses.id }).from(businesses).all()
  const results = bizRows.map((b) => runYearlyReset(b.id, tahun))

  db.insert(systemState)
    .values({ key: SYSTEM_STATE_KEY_LAST_LEAVE_RESET, value: tahun })
    .onConflictDoUpdate({ target: systemState.key, set: { value: tahun } })
    .run()

  return { tahun, ran: true, reason: state ? 'new_year' : 'first_run', businesses: results }
}

/**
 * KaryawanKu — layanan idempotensi submission absensi (ticket #70).
 *
 * Tujuan: mengirim tindakan clock-in/out yang sama dua kali (retry antrian
 * offline, respons hilang di tengah jalan, double-tap) menghasilkan SATU record
 * absensi. Mekanisme:
 *
 * 1. `findIdempotentResult` — sebelum menulis, cek apakah (key, employee,
 *    endpoint) sudah pernah sukses. Bila ya dan belum kedaluwarsa, kembalikan
 *    record asli untuk direplay (tanpa write baru).
 * 2. `recordIdempotency` — dipanggil DI DALAM transaksi yang sama dengan write
 *    absensi, SEBELUM respons sukses dikirim. Karena `idempotency_key` adalah
 *    primary key, key yang sudah dipakai (oleh karyawan lain / endpoint lain)
 *    membuat insert batal → caller menerjemahkannya menjadi 422.
 * 3. `purgeExpired` — job harian (dipanggil bersama purge selfie) menghapus
 *    key yang lewat `expires_at` (30 hari).
 *
 * Key yang kedaluwarsa TIDAK pernah dipakai untuk menahan double-write: lookup
 * memfilter `expires_at > now`, dan `recordIdempotency` menghapus baris
 * kedaluwarsa dengan key yang sama sebelum insert sehingga key lama bisa
 * dipakai ulang seolah-olah baru.
 */
import { and, eq, gt, lte, type SQL } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import {
  attendanceIdempotency,
  type NewAttendanceIdempotency,
} from '../db/schema.js'

/** Jendela pemakaian idempotency key (hari) — default expires_at di schema. */
export const IDEMPOTENCY_WINDOW_DAYS = 30

/** Bentuk minimal handle DB yang diterima `recordIdempotency` (db atau tx). */
export interface IdempotencyWriteDb {
  delete: (table: typeof attendanceIdempotency) => {
    where: (condition?: SQL | undefined) => { run: () => unknown }
  }
  insert: (table: typeof attendanceIdempotency) => {
    values: (row: NewAttendanceIdempotency) => { run: () => unknown }
  }
}

export interface RecordIdempotencyParams {
  key: string
  employeeId: string
  attendanceId: string
  /** `clock_in` | `clock_out` — endpoint yang memproduksi record ini. */
  endpoint: 'clock_in' | 'clock_out'
}

/**
 * Cari hasil idempoten untuk (key, employee, endpoint). Mengembalikan
 * `attendance_id` dari record asli bila ada dan belum kedaluwarsa, atau `null`
 * bila belum pernah sukses / key kedaluwarsa (dianggap "key tidak dikirim").
 */
export function findIdempotentResult(
  key: string,
  employeeId: string,
  endpoint: 'clock_in' | 'clock_out',
): { attendanceId: string } | null {
  const { db } = getDb()
  const row = db
    .select({ attendanceId: attendanceIdempotency.attendance_id })
    .from(attendanceIdempotency)
    .where(
      and(
        eq(attendanceIdempotency.idempotency_key, key),
        eq(attendanceIdempotency.employee_id, employeeId),
        eq(attendanceIdempotency.endpoint, endpoint),
        gt(attendanceIdempotency.expires_at, new Date()),
      ),
    )
    .get()
  return row ? { attendanceId: row.attendanceId } : null
}

/**
 * Catat key idempotensi, ATOMIS dengan write absensi (panggil dengan `tx` dari
 * `db.transaction((tx) => ...)`, sebelum respons dikirim). Baris kedaluwarsa
 * dengan key yang sama dibersihkan dulu sehingga key lama bisa dipakai ulang.
 *
 * Melempar bila key sudah terpakai (belum kedaluwarsa) — oleh karyawan lain
 * atau endpoint lain — karena primary key `idempotency_key` bentrok; caller
 * menerjemahkannya menjadi 422 (menolak berbagi key antar karyawan).
 */
export function recordIdempotency(
  tx: IdempotencyWriteDb,
  params: RecordIdempotencyParams,
): void {
  const { key, employeeId, attendanceId, endpoint } = params
  tx.delete(attendanceIdempotency)
    .where(
      and(
        eq(attendanceIdempotency.idempotency_key, key),
        lte(attendanceIdempotency.expires_at, new Date()),
      ),
    )
    .run()
  tx.insert(attendanceIdempotency)
    .values({ idempotency_key: key, employee_id: employeeId, attendance_id: attendanceId, endpoint })
    .run()
}

/**
 * Hapus semua key yang sudah lewat `expires_at`. Mengembalikan jumlah baris
 * yang dihapus. Dipanggil job harian (bersama purge selfie) saat boot server.
 */
export function purgeExpired(): number {
  const { db } = getDb()
  const result = db
    .delete(attendanceIdempotency)
    .where(lte(attendanceIdempotency.expires_at, new Date()))
    .run()
  return result.changes ?? 0
}
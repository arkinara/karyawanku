/**
 * KaryawanKu — scheduler pengingat shift (ticket #71).
 *
 * Pola: cron tick tiap menit memindai `shift_assignments` yang `published`,
 * belum mulai, dan masuk jendela (start_at − reminder_lead_minutes ≤ now).
 * Pengingat yang layak dikirim SEKALI per assignment — idempotensi dijamin
 * tabel `shift_reminder_log` (PK = assignment_id), ditulis SEBELUM notifikasi
 * dikirim di dalam tick. Crash di antara keduanya tidak membuat pengingat
 * ganda; restart server aman (baris yang sudah ada dilewati).
 *
 * `scheduleForAssignment` adalah no-op yang terdokumentasi: karena scheduler
 * memakai scan-dan-tick, "menjadwalkan" cukup berarti assignment akan terpindai
 * pada tick berikutnya. Fungsi dipertahankan untuk simetri API.
 *
 * Skip: pengingat dimatikan user (`shift_reminders_enabled = 0`), shift yang
 * dibatalkan/tidak dipublikasi, dan shift yang sudah di-clock-in.
 */
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import {
  attendanceRecords,
  businesses,
  employees,
  reminderSettings,
  shiftAssignments,
  shiftReminderLog,
  shifts,
  users,
} from '../db/schema.js'
import { sendNotification } from './push-service.js'
import { retryDue } from './push-service.js'

export const TICK_INTERVAL_MS = 60_000
/** Default lead time bila user belum punya baris reminder_settings. */
export const DEFAULT_REMINDER_LEAD_MINUTES = 30

function startAtFor(tanggal: string, jamMulai: string): Date {
  const [y, m, d] = tanggal.split('-').map(Number)
  const [hh, mm] = jamMulai.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0)
}

/** Memastikan assignment dijadwalkan (no-op — lihat doc module). */
export function scheduleForAssignment(_assignmentId: string): void {
  // Scan-and-tick scheduler: setiap assignment published akan dipindai tiap
  // menit; tidak ada job one-shot eksplisit yang perlu didaftarkan.
}

interface Candidate {
  assignmentId: string
  employeeId: string
  tanggal: string
  jamMulai: string
  businessName: string
}

/** Satu tick: kirim pengingat yang sudah jatuh tempo + proses retry push. */
export function runTick(now = new Date()): number {
  const { db } = getDb()
  let fired = 0

  const rows: Candidate[] = db
    .select({
      assignmentId: shiftAssignments.id,
      employeeId: shiftAssignments.employee_id,
      tanggal: shiftAssignments.tanggal,
      jamMulai: shifts.jam_mulai,
      businessName: businesses.nama_bisnis,
    })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
    .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
    .innerJoin(businesses, eq(employees.business_id, businesses.id))
    .where(eq(shiftAssignments.published, true))
    .all()

  for (const row of rows) {
    const start = startAtFor(row.tanggal, row.jamMulai)
    if (start.getTime() <= now.getTime()) continue // shift sudah mulai / lewat

    const user = db.select().from(users).where(eq(users.employee_id, row.employeeId)).get()
    if (!user) continue // tidak ada akun → tidak bisa dikirimi push

    const setting = db
      .select()
      .from(reminderSettings)
      .where(eq(reminderSettings.user_id, user.id))
      .get()
    if (setting && setting.shift_reminders_enabled === false) continue
    const lead = setting?.reminder_lead_minutes ?? DEFAULT_REMINDER_LEAD_MINUTES

    // Belum masuk jendela pengingat.
    if (start.getTime() - lead * 60_000 > now.getTime()) continue

    // Sudah pernah dikirim (idempotensi terhadap restart / tick ganda).
    const logged = db
      .select()
      .from(shiftReminderLog)
      .where(eq(shiftReminderLog.assignment_id, row.assignmentId))
      .get()
    if (logged) continue

    // Shift sudah di-clock-in → jangan ingatkan.
    const attended = db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employee_id, row.employeeId),
          eq(attendanceRecords.tanggal, row.tanggal),
        ),
      )
      .get()
    if (attended && attended.clock_in) continue

    // Fire: catat log SEBELUM kirim (idempoten), lalu kirim fire-and-forget.
    db.insert(shiftReminderLog)
      .values({ assignment_id: row.assignmentId, fired_at: now })
      .run()
    fired += 1

    const startAtIso = start.toISOString()
    void sendNotification(
      user.id,
      'shift_reminder',
      {
        title: 'Pengingat shift',
        body: `Shift Anda di ${row.businessName} mulai pukul ${row.jamMulai}. Siap-siap ${lead} menit lagi.`,
      },
      { kind: 'shift_reminder', assignmentId: row.assignmentId, startAt: startAtIso },
    )
  }

  // Retry push yang `next_retry_at`-nya sudah lewat (kebijakan terbatas).
  try {
    retryDue(now)
  } catch (err) {
    console.error('[push] retry push gagal:', err)
  }

  return fired
}

let timer: NodeJS.Timeout | null = null

export function startShiftReminderScheduler(): void {
  stopShiftReminderScheduler()
  try {
    runTick()
  } catch (err) {
    console.error('[karyawanku] tick shift reminder saat boot gagal:', err)
  }
  timer = setInterval(() => {
    try {
      runTick()
    } catch (err) {
      console.error('[karyawanku] tick shift reminder gagal:', err)
    }
  }, TICK_INTERVAL_MS)
  timer.unref?.()
}

export function stopShiftReminderScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
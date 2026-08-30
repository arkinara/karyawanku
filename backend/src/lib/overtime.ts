/**
 * KaryawanKu — kalkulasi lembur (ticket #54).
 *
 * Lembur diturunkan dari clock-out melebihi jam selesai shift, dengan batas
 * toleransi (`graceMinutes`) sebelum dianggap lembur. Nilai override manual
 * menang atas nilai turunan. Fungsi murni (pure) — tanpa dependensi DB —
 * sehingga mudah diuji.
 */

/** Default jam selesai shift saat tak ada shift terdaftar (shift 8 jam dari DEFAULT_SCHEDULE_START). */
export const DEFAULT_SCHEDULE_END = '16:00'

/** Batas toleransi default sebelum clock-out dianggap lembur (menit). */
export const DEFAULT_GRACE_MINUTES = 15

/** Maksimal lembur per hari (12 jam). */
export const MAX_OVERTIME_MINUTES = 12 * 60

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((n) => parseInt(n, 10))
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

/**
 * Hitung menit lembur dari waktu clock-in/out dan jam selesai shift.
 *
 * - `clockOut > jamSelesai + grace` → selisih dalam menit (dibulatkan).
 * - Clock-out dalam batas grace → 0.
 * - `overrideMinutes != null` → dipakai langsung (menang atas turunan).
 * - Shift lintas tengah malam dideteksi dari `scheduledShiftStartAt`
 *   (`jam_selesai < jam_mulai`, mis. Malam 22:00–06:00): jam selesai dihitung
 *   dari tanggal clock-in (instans shift yang dimasuki) + 1 hari, sehingga
 *   clock-out sore hari yang sama → shift belum usai → 0 lembur, sedangkan
 *   clock-out pagi hari berikutnya dihitung terhadap 06:00 hari itu.
 *   Tanpa `scheduledShiftStartAt`, dipakai heuristik jam clock-in.
 */
export function computeOvertimeMinutes(
  clockInAt: Date,
  clockOutAt: Date,
  scheduledShiftEndAt: string,
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
  overrideMinutes: number | null = null,
  scheduledShiftStartAt: string | null = null,
): number {
  if (overrideMinutes !== null) {
    return Math.max(0, Math.round(overrideMinutes))
  }

  const { hour, minute } = parseTime(scheduledShiftEndAt)

  const crossesMidnight =
    scheduledShiftStartAt != null
      ? hour < parseTime(scheduledShiftStartAt).hour
      : hour < clockInAt.getHours()

  const end = new Date(clockInAt.getTime())
  end.setHours(hour, minute, 0, 0)
  if (crossesMidnight) {
    end.setDate(end.getDate() + 1)
  }

  const thresholdMs = end.getTime() + graceMinutes * 60 * 1000
  const diffMinutes = (clockOutAt.getTime() - thresholdMs) / 60000
  return Math.max(0, Math.round(diffMinutes))
}
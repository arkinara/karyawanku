import 'dotenv/config'
import { migrate } from './db/migrate.js'
import { getDb } from './db/index.js'
import { runYearlyResetIfNeeded } from './lib/leave-reset.js'
import { getSelfieRetentionDays, purgeSelfiesOlderThan } from './lib/selfie-storage.js'
import { purgeExpired as purgeIdempotencyExpired } from './lib/attendance-idem.js'
import { start } from './app.js'

const SELFIE_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000
let purgeTimer: NodeJS.Timeout | null = null

/**
 * Job harian retensi selfie (ticket #69): menghapus foto yang sudah lewat
 * `retention_until` (default 90 hari) + file yatim. Dipanggil sekali saat boot
 * lalu tiap 24 jam. Gagal hanya dicatat ke log — server tetap berjalan.
 *
 * Sekaligus memanggil purge idempotency key kedaluwarsa (ticket #70, 30 hari)
 * pada interval yang sama.
 */
function scheduleSelfiePurge(): void {
  const run = (): void => {
    try {
      const retentionDays = getSelfieRetentionDays()
      const purged = purgeSelfiesOlderThan(retentionDays)
      if (purged > 0) {
        console.log(`[karyawanku] purge selfie: ${purged} file dihapus (retensi ${retentionDays} hari)`)
      }
    } catch (err) {
      console.error('[karyawanku] purge selfie gagal:', err)
    }
    try {
      const purged = purgeIdempotencyExpired()
      if (purged > 0) {
        console.log(`[karyawanku] purge idempotency: ${purged} key kedaluwarsa dihapus`)
      }
    } catch (err) {
      console.error('[karyawanku] purge idempotency gagal:', err)
    }
  }
  run()
  purgeTimer = setInterval(run, SELFIE_PURGE_INTERVAL_MS)
  purgeTimer.unref?.()
}

/**
 * Boot server. Migrasi skema TIDAK dijalankan otomatis — wajib eksplisit via
 * `npm run db:migrate` (deploy step). Set env `MIGRATE_ON_BOOT=1` hanya untuk
 * convenience dev/test.
 */
export async function boot(port?: number): Promise<void> {
  if (process.env.MIGRATE_ON_BOOT === '1') {
    migrate()
  }

  // Startup hook (ticket #56): reset tahunan saldo cuti berjalan otomatis saat
  // server start — tidak perlu panggilan manual. Idempoten: bila `system_state`
  // sudah mencatat tahun berjalan, tidak melakukan apa-apa. Gagal hanya dicatat
  // ke log agar server tetap bisa menyala.
  try {
    await runYearlyResetIfNeeded(new Date().getFullYear(), getDb().db)
  } catch (err) {
    console.error('[karyawanku] reset tahunan cuti gagal saat boot (server tetap berjalan):', err)
  }

  await start(port)
  scheduleSelfiePurge()
}

const entry = process.argv[1]
const isEntry = entry?.endsWith('index.ts') || entry?.endsWith('dist/index.js')
if (isEntry) {
  boot().catch((err) => {
    console.error('[karyawanku] gagal memulai server:', err)
    process.exit(1)
  })
}
import 'dotenv/config'
import { migrate } from './db/migrate.js'
import { getDb } from './db/index.js'
import { runYearlyResetIfNeeded } from './lib/leave-reset.js'
import { start } from './app.js'

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
}

const entry = process.argv[1]
const isEntry = entry?.endsWith('index.ts') || entry?.endsWith('dist/index.js')
if (isEntry) {
  boot().catch((err) => {
    console.error('[karyawanku] gagal memulai server:', err)
    process.exit(1)
  })
}
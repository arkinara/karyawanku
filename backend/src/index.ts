import 'dotenv/config'
import { migrate } from './db/migrate.js'
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
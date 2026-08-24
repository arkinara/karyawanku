import 'dotenv/config'
import { migrate } from './db/migrate.js'
import { start } from './app.js'

async function main(): Promise<void> {
  migrate()
  await start()
}

main().catch((err) => {
  console.error('[karyawanku] gagal memulai server:', err)
  process.exit(1)
})

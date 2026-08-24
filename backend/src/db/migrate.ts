import 'dotenv/config'
import { migrate as applyMigrations } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'node:path'
import { createDb, resolveDbPath } from './index.js'

/**
 * Menerapkan migrasi (SQL di `drizzle/`) ke database.
 * Dipanggil saat startup server (lihat `src/index.ts`) atau manual via `npm run db:migrate`.
 *
 * Path default diselesaikan dari `DATABASE_URL` (relatif root repo bila `backend/...`).
 * Berikan `dbPath` untuk memaksa lokasi (dipakai test dengan file sementara).
 */
export function migrate(dbPath?: string): void {
  const prev = process.env.DATABASE_URL
  if (dbPath) process.env.DATABASE_URL = dbPath
  try {
    const { sqlite, db } = createDb(resolveDbPath())
    applyMigrations(db, { migrationsFolder: resolve(__dirname, '../../drizzle') })
    sqlite.close()
  } finally {
    if (dbPath) {
      if (prev === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prev
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  migrate()
  console.log('[migrate] migrasi berhasil diterapkan')
}

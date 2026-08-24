import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Menyelesaikan path database menjadi absolut.
 * Nilai default `backend/data/karyawanku.db` relatif terhadap root repo
 * (parent dari direktori `backend`), sehingga konsisten walau script
 * dijalankan dari mana pun (backend/ atau root).
 */
export function resolveDbPath(value?: string): string {
  const raw = value ?? process.env.DATABASE_URL ?? 'backend/data/karyawanku.db'
  if (raw === ':memory:') return raw
  if (isAbsolute(raw)) return raw
  const backendDir = resolve(here, '../..')
  const repoRoot = resolve(backendDir, '..')
  const base = raw.startsWith('backend/') || raw === 'backend' ? repoRoot : backendDir
  return resolve(base, raw)
}

export type DB = ReturnType<typeof createDb>['db']

export interface DbInstance {
  sqlite: Database.Database
  db: ReturnType<typeof drizzle<typeof schema>>
}

export function createDb(dbPath: string): DbInstance {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}

let instance: DbInstance | null = null

export function getDb(): DbInstance {
  if (!instance) {
    instance = createDb(resolveDbPath())
  }
  return instance
}

export function setDb(newInstance: DbInstance): void {
  instance = newInstance
}

export { schema }

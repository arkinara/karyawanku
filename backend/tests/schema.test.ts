import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createDb } from '../src/db/index.js'
import { businesses, users } from '../src/db/schema.js'

const migrationsFolder = resolve(__dirname, '../drizzle')

describe('schema & migrasi', () => {
  it('migrasi berhasil diterapkan ke file sqlite sementara', () => {
    const dir = mkdtempSync(join(tmpdir(), 'karyawanku-schema-'))
    const dbPath = join(dir, 'schema.db')
    const { sqlite, db } = createDb(dbPath)

    expect(() => migrate(db, { migrationsFolder })).not.toThrow()

    const business = db
      .insert(businesses)
      .values({ nama_bisnis: 'Test', jenis_usaha: 'jasa' })
      .returning()
      .get()
    expect(business.id).toBeTruthy()
    expect(business.jenis_usaha).toBe('jasa')

    const user = db
      .insert(users)
      .values({
        business_id: business.id,
        nama: 'Test User',
        email: 'test@demo.com',
        password_hash: 'x',
        role: 'owner',
      })
      .returning()
      .get()
    expect(user.role).toBe('owner')
    expect(user.status).toBe('aktif')

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('businesses','users') ORDER BY name")
      .all() as Array<{ name: string }>
    expect(tables.map((t) => t.name)).toEqual(['businesses', 'users'])

    sqlite.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('memiliki unik constraint (business_id, email)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'karyawanku-schema-'))
    const dbPath = join(dir, 'unique.db')
    const { sqlite, db } = createDb(dbPath)
    migrate(db, { migrationsFolder })

    const b = db.insert(businesses).values({ nama_bisnis: 'T' }).returning().get()
    db.insert(users).values({ business_id: b.id, nama: 'A', email: 'a@a.com', password_hash: 'x' }).run()
    expect(() =>
      db.insert(users).values({ business_id: b.id, nama: 'B', email: 'a@a.com', password_hash: 'x' }).run(),
    ).toThrow()

    sqlite.close()
    rmSync(dir, { recursive: true, force: true })
  })
})

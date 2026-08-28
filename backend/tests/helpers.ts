import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { FastifyInstance } from 'fastify'
import { createDb, setDb, type DbInstance } from '../src/db/index.js'
import { buildApp } from '../src/app.js'
import { hashPassword } from '../src/lib/auth.js'
import { businesses, users } from '../src/db/schema.js'
import { randomUUID } from 'node:crypto'

export interface TestCtx {
  app: FastifyInstance
  db: DbInstance
  cleanup: () => void
  businessId: string
  ownerToken: string
  employeeToken: string
  otherBusinessId: string
}

const migrationsFolder = resolve(__dirname, '../drizzle')

process.env.JWT_SECRET ??= 'test-secret'
process.env.DATABASE_URL ??= 'backend/data/karyawanku.db'

export async function setupTest(): Promise<TestCtx> {
  const dir = mkdtempSync(join(tmpdir(), 'karyawanku-test-'))
  const dbPath = join(dir, 'test.db')
  const instance = createDb(dbPath)

  migrate(instance.db, { migrationsFolder })

  setDb(instance)
  const { db } = instance

  const ownerPassword = await hashPassword('owner123')
  const employeePassword = await hashPassword('demo123')

  const business = db
    .insert(businesses)
    .values({ nama_bisnis: 'Warung Kopi Nusantara', jenis_usaha: 'fnb' })
    .returning()
    .get()

  const owner = db
    .insert(users)
    .values({
      business_id: business.id,
      nama: 'Darmawan',
      email: 'owner@demo.com',
      password_hash: ownerPassword,
      role: 'owner',
    })
    .returning()
    .get()

  const employee = db
    .insert(users)
    .values({
      business_id: business.id,
      nama: 'Siti',
      email: 'siti@demo.com',
      password_hash: employeePassword,
      role: 'employee',
    })
    .returning()
    .get()

  const otherBusiness = db
    .insert(businesses)
    .values({ nama_bisnis: 'Kedai Lain', jenis_usaha: 'fnb' })
    .returning()
    .get()

  db.insert(users)
    .values({
      business_id: otherBusiness.id,
      nama: 'Orang Lain',
      email: 'oranglain@demo.com',
      password_hash: await hashPassword('demo123'),
      role: 'owner',
    })
    .run()

  const app = buildApp()
  await app.ready()

  const { signToken } = await import('../src/lib/auth.js')
  const ownerIssued = await signToken({ id: owner.id, business_id: owner.business_id, role: owner.role, email: owner.email })
  const employeeIssued = await signToken({
    id: employee.id,
    business_id: employee.business_id,
    role: employee.role,
    email: employee.email,
  })

  const cleanup = () => {
    app.close()
    instance.sqlite.close()
    rmSync(dir, { recursive: true, force: true })
  }

  return {
    app,
    db: instance,
    cleanup,
    businessId: business.id,
    ownerToken: ownerIssued.accessToken,
    employeeToken: employeeIssued.accessToken,
    otherBusinessId: otherBusiness.id,
  }
}

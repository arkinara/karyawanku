import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { createDb } from '../src/db/index.js'
import { employees, leaveBalances, leaveTypes, systemState, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

let ktpCounter = 0
function makeNoKtp(): string {
  ktpCounter += 1
  return '7711223344' + String(700000 + ktpCounter)
}

async function seedEmployee(tanggalMasuk = '2024-01-01'): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: 'Karyawan',
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: tanggalMasuk,
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

describe('ticket #56 — rename tanggal_selesi → tanggal_selesai', () => {
  it('migrasi 0014 mempertahankan data yang sudah ada (tanpa kehilangan baris)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'karyawanku-rename-'))
    const dbPath = join(dir, 'rename.db')
    const { sqlite } = createDb(dbPath)

    sqlite.exec(`
      CREATE TABLE leave_requests (
        id text PRIMARY KEY NOT NULL,
        employee_id text NOT NULL,
        leave_type_id text NOT NULL,
        tanggal_mulai text NOT NULL,
        tanggal_selesi text NOT NULL,
        alasan text,
        status text DEFAULT 'pending' NOT NULL,
        approver_user_id text,
        catatan_approver text,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        decided_at integer
      )
    `)
    sqlite
      .prepare(
        `INSERT INTO leave_requests (id, employee_id, leave_type_id, tanggal_mulai, tanggal_selesi)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('lr-1', 'e-1', 'lt-1', '2026-08-01', '2026-08-05')

    const before = sqlite.prepare('SELECT COUNT(*) AS c FROM leave_requests').get() as { c: number }
    expect(before.c).toBe(1)

    const migrationSql = readFileSync(resolve(__dirname, '../drizzle/0014_rename-tanggal-selesi.sql'), 'utf8')
    sqlite.exec(migrationSql)

    const after = sqlite.prepare('SELECT id, tanggal_mulai, tanggal_selesai FROM leave_requests').all() as Array<{
      id: string
      tanggal_mulai: string
      tanggal_selesai: string
    }>
    expect(after).toEqual([{ id: 'lr-1', tanggal_mulai: '2026-08-01', tanggal_selesai: '2026-08-05' }])
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM leave_requests').get()).toEqual({ c: 1 })

    sqlite.close()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('ticket #56 — kontrak otorisasi GET /api/leave-types', () => {
  it('employee → 200 (bukan 403)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(200)
  })

  it('owner → 200', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
  })

  it('cross-business (bisnis tidak dikenal) → 404', async () => {
    ctx = await setupTest()
    const { signToken } = await import('../src/lib/auth.js')
    ctx.db.sqlite.pragma('foreign_keys = OFF')
    const phantom = ctx.db.db
      .insert(users)
      .values({
        business_id: 'biz-tidak-ada',
        nama: 'Hantu Lintas Bisnis',
        email: 'hantu2@demo.com',
        password_hash: 'x',
        role: 'owner',
      })
      .returning()
      .get()
    ctx.db.sqlite.pragma('foreign_keys = ON')
    const issued = await signToken({
      id: phantom.id,
      business_id: phantom.business_id,
      role: phantom.role,
      email: phantom.email,
    })
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(issued.accessToken) })
    expect(res.statusCode).toBe(404)
  })

  it('ensureLeaveTypesSeeded scoped ke bisnis caller — tidak membocorkan jenis bisnis lain', async () => {
    ctx = await setupTest()
    const { signToken } = await import('../src/lib/auth.js')
    const otherUser = ctx.db.db.select().from(users).where(eq(users.business_id, ctx.otherBusinessId)).get()
    expect(otherUser).toBeTruthy()
    const otherIssued = await signToken({
      id: otherUser.id,
      business_id: ctx.otherBusinessId,
      role: otherUser.role,
      email: otherUser.email,
    })
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(otherIssued.accessToken) })

    ctx.db.db
      .insert(leaveTypes)
      .values({ business_id: ctx.otherBusinessId, nama_jenis_cuti: 'Cuti Khusus Bisnis Lain', default_kuota_hari: 2 })
      .run()

    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(200)
    const names = res.json().leave_types.map((t: { nama_jenis_cuti: string }) => t.nama_jenis_cuti)
    expect(names).toEqual(expect.arrayContaining(['Tahunan', 'Sakit', 'Izin', 'Melahirkan']))
    expect(names).not.toContain('Cuti Khusus Bisnis Lain')
  })
})

describe('ticket #56 — reset tahunan terjadwal (runYearlyResetIfNeeded)', () => {
  it('pemanggilan pertama membuat baris system_state lalu menjalankan reset', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const { runYearlyResetIfNeeded } = await import('../src/lib/leave-reset.js')

    const res = await runYearlyResetIfNeeded(2026, ctx.db.db)
    expect(res.ran).toBe(true)
    expect(res.reason).toBe('first_run')
    expect(res.businesses.length).toBeGreaterThan(0)

    const row = ctx.db.db.select().from(systemState).where(eq(systemState.key, 'last_leave_reset_year')).get()
    expect(row?.value).toBe(2026)

    const balances = ctx.db.db.select().from(leaveBalances).where(eq(leaveBalances.employee_id, emp.id)).all()
    expect(balances.length).toBeGreaterThan(0)
  })

  it('idempoten: dua kali untuk tahun yang sama tidak membuat saldo ganda', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const { runYearlyResetIfNeeded } = await import('../src/lib/leave-reset.js')

    const first = await runYearlyResetIfNeeded(2026, ctx.db.db)
    expect(first.ran).toBe(true)
    const countAfterFirst = ctx.db.db.select().from(leaveBalances).all().length

    const second = await runYearlyResetIfNeeded(2026, ctx.db.db)
    expect(second.ran).toBe(false)
    expect(second.reason).toBe('already_current')
    expect(ctx.db.db.select().from(leaveBalances).all().length).toBe(countAfterFirst)
  })

  it('setelah tahun berganti, pemanggilan mereset saldo untuk tahun baru', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const { runYearlyResetIfNeeded } = await import('../src/lib/leave-reset.js')

    const first = await runYearlyResetIfNeeded(2026, ctx.db.db)
    expect(first.ran).toBe(true)
    expect(first.reason).toBe('first_run')

    const second = await runYearlyResetIfNeeded(2027, ctx.db.db)
    expect(second.ran).toBe(true)
    expect(second.reason).toBe('new_year')

    const tahunan2026 = ctx.db.db.select().from(leaveBalances).where(eq(leaveBalances.tahun, 2026)).all()
    const tahunan2027 = ctx.db.db.select().from(leaveBalances).where(eq(leaveBalances.tahun, 2027)).all()
    expect(tahunan2026.length).toBeGreaterThan(0)
    expect(tahunan2027.length).toBeGreaterThan(0)
    expect(tahunan2027.every((b) => b.terpakai_hari === 0)).toBe(true)
  })
})
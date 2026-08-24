import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function multipart(csv: string, filename = 'data.csv') {
  const boundary = '----TestBoundary123'
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${csv}\r\n` +
    `--${boundary}--\r\n`
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

function row(noKtp: string, over: Record<string, unknown> = {}) {
  return {
    nama_lengkap: 'Karyawan',
    no_ktp: noKtp,
    tanggal_lahir: '1990-01-01',
    jenis_kelamin: 'L',
    alamat: 'Jl. Test',
    kontak_darurat: '081234567890',
    tanggal_masuk: '2024-01-01',
    jenis_kontrak: 'pkwt',
    ...over,
  }
}

function makeNoKtp(i: number): string {
  return '1234567890' + String(100000 + i)
}

describe('POST /api/employees/import/preview', () => {
  it('meng-parse CSV dan mengembalikan header + suggested mapping (tanpa menulis)', async () => {
    ctx = await setupTest()
    const csv = [
      'nama_lengkap,no_ktp,jenis_kelamin,tanggal_lahir,tanggal_masuk,jenis_kontrak',
      'Budi,1234567890123456,L,1990-01-01,2024-01-01,pkwt',
      'Ani,1234567890123457,P,1995-05-05,2024-02-01,pkwtt',
    ].join('\n')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/preview',
      headers: { ...auth(ctx.ownerToken), ...multipart(csv).headers },
      payload: multipart(csv).payload,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.detectedHeaders).toEqual([
      'nama_lengkap',
      'no_ktp',
      'jenis_kelamin',
      'tanggal_lahir',
      'tanggal_masuk',
      'jenis_kontrak',
    ])
    expect(body.rows.length).toBe(2)
    expect(body.suggestedMapping.no_ktp).toBe('no_ktp')
    expect(body.suggestedMapping.nama_lengkap).toBe('nama_lengkap')
    expect(body.requiredMapped).toBe(true)

    const { employees } = await import('../src/db/schema.js')
    const count = ctx.db.db.select().from(employees).all().length
    expect(count).toBe(0)
  })

  it('menangani string ber-kutip dengan koma', async () => {
    ctx = await setupTest()
    const csv = [
      'nama_lengkap,no_ktp,alamat',
      '"Budi, Santoso",1234567890123456,"Jl. Merdeka, No. 1"',
    ].join('\n')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/preview',
      headers: { ...auth(ctx.ownerToken), ...multipart(csv).headers },
      payload: multipart(csv).payload,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.rows[0][0]).toBe('Budi, Santoso')
    expect(body.rows[0][2]).toBe('Jl. Merdeka, No. 1')
  })

  it('tanpa file → 422', async () => {
    ctx = await setupTest()
    const boundary = '----TestBoundary123'
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nno file here\r\n--${boundary}--\r\n`
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/preview',
      headers: { ...auth(ctx.ownerToken), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    })
    expect(res.statusCode).toBe(422)
  })

  it('employee mendapat 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/preview',
      headers: { ...auth(ctx.employeeToken), ...multipart('a,b\n1,2').headers },
      payload: multipart('a,b\n1,2').payload,
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/employees/import/commit', () => {
  it('membuat baris valid, melewati yang invalid, dan mengembalikan errors', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/commit',
      headers: auth(ctx.ownerToken),
      payload: {
        columnMapping: { nama_lengkap: 'nama_lengkap', no_ktp: 'no_ktp' },
        rows: [
          row(makeNoKtp(1)),
          row(makeNoKtp(2)),
          row('12345', {}),
          row(makeNoKtp(1)),
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(2)
    expect(body.skipped).toBe(2)
    expect(body.errors.length).toBe(2)

    const dupError = body.errors.find((e: { rowIndex: number }) => e.rowIndex === 5)
    expect(dupError.errors).toContain('No KTP sudah terdaftar (duplikat)')

    const { employees } = await import('../src/db/schema.js')
    const all = ctx.db.db.select().from(employees).all()
    expect(all.length).toBe(2)
  })

  it('no_ktp yang sudah ada di database di-skip', async () => {
    ctx = await setupTest()
    await ctx.app.inject({
      method: 'POST',
      url: '/api/employees',
      headers: auth(ctx.ownerToken),
      payload: row(makeNoKtp(1)),
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/commit',
      headers: auth(ctx.ownerToken),
      payload: { rows: [row(makeNoKtp(1)), row(makeNoKtp(2))] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(1)
    expect(body.errors.length).toBe(1)
    expect(body.errors[0].errors).toContain('No KTP sudah terdaftar (duplikat)')
  })

  it('batch semua invalid → tidak ada yang ditulis (rollback)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/commit',
      headers: auth(ctx.ownerToken),
      payload: { rows: [row('12345'), row('67890')] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(0)
    expect(body.skipped).toBe(2)
    expect(body.errors.length).toBe(2)

    const { employees } = await import('../src/db/schema.js')
    const all = ctx.db.db.select().from(employees).all()
    expect(all.length).toBe(0)
  })

  it('kolom jenis_kontrak tidak valid → di-skip', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees/import/commit',
      headers: auth(ctx.ownerToken),
      payload: { rows: [row(makeNoKtp(1), { jenis_kontrak: 'bukan-kontrak' })] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(0)
    expect(body.errors.length).toBe(1)
    expect(body.errors[0].errors.some((e: string) => e.includes('Jenis kontrak'))).toBe(true)
  })
})

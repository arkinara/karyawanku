import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { eq } from 'drizzle-orm'
import { salaryComponents } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function createComponent(payload: Record<string, unknown>, token?: string) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/salary-components',
    headers: auth(token ?? ctx.ownerToken),
    payload,
  })
}

describe('POST /api/salary-components', () => {
  it('membuat komponen earning dengan nominal tetap → tersimpan & bisa di-list', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'Tunjangan Transport', tipe: 'earning', nominal: 500000 })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.component.nama_komponen).toBe('Tunjangan Transport')
    expect(body.component.tipe).toBe('earning')
    expect(body.component.nominal).toBe(500000)
    expect(body.component.formula).toBeNull()
    expect(body.component.aktif).toBe(true)

    const list = await ctx.app.inject({ method: 'GET', url: '/api/salary-components', headers: auth(ctx.ownerToken) })
    expect(list.json().components.length).toBe(1)
  })

  it('membuat komponen formula yang valid (gaji_pokok * 0.01)', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'BPJS', tipe: 'deduction', formula: 'gaji_pokok * 0.01' })
    expect(res.statusCode).toBe(200)
    expect(res.json().component.formula).toBe('gaji_pokok * 0.01')
  })

  it('tanpa nominal maupun formula → 422', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'Kosong', tipe: 'earning' })
    expect(res.statusCode).toBe(422)
  })

  it('nominal negatif → 422', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'Negatif', tipe: 'earning', nominal: -5 })
    expect(res.statusCode).toBe(422)
  })

  it('tipe tidak valid → 422', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'X', tipe: 'bonus', nominal: 100 })
    expect(res.statusCode).toBe(422)
  })

  it('nama_komponen > 100 karakter → 422', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'x'.repeat(101), tipe: 'earning', nominal: 100 })
    expect(res.statusCode).toBe(422)
  })

  it('formula referensi variabel tidak dikenal → 422', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'X', tipe: 'earning', formula: 'gaji_bulanan * 2' })
    expect(res.statusCode).toBe(422)
  })

  it('formula sintaks tidak valid → 422', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'X', tipe: 'earning', formula: 'gaji_pokok *' })
    expect(res.statusCode).toBe(422)
  })

  it('employee mendapat 403', async () => {
    ctx = await setupTest()
    const res = await createComponent({ nama_komponen: 'X', tipe: 'earning', nominal: 100 }, ctx.employeeToken)
    expect(res.statusCode).toBe(403)
  })
})

describe('PATCH /api/salary-components/:id', () => {
  it('memperbarui subset field', async () => {
    ctx = await setupTest()
    const created = (await createComponent({ nama_komponen: 'Transport', tipe: 'earning', nominal: 500000 })).json().component
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-components/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { nominal: 600000 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().component.nominal).toBe(600000)
    expect(res.json().component.nama_komponen).toBe('Transport')
  })

  it('toggle aktif/nonaktif tanpa menghapus histori', async () => {
    ctx = await setupTest()
    const created = (await createComponent({ nama_komponen: 'Transport', tipe: 'earning', nominal: 500000 })).json().component
    const off = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-components/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { aktif: false },
    })
    expect(off.json().component.aktif).toBe(false)
    const row = ctx.db.db.select().from(salaryComponents).where(eq(salaryComponents.id, created.id)).get()
    expect(row).toBeTruthy()
    expect(row?.aktif).toBe(false)
    expect(row?.nominal).toBe(500000)
  })

  it('komponen dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(salaryComponents)
      .values({ business_id: ctx.otherBusinessId, nama_komponen: 'X', tipe: 'earning', nominal: 100 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-components/${outsider.id}`,
      headers: auth(ctx.ownerToken),
      payload: { nominal: 999 },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/salary-components/:id (soft-delete)', () => {
  it('menonaktifkan komponen → { ok: true } dan aktif=false, data tetap ada', async () => {
    ctx = await setupTest()
    const created = (await createComponent({ nama_komponen: 'Transport', tipe: 'earning', nominal: 500000 })).json().component
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/salary-components/${created.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const row = ctx.db.db.select().from(salaryComponents).where(eq(salaryComponents.id, created.id)).get()
    expect(row?.aktif).toBe(false)
    expect(row?.nominal).toBe(500000)
  })

  it('komponen dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(salaryComponents)
      .values({ business_id: ctx.otherBusinessId, nama_komponen: 'X', tipe: 'earning', nominal: 100 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/salary-components/${outsider.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/salary-components', () => {
  it('list mencakup komponen nonaktif secara default, filter ?active=true', async () => {
    ctx = await setupTest()
    await createComponent({ nama_komponen: 'Aktif', tipe: 'earning', nominal: 100 })
    const b = (await createComponent({ nama_komponen: 'Nonaktif', tipe: 'earning', nominal: 200 })).json().component
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-components/${b.id}`,
      headers: auth(ctx.ownerToken),
      payload: { aktif: false },
    })

    const all = await ctx.app.inject({ method: 'GET', url: '/api/salary-components', headers: auth(ctx.ownerToken) })
    expect(all.json().components.length).toBe(2)

    const active = await ctx.app.inject({
      method: 'GET',
      url: '/api/salary-components?active=true',
      headers: auth(ctx.ownerToken),
    })
    expect(active.json().components.length).toBe(1)
    expect(active.json().components[0].nama_komponen).toBe('Aktif')
  })

  it('isolasi bisnis: hanya komponen milik bisnis sendiri', async () => {
    ctx = await setupTest()
    await createComponent({ nama_komponen: 'Milik Saya', tipe: 'earning', nominal: 100 })
    ctx.db.db
      .insert(salaryComponents)
      .values({ business_id: ctx.otherBusinessId, nama_komponen: 'Milik Lain', tipe: 'earning', nominal: 100 })
      .run()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/salary-components', headers: auth(ctx.ownerToken) })
    expect(res.json().components.length).toBe(1)
    expect(res.json().components[0].nama_komponen).toBe('Milik Saya')
  })
})

describe('POST /api/salary-components/preview-formula', () => {
  it('jam_kerja * tarif_lembur → hasil benar', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/salary-components/preview-formula',
      headers: auth(ctx.ownerToken),
      payload: { formula: 'jam_kerja * tarif_lembur', variables: { jam_kerja: 10, tarif_lembur: 15000 } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result).toBe(150000)
  })

  it('gaji_pokok * 0.01 → hasil benar', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/salary-components/preview-formula',
      headers: auth(ctx.ownerToken),
      payload: { formula: 'gaji_pokok * 0.01', variables: { gaji_pokok: 5000000 } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result).toBe(50000)
  })

  it('formula tidak aman → 400, tidak crash', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/salary-components/preview-formula',
      headers: auth(ctx.ownerToken),
      payload: { formula: 'gaji_pokok; DROP TABLE users', variables: { gaji_pokok: 100 } },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toBeTruthy()
  })

  it('variabel tidak dikenal → 400', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/salary-components/preview-formula',
      headers: auth(ctx.ownerToken),
      payload: { formula: 'foobar + 1', variables: {} },
    })
    expect(res.statusCode).toBe(400)
  })
})

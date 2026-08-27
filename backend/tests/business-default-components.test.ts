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

async function createComponent(payload: Record<string, unknown>, businessId: string) {
  return ctx.db.db
    .insert(salaryComponents)
    .values({ business_id: businessId, ...payload })
    .returning()
    .get()
}

describe('GET /api/businesses/:id/default-salary-components', () => {
  it('mengembalikan hanya komponen is_default=true milik bisnis', async () => {
    ctx = await setupTest()
    const def1 = await createComponent({ nama_komponen: 'Gaji Pokok', tipe: 'earning', nominal: 3000000, is_default: true }, ctx.businessId)
    await createComponent({ nama_komponen: 'Tunjangan Makan', tipe: 'earning', nominal: 50000, is_default: true }, ctx.businessId)
    await createComponent({ nama_komponen: 'Bonus', tipe: 'earning', nominal: 100000, is_default: false }, ctx.businessId)
    await createComponent({ nama_komponen: 'Milik Lain', tipe: 'earning', nominal: 100, is_default: true }, ctx.otherBusinessId)

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const components = res.json().components
    expect(components.length).toBe(2)
    const ids = components.map((c: { id: string }) => c.id)
    expect(ids).toContain(def1.id)
    expect(components.every((c: { is_default: boolean }) => c.is_default === true)).toBe(true)
  })

  it('bisnis baru tanpa default → array kosong (bukan error)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().components).toEqual([])
  })

  it('bisnis lain → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.otherBusinessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('tanpa token → 401, employee → 403', async () => {
    ctx = await setupTest()
    const noAuth = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
    })
    expect(noAuth.statusCode).toBe(401)
    const employee = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.employeeToken),
    })
    expect(employee.statusCode).toBe(403)
  })
})

describe('PUT /api/businesses/:id/default-salary-components (component_ids)', () => {
  it('mengganti set default, GET merefleksikan perubahan', async () => {
    ctx = await setupTest()
    const a = await createComponent({ nama_komponen: 'Gaji Pokok', tipe: 'earning', nominal: 3000000, is_default: true }, ctx.businessId)
    const b = await createComponent({ nama_komponen: 'Tunjangan Transport', tipe: 'earning', nominal: 500000, is_default: true }, ctx.businessId)
    const c = await createComponent({ nama_komponen: 'Bonus', tipe: 'earning', nominal: 100000, is_default: false }, ctx.businessId)

    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: { component_ids: [c.id] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().components.map((x: { id: string }) => x.id)).toEqual([c.id])

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
    })
    expect(get.json().components.map((x: { id: string }) => x.id)).toEqual([c.id])

    const rowA = ctx.db.db.select().from(salaryComponents).where(eq(salaryComponents.id, a.id)).get()
    const rowB = ctx.db.db.select().from(salaryComponents).where(eq(salaryComponents.id, b.id)).get()
    expect(rowA?.is_default).toBe(false)
    expect(rowB?.is_default).toBe(false)
  })

  it('component_id dari bisnis lain → 400 dan set lama tidak berubah', async () => {
    ctx = await setupTest()
    const mine = await createComponent({ nama_komponen: 'Gaji Pokok', tipe: 'earning', nominal: 3000000, is_default: true }, ctx.businessId)
    const outsider = await createComponent({ nama_komponen: 'Orang Lain', tipe: 'earning', nominal: 100, is_default: true }, ctx.otherBusinessId)

    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: { component_ids: [outsider.id] },
    })
    expect(res.statusCode).toBe(400)

    const row = ctx.db.db.select().from(salaryComponents).where(eq(salaryComponents.id, mine.id)).get()
    expect(row?.is_default).toBe(true)
  })

  it('component_ids kosong → 400', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: { component_ids: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('bisnis lain → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.otherBusinessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: { component_ids: [ctx.businessId] },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('PUT /api/businesses/:id/default-salary-components (components)', () => {
  it('membuat komponen baru dan menandainya default', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: {
        components: [
          { nama_komponen: 'Gaji Pokok', tipe: 'earning', nominal: 3000000 },
          { nama_komponen: 'BPJS Kesehatan', tipe: 'deduction', formula: 'gaji_pokok * 0.01' },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    const components = res.json().components
    expect(components.length).toBe(2)
    expect(components.every((c: { is_default: boolean }) => c.is_default === true)).toBe(true)
    expect(components.map((c: { nama_komponen: string }) => c.nama_komponen).sort()).toEqual([
      'BPJS Kesehatan',
      'Gaji Pokok',
    ])
  })

  it('komponen tanpa nominal/formula → 400', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: { components: [{ nama_komponen: 'Kosong', tipe: 'earning' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('formula tidak valid → 400 dan tidak ada komponen dibuat', async () => {
    ctx = await setupTest()
    const before = ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM salary_components').get() as { n: number }
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/businesses/${ctx.businessId}/default-salary-components`,
      headers: auth(ctx.ownerToken),
      payload: { components: [{ nama_komponen: 'X', tipe: 'earning', formula: 'gaji_pokok *' }] },
    })
    expect(res.statusCode).toBe(400)
    const after = ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM salary_components').get() as { n: number }
    expect(after.n).toBe(before.n)
  })
})
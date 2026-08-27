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

const validPayload = {
  nama_bisnis: 'Warung Kopi Nusantara',
  jenis_usaha: 'fnb',
  alamat: 'Jl. Merdeka No. 1, Bandung',
  owner: { nama: 'Darmawan', email: 'darmawan@demo.com', password: 'rahasia123' },
}

async function signup(payload: Record<string, unknown>) {
  return ctx.app.inject({ method: 'POST', url: '/api/businesses', payload })
}

function businessCount(): number {
  return (ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM businesses').get() as { n: number }).n
}

describe('POST /api/businesses', () => {
  it('membuat bisnis + owner secara atomik, mengembalikan user/token/business, token valid untuk /auth/me', async () => {
    ctx = await setupTest()
    const before = businessCount()
    const res = await signup(validPayload)
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.role).toBe('owner')
    expect(body.user.email).toBe('darmawan@demo.com')
    expect(body.user.nama).toBe('Darmawan')
    expect(body.user.business_id).toBe(body.business.id)
    expect(body.user.password_hash).toBeUndefined()
    expect(body.business.nama_bisnis).toBe('Warung Kopi Nusantara')
    expect(body.business.jenis_usaha).toBe('fnb')
    expect(body.business.alamat).toBe('Jl. Merdeka No. 1, Bandung')

    expect(businessCount()).toBe(before + 1)

    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: auth(body.token),
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().user.email).toBe('darmawan@demo.com')
  })

  it('rollback total bila insert user gagal (bisnis tidak ikut tersimpan)', async () => {
    ctx = await setupTest()
    ctx.db.sqlite.exec(`
      CREATE TRIGGER force_user_insert_fail
      BEFORE INSERT ON users
      WHEN NEW.email = 'fail@test.com'
      BEGIN
        SELECT RAISE(ABORT, 'forced user insert failure');
      END;
    `)
    const before = businessCount()
    const res = await signup({ ...validPayload, owner: { ...validPayload.owner, email: 'fail@test.com' } })
    expect(res.statusCode).toBe(500)
    expect(businessCount()).toBe(before)
    const exists = ctx.db.sqlite
      .prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'fail@test.com'")
      .get() as { n: number }
    expect(exists.n).toBe(0)
  })

  it('email duplikat global → 409 dan tidak membuat bisnis', async () => {
    ctx = await setupTest()
    const before = businessCount()
    const res = await signup({ ...validPayload, owner: { ...validPayload.owner, email: 'owner@demo.com' } })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.message).toContain('Email sudah terdaftar')
    expect(businessCount()).toBe(before)
  })

  it('password kurang dari 8 karakter → 400', async () => {
    ctx = await setupTest()
    const res = await signup({ ...validPayload, owner: { ...validPayload.owner, password: '1234567' } })
    expect(res.statusCode).toBe(400)
    expect(businessCount()).toBe(2)
  })

  it('field wajib kosong → 400 dengan detail field', async () => {
    ctx = await setupTest()
    const res = await signup({ ...validPayload, nama_bisnis: '' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.details).toBeTruthy()
  })

  it('nama_bisnis > 100 karakter → 400', async () => {
    ctx = await setupTest()
    const res = await signup({ ...validPayload, nama_bisnis: 'x'.repeat(101) })
    expect(res.statusCode).toBe(400)
  })

  it('jenis_usaha tidak valid → 400', async () => {
    ctx = await setupTest()
    const res = await signup({ ...validPayload, jenis_usaha: 'retail' })
    expect(res.statusCode).toBe(400)
  })

  it('alamat > 500 karakter → 400', async () => {
    ctx = await setupTest()
    const res = await signup({ ...validPayload, alamat: 'x'.repeat(501) })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/businesses/:id', () => {
  it('owner melihat profil bisnisnya sendiri', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().business.id).toBe(ctx.businessId)
    expect(res.json().business.nama_bisnis).toBe('Warung Kopi Nusantara')
  })

  it('bisnis lain → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.otherBusinessId}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('tanpa token → 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: `/api/businesses/${ctx.businessId}` })
    expect(res.statusCode).toBe(401)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('PATCH /api/businesses/:id', () => {
  it('owner memperbarui profil, GET langsung merefleksikan perubahan', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.ownerToken),
      payload: { nama_bisnis: 'Warung Kopi Nusantara Cabang 2', jenis_usaha: 'jasa' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().business.nama_bisnis).toBe('Warung Kopi Nusantara Cabang 2')
    expect(res.json().business.jenis_usaha).toBe('jasa')

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.ownerToken),
    })
    expect(get.json().business.nama_bisnis).toBe('Warung Kopi Nusantara Cabang 2')
  })

  it('bisnis lain → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.otherBusinessId}`,
      headers: auth(ctx.ownerToken),
      payload: { nama_bisnis: 'Bajak' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.employeeToken),
      payload: { nama_bisnis: 'X' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('payload kosong → 400', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.ownerToken),
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('jenis_usaha tidak valid → 400', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.ownerToken),
      payload: { jenis_usaha: 'retail' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('alamat tidak diubah tidak mempengaruhi nilai lama', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.ownerToken),
      payload: { nama_bisnis: 'Nama Baru' },
    })
    expect(res.json().business.alamat).toBeNull()
  })
})
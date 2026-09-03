import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { attendanceRecords, employees, selfieMeta, users } from '../src/db/schema.js'

let ctx: TestCtx

// Selfie files land in a throwaway dir, not the dev `backend/data/selfies`.
const selfieTmp = mkdtempSync(join(tmpdir(), 'karyawanku-selfie-'))
process.env.SELFIE_DIR = selfieTmp

afterEach(() => {
  ctx?.cleanup()
  rmSync(selfieTmp, { recursive: true, force: true })
  process.env.SELFIE_DIR = selfieTmp
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '6677889911' + String(300000 + i)
}

async function seedEmployee(name = 'X', ktpIdx = 1): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(ktpIdx),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function linkEmployeeUser(employeeId: string) {
  ctx.db.db.update(users).set({ employee_id: employeeId }).where(eq(users.email, 'siti@demo.com')).run()
}

async function seedAttendance(employeeId: string, tanggal = '2026-09-03') {
  return ctx.db.db
    .insert(attendanceRecords)
    .values({
      employee_id: employeeId,
      tanggal,
      clock_in: new Date().toISOString(),
      status: 'hadir',
    })
    .returning()
    .get()
}

async function jpegBuffer(width = 320, height = 240): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 210, g: 80, b: 60 } },
  })
    .jpeg()
    .toBuffer()
}

async function pngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 20, g: 120, b: 200, alpha: 1 } },
  })
    .png()
    .toBuffer()
}

function imageMultipart(buffer: Buffer, mimetype: string, filename = 'selfie.jpg') {
  const boundary = '----SelfieBoundary42'
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([head, buffer, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

function selfieFileOnDisk(employeeId: string, attendanceId: string): string {
  return join(selfieTmp, employeeId, `${attendanceId}.jpg`)
}

describe('POST /api/attendance/:id/selfie', () => {
  it('upload JPEG valid oleh owner → 201, file tersimpan di disk, meta tercatat', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const jpeg = await jpegBuffer()

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.url).toBe(`/api/attendance/${rec.id}/selfie`)
    expect(body.size_bytes).toBeGreaterThan(0)
    expect(typeof body.retention_until).toBe('string')
    expect(existsSync(selfieFileOnDisk(emp.id, rec.id))).toBe(true)

    const meta = ctx.db.db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, rec.id)).get()
    expect(meta).not.toBeNull()
    expect(meta!.mime_type).toBe('image/jpeg')
    expect(meta!.size_bytes).toBe(body.size_bytes)
    expect(meta!.retention_until.getTime()).toBeGreaterThan(Date.now())
  })

  it('upload PNG → 201, disimpan sebagai JPEG', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const png = await pngBuffer()

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(png, 'image/png').headers },
      payload: imageMultipart(png, 'image/png').payload,
    })

    expect(res.statusCode).toBe(201)
    const meta = ctx.db.db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, rec.id)).get()
    expect(meta!.mime_type).toBe('image/jpeg')
  })

  it('non-image (text/plain) → 415 Unsupported Media Type', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const text = Buffer.from('hello, i am not an image')

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(text, 'text/plain').headers },
      payload: imageMultipart(text, 'text/plain').payload,
    })

    expect(res.statusCode).toBe(415)
  })

  it('upload > 2 MB → 413 Payload Too Large', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0xff)

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(oversized, 'image/jpeg').headers },
      payload: imageMultipart(oversized, 'image/jpeg').payload,
    })

    expect(res.statusCode).toBe(413)
    expect(existsSync(selfieFileOnDisk(emp.id, rec.id))).toBe(false)
  })

  it('file gambar korup (bukan gambar) → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const fake = Buffer.from('not-really-a-jpeg-but-mime-says-so')

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(fake, 'image/jpeg').headers },
      payload: imageMultipart(fake, 'image/jpeg').payload,
    })

    expect(res.statusCode).toBe(422)
  })

  it('employee dapat mengunggah selfie untuk record miliknya → 201', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const rec = await seedAttendance(emp.id)
    const jpeg = await jpegBuffer()

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.employeeToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })

    expect(res.statusCode).toBe(201)
  })

  it('employee tidak dapat mengunggah selfie milik karyawan lain → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const other = await seedEmployee('Lain', 2)
    const rec = await seedAttendance(other.id)
    const jpeg = await jpegBuffer()

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.employeeToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })

    expect(res.statusCode).toBe(403)
  })

  it('upload kedua menimpa yang pertama (idempoten, retention baru)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const jpeg = await jpegBuffer()

    const first = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })
    expect(first.statusCode).toBe(201)

    const second = await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })
    expect(second.statusCode).toBe(201)

    const meta = ctx.db.db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, rec.id)).all()
    expect(meta.length).toBe(1)
  })
})

describe('GET /api/attendance/:id/selfie', () => {
  async function uploadFor(recId: string) {
    const jpeg = await jpegBuffer()
    return ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${recId}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })
  }

  it('employee dapat mengambil selfie miliknya → 200 + bytes + content-type', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const rec = await seedAttendance(emp.id)
    await uploadFor(rec.id)

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.employeeToken),
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('image/jpeg')
    expect(res.rawPayload.length).toBeGreaterThan(0)
  })

  it('employee tidak dapat mengambil selfie milik orang lain → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const other = await seedEmployee('Lain', 2)
    const rec = await seedAttendance(other.id)
    await uploadFor(rec.id)

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.employeeToken),
    })

    expect(res.statusCode).toBe(403)
  })

  it('belum diunggah → 404', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.ownerToken),
    })

    expect(res.statusCode).toBe(404)
  })

  it('melewati masa retensi → 410 Gone', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    await uploadFor(rec.id)

    ctx.db.db
      .update(selfieMeta)
      .set({ retention_until: new Date(Date.now() - 1000) })
      .where(eq(selfieMeta.attendance_id, rec.id))
      .run()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.ownerToken),
    })

    expect(res.statusCode).toBe(410)
  })
})

describe('DELETE /api/attendance/:id/selfie', () => {
  async function uploadFor(recId: string) {
    const jpeg = await jpegBuffer()
    return ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${recId}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })
  }

  it('employee tidak bisa menghapus selfie → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const rec = await seedAttendance(emp.id)
    await uploadFor(rec.id)

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.employeeToken),
    })

    expect(res.statusCode).toBe(403)
    const meta = ctx.db.db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, rec.id)).get()
    expect(meta).not.toBeNull()
  })

  it('owner menghapus → 200, file + meta hilang, audit tercatat', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    await uploadFor(rec.id)
    expect(existsSync(selfieFileOnDisk(emp.id, rec.id))).toBe(true)

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.ownerToken),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().deleted).toBe(true)
    expect(existsSync(selfieFileOnDisk(emp.id, rec.id))).toBe(false)
    const meta = ctx.db.db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, rec.id)).get()
    expect(meta).toBeUndefined()

    const { auditLogs } = await import('../src/db/schema.js')
    const log = ctx.db.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'attendance.selfie.delete'))
      .get()
    expect(log).not.toBeNull()
    expect(log!.entity_id).toBe(rec.id)
  })

  it('menghapus yang belum ada → 200 idempoten', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: auth(ctx.ownerToken),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().deleted).toBe(true)
  })
})

describe('purge retensi', () => {
  it('purgeSelfiesOlderThan menghapus baris + file yang sudah lewat batas', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = await seedAttendance(emp.id)
    const jpeg = await jpegBuffer()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/attendance/${rec.id}/selfie`,
      headers: { ...auth(ctx.ownerToken), ...imageMultipart(jpeg, 'image/jpeg').headers },
      payload: imageMultipart(jpeg, 'image/jpeg').payload,
    })

    ctx.db.db
      .update(selfieMeta)
      .set({ retention_until: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) })
      .where(eq(selfieMeta.attendance_id, rec.id))
      .run()

    const { purgeSelfiesOlderThan } = await import('../src/lib/selfie-storage.js')
    const purged = purgeSelfiesOlderThan(90)

    expect(purged).toBeGreaterThanOrEqual(1)
    expect(existsSync(selfieFileOnDisk(emp.id, rec.id))).toBe(false)
    const meta = ctx.db.db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, rec.id)).get()
    expect(meta).toBeUndefined()
  })
})
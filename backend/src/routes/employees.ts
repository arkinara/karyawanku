import type { FastifyInstance } from 'fastify'
import { and, asc, count, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { employees } from '../db/schema.js'
import { currentUser, requireAuth, requireOwner } from '../lib/auth.js'
import { ApiError, ConflictError } from '../lib/errors.js'
import {
  createEmployeeSchema,
  parseCustomFields,
  serializeEmployee,
  updateEmployeeSchema,
} from '../lib/employee-validation.js'

export default async function employeesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/employees', { preHandler: requireOwner }, async (req) => {
    const q = req.query as Record<string, unknown>
    const limit = Math.min(Number(q.limit ?? 50) || 50, 200)
    const offset = Number(q.offset ?? 0) || 0
    const user = currentUser(req)
    const { db } = getDb()

    const filters = [eq(employees.business_id, user.business_id)]
    if (q.jenis_kontrak) filters.push(eq(employees.jenis_kontrak, q.jenis_kontrak as typeof employees.$inferSelect.jenis_kontrak))
    if (q.status) filters.push(eq(employees.status, q.status as typeof employees.$inferSelect.status))
    const where = and(...filters)

    const rows = db
      .select()
      .from(employees)
      .where(where)
      .orderBy(asc(employees.nama_lengkap))
      .limit(limit)
      .offset(offset)
      .all()
    const total = db.select({ c: count() }).from(employees).where(where).get()?.c ?? 0

    return { employees: rows.map(serializeEmployee), total, limit, offset }
  })

  app.post('/employees', { preHandler: requireOwner }, async (req) => {
    const parsed = createEmployeeSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data karyawan tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const dup = db
      .select()
      .from(employees)
      .where(and(eq(employees.business_id, user.business_id), eq(employees.no_ktp, data.no_ktp)))
      .get()
    if (dup) {
      throw new ConflictError('No KTP sudah terdaftar dalam bisnis ini')
    }

    const emp = db
      .insert(employees)
      .values({
        business_id: user.business_id,
        nama_lengkap: data.nama_lengkap,
        no_ktp: data.no_ktp,
        npwp: data.npwp ?? null,
        tanggal_lahir: data.tanggal_lahir,
        jenis_kelamin: data.jenis_kelamin,
        alamat: data.alamat ?? null,
        kontak_darurat: data.kontak_darurat ?? null,
        tanggal_masuk: data.tanggal_masuk,
        jenis_kontrak: data.jenis_kontrak,
        status: data.status ?? 'aktif',
        custom_fields: data.custom_fields ? JSON.stringify(data.custom_fields) : null,
      })
      .returning()
      .get()

    return { employee: serializeEmployee(emp) }
  })

  app.get('/employees/:id', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const emp = db.select().from(employees).where(eq(employees.id, id)).get()
    if (!emp || emp.business_id !== user.business_id) {
      throw new ApiError(404, 'Karyawan tidak ditemukan')
    }

    const isOwner = user.role === 'owner'
    const isSelf = user.role === 'employee' && user.employee_id === emp.id
    if (!isOwner && !isSelf) {
      throw new ApiError(403, 'Anda tidak berhak mengakses data ini')
    }

    return { employee: serializeEmployee(emp) }
  })

  app.patch('/employees/:id', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateEmployeeSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data karyawan tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Karyawan tidak ditemukan')
    }

    if (data.no_ktp && data.no_ktp !== target.no_ktp) {
      const dup = db
        .select()
        .from(employees)
        .where(and(eq(employees.business_id, user.business_id), eq(employees.no_ktp, data.no_ktp)))
        .get()
      if (dup) {
        throw new ConflictError('No KTP sudah terdaftar dalam bisnis ini')
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date() }
    if (data.nama_lengkap !== undefined) patch.nama_lengkap = data.nama_lengkap
    if (data.no_ktp !== undefined) patch.no_ktp = data.no_ktp
    if (data.npwp !== undefined) patch.npwp = data.npwp
    if (data.tanggal_lahir !== undefined) patch.tanggal_lahir = data.tanggal_lahir
    if (data.jenis_kelamin !== undefined) patch.jenis_kelamin = data.jenis_kelamin
    if (data.alamat !== undefined) patch.alamat = data.alamat
    if (data.kontak_darurat !== undefined) patch.kontak_darurat = data.kontak_darurat
    if (data.tanggal_masuk !== undefined) patch.tanggal_masuk = data.tanggal_masuk
    if (data.jenis_kontrak !== undefined) patch.jenis_kontrak = data.jenis_kontrak
    if (data.status !== undefined) patch.status = data.status
    if (data.custom_fields !== undefined) {
      const existing = parseCustomFields(target.custom_fields) ?? {}
      patch.custom_fields = JSON.stringify({ ...existing, ...(data.custom_fields ?? {}) })
    }

    const updated = db.update(employees).set(patch).where(eq(employees.id, id)).returning().get()
    return { employee: serializeEmployee(updated) }
  })

  app.delete('/employees/:id', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Karyawan tidak ditemukan')
    }

    db.update(employees).set({ status: 'nonaktif', updated_at: new Date() }).where(eq(employees.id, id)).run()
    return { ok: true }
  })
}

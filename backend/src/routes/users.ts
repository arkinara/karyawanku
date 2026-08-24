import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { employees, roles, users, type Role, type UserStatus } from '../db/schema.js'
import { currentUser, hashPassword, publicUser, requireOwner } from '../lib/auth.js'
import { ApiError, ConflictError, ValidationError } from '../lib/errors.js'

const createUserSchema = z.object({
  email: z.string().email('Format email tidak valid').toLowerCase(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  nama: z.string().min(1, 'Nama wajib diisi'),
  employee_id: z.string().nullable().optional(),
  role: z.enum(roles).optional(),
})

const updateUserSchema = z.object({
  role: z.string().optional(),
  employee_id: z.string().nullable().optional(),
  status: z.string().optional(),
  nama: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
})

export default async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireOwner)

  app.get('/users', async (req) => {
    const q = req.query as Record<string, unknown>
    const limit = Math.min(Number(q.limit ?? 50) || 50, 200)
    const offset = Number(q.offset ?? 0) || 0

    const { db } = getDb()
    const user = currentUser(req)
    const rows = db
      .select()
      .from(users)
      .where(eq(users.business_id, user!.business_id))
      .limit(limit)
      .offset(offset)
      .all()

    const total = db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.business_id, user!.business_id))
      .all().length

    return { users: rows.map(publicUser), total, limit, offset }
  })

  app.post('/users', async (req) => {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data pengguna tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const owner = currentUser(req)

    const { db } = getDb()

    const duplicate = db
      .select()
      .from(users)
      .where(and(eq(users.business_id, owner.business_id), eq(users.email, data.email)))
      .get()
    if (duplicate) {
      throw new ConflictError('Email sudah digunakan dalam bisnis ini')
    }

    const role: Role = data.role ?? 'employee'
    if (data.employee_id) {
      await assertEmployeeInBusiness(db, owner.business_id, data.employee_id)
    }
    const user = db
      .insert(users)
      .values({
        business_id: owner.business_id,
        email: data.email,
        nama: data.nama,
        password_hash: await hashPassword(data.password),
        role,
        employee_id: data.employee_id ?? null,
      })
      .returning()
      .get()

    return { user: publicUser(user) }
  })

  app.patch('/users/:id', async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data pengguna tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const owner = currentUser(req)

    if (data.role !== undefined && !(roles as readonly string[]).includes(data.role)) {
      throw new ApiError(422, 'Role tidak valid')
    }
    if (data.status !== undefined && !['aktif', 'nonaktif'].includes(data.status)) {
      throw new ApiError(422, 'Status tidak valid')
    }

    const { db } = getDb()
    const target = db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.business_id, owner.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Pengguna tidak ditemukan')
    }

    if (data.role && target.role === 'owner' && data.role !== 'owner' && target.id === owner.id) {
      throw new ApiError(400, 'Anda tidak dapat menurunkan role Anda sendiri')
    }

    if (data.role === 'employee' && target.role === 'owner' && !(await hasOtherOwner(owner.business_id, target.id))) {
      throw new ApiError(400, 'Bisnis harus memiliki minimal satu pemilik')
    }

    const patch: Record<string, unknown> = {}
    if (data.role !== undefined) patch.role = data.role
    if (data.employee_id !== undefined) {
      if (data.employee_id !== null) {
        await assertEmployeeInBusiness(db, owner.business_id, data.employee_id)
      }
      patch.employee_id = data.employee_id
    }
    if (data.status !== undefined) patch.status = data.status
    if (data.nama !== undefined) patch.nama = data.nama
    if (data.password !== undefined) patch.password_hash = await hashPassword(data.password)

    const updated = db.update(users).set(patch).where(eq(users.id, id)).returning().get()
    return { user: publicUser(updated) }
  })

  app.delete('/users/:id', async (req) => {
    const { id } = req.params as { id: string }
    const owner = currentUser(req)

    const { db } = getDb()
    const target = db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.business_id, owner.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Pengguna tidak ditemukan')
    }
    if (target.id === owner.id) {
      throw new ApiError(400, 'Anda tidak dapat menonaktifkan akun Anda sendiri')
    }
    if (target.role === 'owner' && !(await hasOtherOwner(owner.business_id, id))) {
      throw new ApiError(400, 'Bisnis harus memiliki minimal satu pemilik')
    }

    db.update(users).set({ status: 'nonaktif' as UserStatus }).where(eq(users.id, id)).run()
    return { ok: true }
  })
}

async function hasOtherOwner(businessId: string, excludedId: string): Promise<boolean> {
  const { db } = getDb()
  const other = db
    .select()
    .from(users)
    .where(and(eq(users.business_id, businessId), eq(users.role, 'owner')))
    .all()
    .find((u) => u.id !== excludedId)
  return Boolean(other)
}

async function assertEmployeeInBusiness(
  db: ReturnType<typeof getDb>['db'],
  businessId: string,
  employeeId: string,
): Promise<void> {
  const emp = db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.business_id, businessId)))
    .get()
  if (!emp) {
    throw new ApiError(422, 'employee_id tidak ditemukan dalam bisnis ini')
  }
}

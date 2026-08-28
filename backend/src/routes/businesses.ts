import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { businesses } from '../db/schema.js'
import { currentUser, publicUser, requireOwner, signToken } from '../lib/auth.js'
import { registerBusinessAndOwner } from '../lib/registration.js'
import { ForbiddenError, ValidationError } from '../lib/errors.js'

const createBusinessSchema = z.object({
  nama_bisnis: z.string().min(1, 'Nama bisnis wajib diisi').max(100, 'Nama bisnis maksimal 100 karakter'),
  jenis_usaha: z.enum(['fnb', 'jasa'], { message: 'Jenis usaha harus fnb atau jasa' }),
  alamat: z.string().min(1, 'Alamat wajib diisi').max(500, 'Alamat maksimal 500 karakter'),
  owner: z.object({
    nama: z.string().min(1, 'Nama owner wajib diisi').max(100, 'Nama owner maksimal 100 karakter'),
    email: z.string().email('Format email tidak valid').toLowerCase(),
    password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
  }),
})

const updateBusinessSchema = z
  .object({
    nama_bisnis: z.string().min(1, 'Nama bisnis wajib diisi').max(100, 'Nama bisnis maksimal 100 karakter').optional(),
    jenis_usaha: z.enum(['fnb', 'jasa'], { message: 'Jenis usaha harus fnb atau jasa' }).optional(),
    alamat: z.string().min(1, 'Alamat wajib diisi').max(500, 'Alamat maksimal 500 karakter').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

function businessShape(b: { id: string; nama_bisnis: string; jenis_usaha: string; alamat: string | null }) {
  return { id: b.id, nama_bisnis: b.nama_bisnis, jenis_usaha: b.jenis_usaha, alamat: b.alamat }
}

function assertBusinessScope(businessId: string, owner: { business_id: string }): void {
  if (owner.business_id !== businessId) {
    throw new ForbiddenError('Anda tidak memiliki izin untuk mengakses bisnis ini.')
  }
}

export default async function businessesRoutes(app: FastifyInstance): Promise<void> {
  app.post('/businesses', async (req) => {
    const parsed = createBusinessSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data pendaftaran bisnis tidak valid', parsed.error.flatten())
    }
    const { nama_bisnis, jenis_usaha, alamat, owner } = parsed.data

    const { db } = getDb()

    const { business, user } = await registerBusinessAndOwner(
      db,
      { namaBisnis: nama_bisnis, jenisUsaha: jenis_usaha, alamat },
      owner,
    )

    const token = signToken({
      sub: user.id,
      businessId: user.business_id,
      role: user.role,
      email: user.email,
    })

    return { user: publicUser(user), token, business: businessShape(business) }
  })

  app.get(
    '/businesses/:id',
    { preHandler: requireOwner },
    async (req) => {
      const { id } = req.params as { id: string }
      const user = currentUser(req)
      assertBusinessScope(id, user)

      const { db } = getDb()
      const business = db.select().from(businesses).where(eq(businesses.id, id)).get()
      if (!business) {
        throw new ForbiddenError('Bisnis tidak ditemukan.')
      }

      return { business: businessShape(business) }
    },
  )

  app.patch(
    '/businesses/:id',
    { preHandler: requireOwner },
    async (req) => {
      const { id } = req.params as { id: string }
      const parsed = updateBusinessSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Data bisnis tidak valid', parsed.error.flatten())
      }
      const data = parsed.data
      const user = currentUser(req)
      assertBusinessScope(id, user)

      const { db } = getDb()
      const business = db.select().from(businesses).where(eq(businesses.id, id)).get()
      if (!business) {
        throw new ForbiddenError('Bisnis tidak ditemukan.')
      }

      const patch: Record<string, unknown> = {}
      if (data.nama_bisnis !== undefined) patch.nama_bisnis = data.nama_bisnis
      if (data.jenis_usaha !== undefined) patch.jenis_usaha = data.jenis_usaha
      if (data.alamat !== undefined) patch.alamat = data.alamat

      const updated = db.update(businesses).set(patch).where(eq(businesses.id, id)).returning().get()
      return { business: businessShape(updated) }
    },
  )
}
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { businesses, geofenceModes } from '../db/schema.js'
import { currentUser, publicUser, requireAuth, requireCapability, requireOwner, signToken } from '../lib/auth.js'
import { recordAudit } from '../lib/audit.js'
import { registerBusinessAndOwner } from '../lib/registration.js'
import { ApiError, ForbiddenError, ValidationError } from '../lib/errors.js'

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

/**
 * Pengaturan lokasi kerja + radius geofence (ticket #67). `work_latitude` /
 * `work_longitude` wajib dikirim berpasangan (keduanya angka ATAU keduanya
 * null — null menonaktifkan lokasi). Batas radius dibaca dari baris bisnis
 * (`geofence_min_radius_m` / `geofence_max_radius_m`, default 20/5000).
 */
const workLocationSchema = z.object({
  work_latitude: z.union([z.number(), z.null()]).optional(),
  work_longitude: z.union([z.number(), z.null()]).optional(),
  work_radius_m: z.union([z.number().int('work_radius_m harus bilangan bulat'), z.null()]).optional(),
  geofence_mode: z.enum(geofenceModes, { message: 'geofence_mode harus flag_only atau block_in_radius' }).optional(),
})

function workLocationShape(b: {
  work_latitude: number | null
  work_longitude: number | null
  work_radius_m: number | null
  geofence_mode: string
}) {
  return {
    work_latitude: b.work_latitude,
    work_longitude: b.work_longitude,
    work_radius_m: b.work_radius_m,
    geofence_mode: b.geofence_mode,
  }
}

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

    const { accessToken, refreshToken } = await signToken(user, req)

    return { user: publicUser(user), token: accessToken, refreshToken, business: businessShape(business) }
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

      const updated = db.transaction((tx) => {
        const changed = tx.update(businesses).set(patch).where(eq(businesses.id, id)).returning().get()

        recordAudit({
          db: tx,
          businessId: user.business_id,
          actorUserId: user.id,
          action: 'business.update',
          entityType: 'business',
          entityId: id,
          before: business,
          after: changed,
        })

        return changed
      })
      return { business: businessShape(updated) }
    },
  )

  app.get(
    '/businesses/:id/work-location',
    { preHandler: requireAuth },
    async (req) => {
      const { id } = req.params as { id: string }
      const user = currentUser(req)
      assertBusinessScope(id, user)

      const { db } = getDb()
      const business = db.select().from(businesses).where(eq(businesses.id, id)).get()
      if (!business) {
        throw new ForbiddenError('Bisnis tidak ditemukan.')
      }

      // Belum dikonfigurasi = tidak ada lokasi kerja ATAU radius belum diset.
      if (
        business.work_latitude == null ||
        business.work_longitude == null ||
        business.work_radius_m == null
      ) {
        throw new ApiError(404, 'not_configured')
      }

      return workLocationShape(business)
    },
  )

  app.patch(
    '/businesses/:id/work-location',
    { preHandler: requireCapability('business.manage') },
    async (req) => {
      const { id } = req.params as { id: string }
      const parsed = workLocationSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ApiError(422, 'Data lokasi kerja tidak valid', parsed.error.flatten())
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

      if (data.work_latitude !== undefined || data.work_longitude !== undefined) {
        if (data.work_latitude === undefined || data.work_longitude === undefined) {
          throw new ApiError(422, 'work_latitude dan work_longitude wajib dikirim bersama')
        }
        if (data.work_latitude === null && data.work_longitude === null) {
          // Menghapus lokasi (work-location dinonaktifkan).
          patch.work_latitude = null
          patch.work_longitude = null
        } else if (data.work_latitude !== null && data.work_longitude !== null) {
          if (data.work_latitude < -90 || data.work_latitude > 90) {
            throw new ApiError(422, 'work_latitude di luar rentang [-90, 90]')
          }
          if (data.work_longitude < -180 || data.work_longitude > 180) {
            throw new ApiError(422, 'work_longitude di luar rentang [-180, 180]')
          }
          patch.work_latitude = data.work_latitude
          patch.work_longitude = data.work_longitude
        } else {
          throw new ApiError(422, 'work_latitude dan work_longitude wajib keduanya diisi atau keduanya null')
        }
      }

      if (data.work_radius_m !== undefined) {
        if (data.work_radius_m === null) {
          // Radius null = geofence nonaktif.
          patch.work_radius_m = null
        } else {
          const min = business.geofence_min_radius_m ?? 20
          const max = business.geofence_max_radius_m ?? 5000
          if (data.work_radius_m < min || data.work_radius_m > max) {
            throw new ApiError(422, `work_radius_m harus antara ${min} dan ${max} meter`)
          }
          patch.work_radius_m = data.work_radius_m
        }
      }

      if (data.geofence_mode !== undefined) {
        patch.geofence_mode = data.geofence_mode
      }

      if (Object.keys(patch).length === 0) {
        throw new ApiError(422, 'Tidak ada field yang diubah')
      }

      const updated = db.transaction((tx) => {
        const changed = tx.update(businesses).set(patch).where(eq(businesses.id, id)).returning().get()

        recordAudit({
          db: tx,
          businessId: user.business_id,
          actorUserId: user.id,
          action: 'business.work_location.update',
          entityType: 'business',
          entityId: id,
          before: workLocationShape(business),
          after: workLocationShape(changed),
        })

        return changed
      })

      return workLocationShape(updated)
    },
  )
}

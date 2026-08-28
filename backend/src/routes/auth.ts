import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { users } from '../db/schema.js'
import { getCurrentUser, publicUser, signToken, verifyPassword } from '../lib/auth.js'
import { registerBusinessAndOwner } from '../lib/registration.js'
import { UnauthorizedError, ValidationError } from '../lib/errors.js'

const signUpSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Format email tidak valid').toLowerCase(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  namaBisnis: z.string().min(1, 'Nama bisnis wajib diisi').optional(),
})

const signInSchema = z.object({
  email: z.string().email('Format email tidak valid').toLowerCase(),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
})

function issue(user: NonNullable<ReturnType<typeof getCurrentUser>>) {
  const token = signToken({
    sub: user.id,
    businessId: user.business_id,
    role: user.role,
    email: user.email,
  })
  return { user: publicUser(user), token }
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/sign-up', async (req) => {
    const parsed = signUpSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data pendaftaran tidak valid', parsed.error.flatten())
    }
    const { nama, email, password, namaBisnis } = parsed.data

    const { db } = getDb()

    const { user } = await registerBusinessAndOwner(
      db,
      { namaBisnis: namaBisnis ?? 'Bisnis ' + nama },
      { nama, email, password },
    )

    return issue(user)
  })

  app.post('/auth/sign-in', async (req) => {
    const parsed = signInSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data masuk tidak valid', parsed.error.flatten())
    }
    const { email, password } = parsed.data

    const { db } = getDb()
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new UnauthorizedError('Email atau kata sandi salah')
    }
    if (user.status !== 'aktif') {
      throw new UnauthorizedError('Akun dinonaktifkan')
    }

    return issue(user)
  })

  app.post('/auth/sign-out', async () => {
    return { ok: true }
  })

  app.get('/auth/me', async (req) => {
    const user = getCurrentUser(req)
    if (!user) throw new UnauthorizedError()
    return { user: publicUser(user) }
  })
}

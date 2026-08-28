import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { sessions, users, type User } from '../db/schema.js'
import {
  currentUser,
  extractBearer,
  getCurrentUser,
  publicUser,
  requireAuth,
  revokeAllSessionsForUser,
  revokeSession,
  rotateSession,
  signToken,
  verifyPassword,
  verifyToken,
} from '../lib/auth.js'
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

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token wajib diisi'),
})

async function issue(user: User, req: Parameters<typeof signToken>[1]) {
  const { accessToken, refreshToken } = await signToken(user, req)
  return { user: publicUser(user), token: accessToken, refreshToken }
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

    return issue(user, req)
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

    return issue(user, req)
  })

  app.post('/auth/sign-out', { preHandler: requireAuth }, async (req) => {
    currentUser(req)
    const token = extractBearer(req)
    const payload = await verifyToken(token!)
    revokeSession(payload.sid)
    return { ok: true }
  })

  app.post('/auth/sign-out-all', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const sessionsRevoked = revokeAllSessionsForUser(user.id)
    return { ok: true, sessions_revoked: sessionsRevoked }
  })

  app.post('/auth/refresh', async (req) => {
    const parsed = refreshSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data tidak valid', parsed.error.flatten())
    }
    const payload = await verifyToken(parsed.data.refresh_token)
    if (payload.type !== 'refresh') {
      throw new UnauthorizedError()
    }

    const { db } = getDb()
    const user = db.select().from(users).where(eq(users.id, payload.sub)).get()
    if (!user || user.status !== 'aktif') {
      throw new UnauthorizedError()
    }
    const session = db.select().from(sessions).where(eq(sessions.jti, payload.jti)).get()
    if (!session) {
      throw new UnauthorizedError()
    }

    const { accessToken, refreshToken } = await rotateSession(user, session, req)
    return { accessToken, refreshToken, user: publicUser(user) }
  })

  app.get('/auth/me', async (req) => {
    const user = await getCurrentUser(req)
    if (!user) throw new UnauthorizedError()
    return { user: publicUser(user) }
  })
}
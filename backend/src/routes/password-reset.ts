import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'
import { getDb } from '../db/index.js'
import { passwordResets, users } from '../db/schema.js'
import { hashPassword, revokeAllSessionsForUser } from '../lib/auth.js'
import { ApiError, ValidationError } from '../lib/errors.js'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const FORGOT_MAX_PER_HOUR = 3
const RESET_MAX_PER_HOUR = 10

/** Counter in-memory sederhana untuk rate limit (persisten di luar scope). */
const forgotAttempts = new Map<string, number[]>()
const resetAttempts = new Map<string, number[]>()

function hitCounter(map: Map<string, number[]>, key: string, windowMs: number, max: number): void {
  const now = Date.now()
  const windowStart = now - windowMs
  const hits = (map.get(key) ?? []).filter((t) => t > windowStart)
  if (hits.length >= max) {
    throw new ApiError(429, 'Terlalu banyak permintaan. Coba lagi nanti.')
  }
  map.set(key, [...hits, now])
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid').toLowerCase(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
})

export default async function passwordResetRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/forgot-password', async (req) => {
    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data tidak valid', parsed.error.flatten())
    }
    const { email } = parsed.data
    hitCounter(forgotAttempts, email, RESET_TOKEN_TTL_MS, FORGOT_MAX_PER_HOUR)

    const { db } = getDb()
    const user = db.select().from(users).where(eq(users.email, email)).get()
    if (user) {
      const token = randomBytes(32).toString('hex')
      db.insert(passwordResets)
        .values({
          user_id: user.id,
          token_hash: hashToken(token),
          expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        })
        .run()
      const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      // Pengiriman email nyata di luar scope — placeholder mencatat tautan ke log.
      console.log(`[password-reset] tautan reset untuk ${email}: ${baseUrl}/reset-password?token=${token}`)
    }
    return { ok: true, message: 'Jika email terdaftar, tautan reset kata sandi telah dikirim.' }
  })

  app.post('/auth/reset-password', async (req) => {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data tidak valid', parsed.error.flatten())
    }
    const { token, password } = parsed.data
    hitCounter(resetAttempts, clientKey(req), RESET_TOKEN_TTL_MS, RESET_MAX_PER_HOUR)

    const { db } = getDb()
    const record = db.select().from(passwordResets).where(eq(passwordResets.token_hash, hashToken(token))).get()
    if (!record || record.used_at !== null) {
      throw new ApiError(400, 'Token reset tidak valid atau sudah dipakai')
    }
    if (record.expires_at.getTime() < Date.now()) {
      throw new ApiError(400, 'Token reset sudah kedaluwarsa')
    }

    const user = db.select().from(users).where(eq(users.id, record.user_id)).get()
    if (!user) {
      throw new ApiError(400, 'Token reset tidak valid')
    }

    db.update(users).set({ password_hash: await hashPassword(password) }).where(eq(users.id, user.id)).run()
    db.update(passwordResets).set({ used_at: new Date() }).where(eq(passwordResets.id, record.id)).run()
    revokeAllSessionsForUser(user.id)

    return { ok: true }
  })
}

function clientKey(req: FastifyRequest): string {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip
  return `reset:${ip ?? 'unknown'}`
}
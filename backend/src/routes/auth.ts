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
import {
  mintForUser,
  revokeAllForUser,
  revokeOneByToken,
  verifyForRefresh,
} from '../lib/device-credential.js'
import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/errors.js'
import { capabilitiesForRole, ROLE_CAPABILITIES_FOR_FRONTEND } from '../lib/capabilities.js'

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

const signOutSchema = z
  .object({
    device_refresh_token: z.string().min(1).optional(),
  })
  .optional()

const deviceRefreshSchema = z.object({
  device_id: z.string().min(1, 'device_id wajib diisi'),
  device_install_id: z.string().min(1, 'device_install_id wajib diisi'),
  device_refresh_token: z.string().min(1, 'device_refresh_token wajib diisi'),
  // Wajib secara logika — verifyForRefresh menolak dengan 401 bila hilang.
  biometric_proof: z.string().optional(),
})

function deviceIdFromHeader(req: Parameters<typeof signToken>[1]): string | null {
  const raw = req?.headers['x-device-id']
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  return raw.trim()
}

async function issue(user: User, req: Parameters<typeof signToken>[1]) {
  const { accessToken, refreshToken } = await signToken(user, req)
  return { user: publicUser(user), token: accessToken, refreshToken }
}

interface RateLimitConfig {
  max: number
  timeWindow: number
}

interface AuthRoutesOptions {
  rateLimit?: { signIn?: RateLimitConfig; signUp?: RateLimitConfig }
}

const DEFAULT_SIGNIN_RATE_LIMIT: RateLimitConfig = { max: 5, timeWindow: 60_000 }
const DEFAULT_SIGNUP_RATE_LIMIT: RateLimitConfig = { max: 3, timeWindow: 60_000 }

export default async function authRoutes(app: FastifyInstance, opts?: AuthRoutesOptions): Promise<void> {
  const signInRateLimit = opts?.rateLimit?.signIn ?? DEFAULT_SIGNIN_RATE_LIMIT
  const signUpRateLimit = opts?.rateLimit?.signUp ?? DEFAULT_SIGNUP_RATE_LIMIT

  app.post('/auth/sign-up', { config: { rateLimit: signUpRateLimit } }, async (req) => {
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

  app.post('/auth/sign-in', { config: { rateLimit: signInRateLimit } }, async (req) => {
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

    const tokens = await issue(user, req)
    // Ticket #72: kredensial perangkat (biometric sign-in) diterbitkan HANYA
    // bila klien membawa header X-Device-Id (app mobile). Web tidak menerima
    // device_refresh_token — respons lama tidak berubah.
    const deviceId = deviceIdFromHeader(req)
    const device = deviceId ? mintForUser(user, deviceId) : null

    return {
      ...tokens,
      ...(device && {
        device_refresh_token: device.deviceRefreshToken,
        device_refresh_expires_at: device.expiresAt.toISOString(),
        device_install_id: device.deviceInstallId,
        device_biometric_key: device.biometricKey,
      }),
    }
  })

  app.post('/auth/sign-out', { preHandler: requireAuth }, async (req) => {
    currentUser(req)
    const token = extractBearer(req)
    const payload = await verifyToken(token!)
    revokeSession(payload.sid)
    // Ticket #72: single sign-out ikut mencabut kredensial perangkat sesi ini
    // (device_refresh_token yang dipegang klien) bila dikirim di body.
    const parsed = signOutSchema.safeParse(req.body)
    const deviceToken = parsed.success ? parsed.data?.device_refresh_token : undefined
    if (deviceToken) {
      revokeOneByToken(deviceToken)
    }
    return { ok: true }
  })

  app.post('/auth/sign-out-all', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const sessionsRevoked = revokeAllSessionsForUser(user.id)
    // Ticket #72: semua kredensial perangkat user ikut dicabut.
    const deviceCredentialsRevoked = revokeAllForUser(user.id)
    return { ok: true, sessions_revoked: sessionsRevoked, device_credentials_revoked: deviceCredentialsRevoked }
  })

  /**
   * Ticket #72 — refresh kredensial perangkat (biometric sign-in). Konsep
   * terpisah dari `/auth/refresh` (pasangan access/refresh pendek): endpoint ini
   * memvalidasi device_refresh_token + binding (user_id, device_id,
   * device_install_id) + biometric_proof, lalu menerbitkan pasangan token baru
   * DAN kredensial perangkat baru (rotasi — credential lama dicabut).
   */
  app.post('/auth/device-refresh', { config: { rateLimit: signInRateLimit } }, async (req) => {
    const parsed = deviceRefreshSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Data tidak valid', parsed.error.flatten())
    }
    const { device_id, device_install_id, device_refresh_token, biometric_proof } = parsed.data

    const loadout = verifyForRefresh({
      deviceId: device_id,
      deviceInstallId: device_install_id,
      deviceRefreshToken: device_refresh_token,
      biometricProof: biometric_proof,
    })

    const { db } = getDb()
    const user = db.select().from(users).where(eq(users.id, loadout.userId)).get()
    if (!user) {
      throw new UnauthorizedError()
    }
    if (user.status !== 'aktif') {
      throw new ForbiddenError('Akun dinonaktifkan')
    }

    // Rotasi: credential lama dicabut, pasangan token + credential baru diterbitkan.
    revokeOneByToken(device_refresh_token)
    const { accessToken, refreshToken } = await signToken(user, req)
    const device = mintForUser(user, device_id)

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: publicUser(user),
      device_refresh_token: device.deviceRefreshToken,
      device_refresh_expires_at: device.expiresAt.toISOString(),
      device_install_id: device.deviceInstallId,
      device_biometric_key: device.biometricKey,
    }
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
    return {
      user: publicUser(user),
      capabilities: capabilitiesForRole(user.role),
      role_capabilities: ROLE_CAPABILITIES_FOR_FRONTEND,
    }
  })
}
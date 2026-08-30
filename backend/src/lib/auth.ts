import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index.js'
import { sessions, users, type Role, type Session, type User } from '../db/schema.js'
import { hasCapability, type Capability } from './capabilities.js'
import { ForbiddenError, UnauthorizedError } from './errors.js'

const BCRYPT_ROUNDS = 10

/** Umur access token (detik). Default 1 jam, bisa di-override via env. */
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 60 * 60)
/** Umur refresh token (detik) = umur sesi. Default 7 hari. */
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000

export type TokenType = 'access' | 'refresh'

export interface TokenPayload {
  sub: string
  businessId: string
  role: Role
  email: string
  jti: string
  sid: string
  type: TokenType
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  session: Session
}

/**
 * Validasi boot-time: JWT_SECRET wajib ada dan minimal 32 karakter.
 * Dipanggil saat server start dan saat membaca secret untuk menandatangani/verifikasi token.
 */
export function assertJwtSecretValid(): void {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 chars; see backend/.env.example')
  }
}

export function getJwtSecret(): string {
  assertJwtSecretValid()
  return process.env.JWT_SECRET as string
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Membuat baris sesi baru (revocable, 7 hari) untuk seorang user.
 */
export function createSessionRow(userId: string, req?: FastifyRequest): Session {
  const { db } = getDb()
  const now = Date.now()
  return db
    .insert(sessions)
    .values({
      user_id: userId,
      jti: randomUUID(),
      issued_at: new Date(now),
      expires_at: new Date(now + REFRESH_TOKEN_TTL_MS),
      user_agent: req?.headers['user-agent'] ?? null,
      ip: req?.ip ?? null,
    })
    .returning()
    .get()
}

/**
 * Menerbitkan pasangan token (access + refresh) untuk sesi baru.
 * Access token berumur 1 jam, refresh token 7 hari; keduanya memuat klaim
 * `jti` (id token/sesi) dan `sid` (id baris sessions) agar bisa dicabut.
 */
export async function signToken(
  user: Pick<User, 'id' | 'business_id' | 'role' | 'email'>,
  req?: FastifyRequest,
): Promise<IssuedTokens> {
  const session = createSessionRow(user.id, req)
  const base = {
    sub: user.id,
    businessId: user.business_id,
    role: user.role,
    email: user.email,
    jti: session.jti,
    sid: session.id,
  }
  const accessToken = jwt.sign(
    { ...base, type: 'access' as const },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS, algorithm: 'HS256' },
  )
  const refreshToken = jwt.sign(
    { ...base, type: 'refresh' as const },
    getJwtSecret(),
    { expiresIn: REFRESH_TOKEN_TTL_SECONDS, algorithm: 'HS256' },
  )
  return { accessToken, refreshToken, session }
}

/**
 * Memverifikasi tanda tangan JWT lalu memastikan sesinya masih terbuka:
 * belum dicabut, belum kedaluwarsa, dan milik subjek yang sama.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  let payload: TokenPayload
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as TokenPayload
  } catch {
    throw new UnauthorizedError()
  }
  const { db } = getDb()
  const session = db.select().from(sessions).where(eq(sessions.jti, payload.jti)).get()
  if (
    !session ||
    session.user_id !== payload.sub ||
    session.revoked_at !== null ||
    session.expires_at.getTime() < Date.now()
  ) {
    throw new UnauthorizedError()
  }
  return payload
}

/** Mencabut satu sesi (idempoten). */
export function revokeSession(sessionId: string): void {
  const { db } = getDb()
  db.update(sessions)
    .set({ revoked_at: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revoked_at)))
    .run()
}

/** Mencabut semua sesi seorang user yang masih aktif. Mengembalikan jumlah yang dicabut. */
export function revokeAllSessionsForUser(userId: string): number {
  const { db } = getDb()
  const result = db
    .update(sessions)
    .set({ revoked_at: new Date() })
    .where(and(eq(sessions.user_id, userId), isNull(sessions.revoked_at)))
    .run()
  return result.changes
}

/**
 * Rotasi sesi: mencabut sesi lama lalu menerbitkan sesi + token baru.
 * Dipakai saat refresh agar token lama tidak bisa dipakai ulang.
 */
export async function rotateSession(
  user: Pick<User, 'id' | 'business_id' | 'role' | 'email'>,
  oldSession: Session,
  req?: FastifyRequest,
): Promise<IssuedTokens> {
  revokeSession(oldSession.id)
  return signToken(user, req)
}

export function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export async function getCurrentUser(req: FastifyRequest): Promise<User | null> {
  const token = extractBearer(req)
  if (!token) return null
  try {
    const payload = await verifyToken(token)
    if (payload.type !== 'access') return null
    const user = getDb().db.select().from(users).where(eq(users.id, payload.sub)).get()
    if (!user || user.status !== 'aktif') return null
    return user
  } catch {
    return null
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = await getCurrentUser(req)
  if (!user) {
    throw new UnauthorizedError()
  }
  ;(req as AuthRequest).user = user
}

export async function requireOwner(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply)
  const user = (req as AuthRequest).user
  if (user.role !== 'owner') {
    throw new ForbiddenError('Hanya pemilik yang dapat mengakses sumber daya ini.')
  }
}

/**
 * Middleware berbasis capability. Memastikan user terautentikasi dan perannya
 * memegang capability yang diminta (lihat `src/lib/capabilities.ts`). Bila
 * tidak → 403.
 */
export function requireCapability(capability: Capability) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(req, reply)
    const user = (req as AuthRequest).user
    if (!hasCapability(user.role, capability)) {
      throw new ForbiddenError('Anda tidak memiliki izin untuk aksi ini.')
    }
  }
}

export interface AuthRequest extends FastifyRequest {
  user: User
}

export function currentUser(req: FastifyRequest): User {
  const user = (req as AuthRequest).user
  if (!user) throw new UnauthorizedError()
  return user
}

/**
 * Mengubah hasil query user menjadi bentuk aman (tanpa password_hash).
 */
export function publicUser(user: User): Omit<User, 'password_hash'> {
  const { password_hash: _omit, ...safe } = user
  return safe
}
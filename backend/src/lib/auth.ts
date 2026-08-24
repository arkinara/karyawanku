import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { users, type Role, type User } from '../db/schema.js'
import { ForbiddenError, UnauthorizedError } from './errors.js'

const BCRYPT_ROUNDS = 10

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET belum diset di environment')
  }
  return secret
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export interface TokenPayload {
  sub: string
  businessId: string
  role: Role
  email: string
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: '7d', algorithm: 'HS256' }
  return jwt.sign(payload, getJwtSecret(), options)
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as TokenPayload
}

export function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export function getCurrentUser(req: FastifyRequest): User | null {
  const token = extractBearer(req)
  if (!token) return null
  try {
    const payload = verifyToken(token)
    const user = getDb().db.select().from(users).where(eq(users.id, payload.sub)).get()
    if (!user || user.status !== 'aktif') return null
    return user
  } catch {
    return null
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = getCurrentUser(req)
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

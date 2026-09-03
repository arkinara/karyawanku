import { and, eq, isNull } from 'drizzle-orm'
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getDb } from '../db/index.js'
import { deviceCredentials, type User } from '../db/schema.js'
import { UnauthorizedError } from './errors.js'

/**
 * Kredensial perangkat untuk sign-in biometrik (ticket #72). Satu baris per
 * `device_refresh_token` (token mentah hanya disimpan sebagai sha256 di
 * `token_hash`); `biometric_key` adalah secret verifikasi per-credential yang
 * disimpan server-side — dipakai memvalidasi `biometric_proof` (HMAC-SHA256
 * atas tuple `device_id:device_install_id`) pada POST /auth/device-refresh.
 *
 * Pilihan desain (didokumentasikan): ini adalah konsep terpisah dari pasangan
 * access/refresh pendek (`sessions` + JWT) — credential berumur panjang (30
 * hari) dan terikat ke perangkat, bukan ke sesi browser/device session JWT.
 * `biometric_key` sengaja TIDAK di-hash: BE perlu key mentah untuk memverifikasi
 * HMAC, dan key tanpa token yang valid (hash-only) tidak berguna.
 */
const DEVICE_CREDENTIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface MintedDeviceCredential {
  deviceRefreshToken: string
  biometricKey: string
  deviceInstallId: string
  issuedAt: Date
  expiresAt: Date
}

/** sha256 token mentah — satu-satunya bentuk token yang pernah disimpan ke DB. */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Verifikasi `biometric_proof`: HMAC-SHA256(key = biometric_key credential,
 * message = `device_id:device_install_id`). `device_install_id` berotasi setiap
 * mint, sehingga proof ikut berotasi — proof lama mati bersama credential lama.
 */
export function verifyBiometricProof(params: {
  biometricKey: string
  deviceId: string
  deviceInstallId: string
  proof: string | null | undefined
}): boolean {
  const { biometricKey, deviceId, deviceInstallId, proof } = params
  if (typeof proof !== 'string' || proof.length === 0) return false
  const expected = createHmac('sha256', biometricKey)
    .update(`${deviceId}:${deviceInstallId}`)
    .digest('hex')
  return timingSafeEqualHex(expected, proof)
}

/**
 * Menerbitkan kredensial perangkat baru untuk seorang user + perangkat.
 * Token mentah dikembalikan satu kali (one-time) kepada pemanggil; hanya
 * hashnya yang disimpan.
 */
export function mintForUser(
  user: Pick<User, 'id' | 'business_id'>,
  deviceId: string | null,
): MintedDeviceCredential {
  const { db } = getDb()
  const deviceRefreshToken = randomBytes(32).toString('hex')
  const biometricKey = randomBytes(32).toString('hex')
  const deviceInstallId = randomUUID()
  const issuedAt = new Date()
  const expiresAt = new Date(Date.now() + DEVICE_CREDENTIAL_TTL_MS)
  db.insert(deviceCredentials)
    .values({
      user_id: user.id,
      business_id: user.business_id,
      device_id: deviceId,
      device_install_id: deviceInstallId,
      token_hash: hashDeviceToken(deviceRefreshToken),
      biometric_key: biometricKey,
      issued_at: issuedAt,
      expires_at: expiresAt,
    })
    .run()
  return { deviceRefreshToken, biometricKey, deviceInstallId, issuedAt, expiresAt }
}

export interface DeviceCredentialLoadout {
  userId: string
  businessId: string
  deviceId: string
  deviceInstallId: string
}

/**
 * Memvalidasi kredensial perangkat untuk refresh. 401 pada: token tak dikenal,
 * sudah dicabut (revoked — termasuk signOutAll), kedaluwarsa, mismatch tuple
 * (device_id / device_install_id) lintas perangkat, atau biometric_proof
 * hilang/salah. Setelah valid, `last_used_at` ikut dirotasi.
 */
export function verifyForRefresh(params: {
  deviceId: string
  deviceInstallId: string
  deviceRefreshToken: string
  biometricProof?: string | null
}): DeviceCredentialLoadout {
  const { deviceId, deviceInstallId, deviceRefreshToken, biometricProof } = params
  const { db } = getDb()
  const row = db
    .select()
    .from(deviceCredentials)
    .where(eq(deviceCredentials.token_hash, hashDeviceToken(deviceRefreshToken)))
    .get()

  if (
    !row ||
    row.revoked_at !== null ||
    row.expires_at.getTime() < Date.now() ||
    row.device_id !== deviceId ||
    row.device_install_id !== deviceInstallId
  ) {
    throw new UnauthorizedError('Kredensial perangkat tidak valid atau kedaluwarsa')
  }

  if (!verifyBiometricProof({ biometricKey: row.biometric_key, deviceId, deviceInstallId, proof: biometricProof })) {
    throw new UnauthorizedError('Bukti biometrik tidak valid')
  }

  db.update(deviceCredentials)
    .set({ last_used_at: new Date() })
    .where(eq(deviceCredentials.id, row.id))
    .run()

  return {
    userId: row.user_id,
    businessId: row.business_id,
    deviceId,
    deviceInstallId,
  }
}

/** Mencabut semua kredensial perangkat aktif seorang user (sign-out-all). Idempoten. */
export function revokeAllForUser(userId: string): number {
  const { db } = getDb()
  const result = db
    .update(deviceCredentials)
    .set({ revoked_at: new Date() })
    .where(and(eq(deviceCredentials.user_id, userId), isNull(deviceCredentials.revoked_at)))
    .run()
  return result.changes
}

/** Mencabut satu kredensial perangkat berdasarkan token mentah (sign-out). Idempoten. */
export function revokeOneByToken(token: string): boolean {
  const { db } = getDb()
  const result = db
    .update(deviceCredentials)
    .set({ revoked_at: new Date() })
    .where(
      and(eq(deviceCredentials.token_hash, hashDeviceToken(token)), isNull(deviceCredentials.revoked_at)),
    )
    .run()
  return result.changes > 0
}
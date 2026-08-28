/**
 * KaryawanKu — catatan audit append-only (ticket #57).
 *
 * Satu-satunya jalur tulis tabel `audit_logs`. Wajib dipanggil DI DALAM
 * transaksi (drizzle `db.transaction((tx) => ...)`) yang sama dengan perubahan
 * yang dideskripsikannya sehingga keduanya atomik: change + audit row sama-sama
 * masuk, atau sama-sama batal.
 *
 * ⚠️ PENTING — JANGAN backdate/edit:
 * `audit_logs` bersifat append-only dan tidak boleh diubah. Jangan pernah
 * membuat rute PUT/PATCH/DELETE untuk tabel ini, dan jangan pernah memodifikasi
 * `created_at`/`before`/`after` sebuah baris audit untuk "memundurkan" waktu
 * atau menutup jejak. Setiap koreksi atas kesalahan masa lalu dicatat sebagai
 * baris audit BARU, bukan dengan mengedit baris lama.
 */

import { auditLogs, type NewAuditLog } from '../db/schema.js'

/**
 * Bentuk minimal handle DB yang diterima `recordAudit` — memungkinkan helper
 * dipanggil dengan `db` biasa MAUPUN `tx` dari `db.transaction((tx) => ...)`
 * (better-sqlite3, sinkron), sehingga audit row selalu ditulis atomik dengan
 * perubahan yang dideskripsikannya.
 */
export interface AuditWriteDb {
  insert: (table: typeof auditLogs) => {
    values: (row: NewAuditLog) => { run: () => unknown }
  }
}

/**
 * Pola nama field yang dianggap sensitif → nilai-nya diganti `[redacted]`
 * sebelum disimpan. Menjamin hash password, token (jti/refresh/reset), dan
 * secret tidak pernah tertulis ke `before`/`after`.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^password/i,
  /passwd/i,
  /token/i,
  /secret/i,
  /refresh/i,
  /^jti$/i,
  /^sid$/i,
]

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key))
}

/** Rekursif menandai nilai field sensitif dengan `[redacted]`. */
export function redact(value: unknown, key = ''): unknown {
  if (isSensitiveKey(key)) return '[redacted]'
  if (Array.isArray(value)) return value.map((v) => redact(v))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = redact(v, k)
    }
    return out
  }
  return value
}

export interface RecordAuditParams {
  db: AuditWriteDb
  businessId: string
  actorUserId: string
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
}

export function recordAudit(params: RecordAuditParams): void {
  const { db, businessId, actorUserId, action, entityType, entityId, before, after } = params
  try {
    db.insert(auditLogs)
      .values({
        business_id: businessId,
        actor_user_id: actorUserId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        before: before === undefined ? null : (redact(before) as never),
        after: after === undefined ? null : (redact(after) as never),
      })
      .run()
  } catch (err) {
    throw new Error('Gagal menulis catatan audit', { cause: err })
  }
}
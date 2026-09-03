/**
 * KaryawanKu — layanan pengiriman push (ticket #71).
 *
 * `sendNotification(userId, kind, notification, data)`:
 *   1. Mencari semua `push_devices` milik user.
 *   2. Fan-out ke tiap perangkat lewat provider (best-effort).
 *   3. Mencatat tiap percobaan di `notification_log`.
 *   4. Token `unregistered` / `invalid_argument` → baris perangkat dihapus.
 *   5. Kegagalan transien → jadwalkan retry (`next_retry_at` = now + 60s·2^n,
 *      dibatasi 1 jam, maks 5 percobaan; diproses `retryDue` oleh tick).
 *   6. TIDAK pernah memblokir caller — pemanggil memakai `void
 *      sendNotification(...).catch(...)` (fire-and-forget), dan pengiriman
 *      terjadi DI LUAR transaksi approval. Outage provider tidak pernah
 *      menggagalkan persetujuan cuti.
 *
 * `payload_json` menyimpan data notifikasi (deep-link + kind); teks title/body
 * disimpan di kunci `_n` agar retry bisa merekonstruksi isi asli. Payload
 * TIDAK pernah memuat nominal gaji/slip (negative AC).
 */
import { and, eq, isNull, lte } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { notificationLog, pushDevices } from '../db/schema.js'
import {
  getPushProvider,
  type PushData,
  type PushNotification,
  type PushProvider,
  type PushResult,
} from './push-provider.js'

export const MAX_PUSH_ATTEMPTS = 5
/** 60 detik × 2^n, dibatasi 1 jam. */
export const RETRY_BASE_MS = 60_000
export const RETRY_CAP_MS = 60 * 60_000

/** Kunci cadangan dalam payload_json yang memuat teks notifikasi untuk retry. */
const NOTIFICATION_KEY = '_n'

let providerPromise: Promise<PushProvider> | null = null

function provider(): Promise<PushProvider> {
  providerPromise ??= getPushProvider()
  return providerPromise
}

/** Hapus cache provider — dipakai test agar override provider (outage) berlaku. */
export function resetPushProviderCache(): void {
  providerPromise = null
}

function retryDelayMs(attemptsSoFar: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attemptsSoFar - 1), RETRY_CAP_MS)
}

function buildPayload(notification: PushNotification, data: PushData): string {
  return JSON.stringify({ ...data, [NOTIFICATION_KEY]: notification })
}

function parsePayload(raw: unknown): { notification: PushNotification; data: PushData } {
  let parsed: Record<string, unknown> = {}
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      parsed = {}
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>
  }
  const { [NOTIFICATION_KEY]: notif, ...data } = parsed
  const notification: PushNotification =
    notif && typeof notif === 'object'
      ? {
          title: String((notif as Record<string, unknown>).title ?? ''),
          body: String((notif as Record<string, unknown>).body ?? ''),
        }
      : { title: '', body: '' }
  return { notification, data }
}

interface DeliverParams {
  userId: string
  token: string
  kind: string
  notification: PushNotification
  data: PushData
  /** ID baris push_devices — untuk pruning token invalid. */
  deviceId?: string
  /** ID baris notification_log — update percobaan retry, bukan insert baru. */
  logId?: string
  /** Jumlah percobaan yang sudah tercatat (1 untuk percobaan pertama). */
  attemptsSoFar: number
}

async function deliver(params: DeliverParams): Promise<void> {
  const { db } = getDb()
  const { userId, token, kind, deviceId, logId, attemptsSoFar } = params
  const payload = buildPayload(params.notification, params.data)

  const result: PushResult = await provider()
    .then((p) => p.send(token, params.notification, params.data))
    .catch(() => ({ ok: false, error: 'provider_exception' }))

  const now = new Date()

  if (result.ok) {
    if (logId) {
      db.update(notificationLog)
        .set({ attempts: attemptsSoFar, delivered_at: now, last_error: null, next_retry_at: null })
        .where(eq(notificationLog.id, logId))
        .run()
    } else {
      db.insert(notificationLog)
        .values({
          user_id: userId,
          kind,
          payload_json: payload,
          device_token: token,
          attempts: attemptsSoFar,
          delivered_at: now,
        })
        .run()
    }
    return
  }

  const error = result.error ?? 'unknown'
  if (error === 'unregistered' || error === 'invalid_argument') {
    // Token mati — jangan kirim ulang; prune perangkat (best-effort).
    if (deviceId) {
      db.delete(pushDevices).where(eq(pushDevices.id, deviceId)).run()
    }
    if (logId) {
      db.update(notificationLog)
        .set({ attempts: attemptsSoFar, delivered_at: now, last_error: error, next_retry_at: null })
        .where(eq(notificationLog.id, logId))
        .run()
    } else {
      db.insert(notificationLog)
        .values({
          user_id: userId,
          kind,
          payload_json: payload,
          device_token: token,
          attempts: attemptsSoFar,
          delivered_at: now,
          last_error: error,
        })
        .run()
    }
    return
  }

  // Kegagalan transien → jadwalkan retry bila masih dalam batas.
  const canRetry = attemptsSoFar < MAX_PUSH_ATTEMPTS
  const next = canRetry ? new Date(Date.now() + retryDelayMs(attemptsSoFar)) : null
  if (logId) {
    db.update(notificationLog)
      .set({ attempts: attemptsSoFar, last_error: error, next_retry_at: next })
      .where(eq(notificationLog.id, logId))
      .run()
  } else {
    db.insert(notificationLog)
      .values({
        user_id: userId,
        kind,
        payload_json: payload,
        device_token: token,
        attempts: attemptsSoFar,
        last_error: error,
        next_retry_at: next,
      })
      .run()
  }
}

function reportError(context: string, err: unknown): void {
  console.error(`[push] ${context} gagal:`, err)
}

/** Kirim ke semua perangkat user (fan-out). Fire-and-forget — pemanggil harus
 *  memakai `void sendNotification(...).catch(...)` agar approval tidak diblokir. */
export function sendNotification(
  userId: string,
  kind: string,
  notification: PushNotification,
  data: PushData,
): void {
  void (async () => {
    const { db } = getDb()
    const devices = db.select().from(pushDevices).where(eq(pushDevices.user_id, userId)).all()
    for (const device of devices) {
      await deliver({
        userId,
        token: device.token,
        kind,
        notification,
        data,
        deviceId: device.id,
        attemptsSoFar: 1,
      })
    }
  })().catch((err) => reportError(`sendNotification(${kind})`, err))
}

/** Kirim ad-hoc ke satu token tanpa fan-out per-user. */
export function sendToDevice(
  token: string,
  kind: string,
  notification: PushNotification,
  data: PushData,
): void {
  const { db } = getDb()
  const device = db.select().from(pushDevices).where(eq(pushDevices.token, token)).get()
  if (!device) {
    console.warn('[push] sendToDevice: token tidak terdaftar — dilewati.')
    return
  }
  void deliver({
    userId: device.user_id,
    token,
    kind,
    notification,
    data,
    deviceId: device.id,
    attemptsSoFar: 1,
  }).catch((err) => reportError(`sendToDevice(${kind})`, err))
}

/**
 * Proses ulang notifikasi yang `next_retry_at`-nya sudah lewat. Dipanggil tick
 * scheduler (bersama tick pengingat shift). Mengembalikan jumlah baris yang
 * dicoba ulang. Baris tanpa token / sudah `delivered_at` dilewati.
 */
export function retryDue(now = new Date()): number {
  const { db } = getDb()
  const due = db
    .select()
    .from(notificationLog)
    .where(and(lte(notificationLog.next_retry_at, now), isNull(notificationLog.delivered_at)))
    .all()

  for (const row of due) {
    if (!row.device_token) continue
    const { notification, data } = parsePayload(row.payload_json)
    const device = db
      .select({ id: pushDevices.id })
      .from(pushDevices)
      .where(eq(pushDevices.token, row.device_token))
      .get()
    void deliver({
      userId: row.user_id,
      token: row.device_token,
      kind: row.kind,
      notification,
      data,
      deviceId: device?.id,
      logId: row.id,
      attemptsSoFar: row.attempts + 1,
    }).catch((err) => reportError(`retryDue(${row.kind})`, err))
  }
  return due.length
}
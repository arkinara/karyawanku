/**
 * KaryawanKu — abstraksi provider push (ticket #71).
 *
 * Empat implementasi:
 * - `FcmPushProvider` (produksi): membungkus firebase-admin. Membaca kredensial
 *   dari env (`FIREBASE_SERVICE_ACCOUNT_JSON`) atau file yang dimount
 *   (`FIREBASE_CREDENTIALS_PATH`, default `/var/secrets/karyawanku/firebase.json`,
 *   dengan `FIREBASE_PROJECT_ID`). Bila kredensial tidak ada → throw
 *   `ProviderNotConfigured` (factory-nya memilih fallback log).
 * - `LogPushProvider` (default/testing): selalu sukses, menulis ke console.
 * - `NoopPushProvider` (env `PUSH_PROVIDER=noop`): sama seperti log tapi dengan
 *   banner jelas bahwa pengiriman nonaktif.
 *
 * Pemilihan lewat factory `getPushProvider()` berdasarkan `PUSH_PROVIDER`
 * (`fcm` | `log` | `noop`, default `log`) sehingga server dan test berjalan
 * tanpa Firebase sungguhan. `setPushProviderOverride` untuk injeksi test
 * (mis. mensimulasikan outage provider).
 *
 * Kredensial FCM TIDAK pernah di-commit; server hanya membacanya dari env/path.
 * Default tanpa provider → "log only" agar test aman.
 */
import { readFileSync } from 'node:fs'

export interface PushNotification {
  title: string
  body: string
}

export type PushData = Record<string, unknown>

export interface PushResult {
  ok: boolean
  /** Kode error ternormalisasi: `unregistered` | `invalid_argument` | `transient` | lainnya. */
  error?: string
}

export interface PushProvider {
  send(token: string, notification: PushNotification, data: PushData): Promise<PushResult>
}

/** Dilempar `FcmPushProvider` bila kredensial Firebase tidak dikonfigurasi. */
export class ProviderNotConfigured extends Error {}

interface FirebaseCredentials {
  projectId: string
  json: string
}

function loadCredentials(): FirebaseCredentials | null {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (envJson && envJson.trim() !== '') {
    return { projectId: process.env.FIREBASE_PROJECT_ID ?? '', json: envJson }
  }
  const path = process.env.FIREBASE_CREDENTIALS_PATH ?? '/var/secrets/karyawanku/firebase.json'
  if (process.env.FIREBASE_PROJECT_ID) {
    try {
      return { projectId: process.env.FIREBASE_PROJECT_ID, json: readFileSync(path, 'utf8') }
    } catch {
      return null
    }
  }
  return null
}

/** Normalisasi kode error FCM (messaging/*) ke kategori tindakan push-service. */
export function classifyFcmError(err: unknown): string {
  const raw =
    (err as { errorInfo?: { code?: string } })?.errorInfo?.code ??
    (err as { code?: string })?.code ??
    ''
  const code = String(raw)
  if (code.includes('registration-token-not-registered') || code.includes('UNREGISTERED')) {
    return 'unregistered'
  }
  if (code.includes('invalid-argument') || code.includes('INVALID_ARGUMENT')) {
    return 'invalid_argument'
  }
  if (
    code.includes('server-unavailable') ||
    code.includes('internal-error') ||
    code.includes('device-message-rate-exceeded') ||
    code.includes('quota')
  ) {
    return 'transient'
  }
  return code || 'unknown'
}

/**
 * Implementasi produksi di atas firebase-admin. Kredensial dibaca saat
 * `create()`; bila tidak ada → `ProviderNotConfigured`. firebase-admin dimuat
 * secara dinamis agar module ini tetap ringan bagi test yang memakai log/noop.
 */
type AdminModule = Awaited<ReturnType<typeof loadAdmin>>

export class FcmPushProvider implements PushProvider {
  private messaging: ReturnType<AdminModule['getMessaging']>

  private constructor(messaging: ReturnType<AdminModule['getMessaging']>) {
    this.messaging = messaging
  }

  static async create(): Promise<FcmPushProvider> {
    const creds = loadCredentials()
    if (!creds) {
      throw new ProviderNotConfigured(
        'FCM tidak dikonfigurasi: set FIREBASE_SERVICE_ACCOUNT_JSON atau FIREBASE_PROJECT_ID + FIREBASE_CREDENTIALS_PATH',
      )
    }
    const admin = await loadAdmin()
    const app = creds.projectId
      ? admin.initializeApp({
          credential: admin.cert(JSON.parse(creds.json)),
          projectId: creds.projectId,
        })
      : admin.initializeApp({ credential: admin.cert(JSON.parse(creds.json)) })
    return new FcmPushProvider(admin.getMessaging(app))
  }

  async send(token: string, notification: PushNotification, data: PushData): Promise<PushResult> {
    try {
      // FCM `data` hanya menerima nilai string — serialisasi nilai non-string.
      const fcmData: Record<string, string> = {}
      for (const [k, v] of Object.entries(data)) {
        fcmData[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
      await this.messaging.send({ token, notification, data: fcmData })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: classifyFcmError(err) }
    }
  }
}

async function loadAdmin(): Promise<{
  initializeApp: typeof import('firebase-admin').initializeApp
  cert: typeof import('firebase-admin').credential.cert
  getMessaging: typeof import('firebase-admin/messaging').getMessaging
}> {
  // Dynamic import: hanya dimuat saat provider FCM benar-benar dipakai.
  const appMod = await import('firebase-admin')
  const messagingMod = await import('firebase-admin/messaging')
  return {
    initializeApp: appMod.initializeApp,
    cert: appMod.credential.cert,
    getMessaging: messagingMod.getMessaging,
  }
}

/** Testing: selalu sukses, menulis ringkasan ke console. */
export class LogPushProvider implements PushProvider {
  async send(token: string, notification: PushNotification, data: PushData): Promise<PushResult> {
    console.log(
      `[push:log] ${notification.title} → ${maskToken(token)} · ${JSON.stringify(data)}`,
    )
    return { ok: true }
  }
}

/** Testing/penonaktifan: sama dengan log, dengan banner jelas. */
export class NoopPushProvider implements PushProvider {
  async send(token: string, notification: PushNotification, data: PushData): Promise<PushResult> {
    console.log(
      `[push:noop] PENGIRIMAN NONAKTIF — ${notification.title} → ${maskToken(token)} · ${JSON.stringify(data)}`,
    )
    return { ok: true }
  }
}

function maskToken(token: string): string {
  return token.length <= 8 ? '****' : `${token.slice(0, 4)}…${token.slice(-4)}`
}

let providerOverride: PushProvider | null = null

/** Injeksi test (mis. provider yang melempar untuk simulasi outage). */
export function setPushProviderOverride(provider: PushProvider | null): void {
  providerOverride = provider
}

export async function getPushProvider(): Promise<PushProvider> {
  if (providerOverride) return providerOverride
  const mode = process.env.PUSH_PROVIDER ?? 'log'
  switch (mode) {
    case 'fcm': {
      try {
        return await FcmPushProvider.create()
      } catch (err) {
        if (err instanceof ProviderNotConfigured) {
          console.warn(
            '[push] FCM belum dikonfigurasi (tidak ada kredensial) — fallback ke log-only.',
          )
          return new LogPushProvider()
        }
        throw err
      }
    }
    case 'noop':
      return new NoopPushProvider()
    case 'log':
    default:
      return new LogPushProvider()
  }
}
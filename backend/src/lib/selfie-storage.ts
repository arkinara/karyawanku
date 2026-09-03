/**
 * KaryawanKu — penyimpanan file selfie verifikasi absensi (ticket #69).
 *
 * Gambar disimpan di filesystem `backend/data/selfies/{employee_id}/{attendance_id}.jpg`
 * (di luar SQLite; hanya referensi + ukuran + masa simpan di tabel `selfie_meta`).
 * Lokasi dapat di-override lewat env `SELFIE_DIR` (mutlak atau relatif root repo).
 *
 * Defensif (UU PDP):
 * - Selalu di-resize (max 720 px) + re-encode JPEG q75 saat simpan → ukuran < 2 MB.
 * - EXIF/metadata dilepas (sharp tanpa `withMetadata`), termasuk koordinat GPS.
 * - Tidak pernah menyimpan metadataka wajah / landmark apa pun.
 * - `retention_until` default 90 hari; `purgeSelfiesOlderThan` menghapus yang
 *   sudah lewat batas + file yatim (meta hilang via cascade delete).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, lte } from 'drizzle-orm'
import sharp from 'sharp'
import { getDb } from '../db/index.js'
import { selfieMeta } from '../db/schema.js'

const here = dirname(fileURLToPath(import.meta.url))

/** Masa simpan default selfie (hari). Sinkron dengan copy consent di mobile. */
export const DEFAULT_RETENTION_DAYS = 90

/** Masa simpan selfie dari env `SELFIE_RETENTION_DAYS` (fallback 90 hari). */
export function getSelfieRetentionDays(): number {
  const raw = Number(process.env.SELFIE_RETENTION_DAYS)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS
}

/** Lebar maksimal sisi panjang setelah downscale (px). */
export const MAX_SELFIE_WIDTH = 720

/** Kualitas JPEG output. */
export const SELFIE_JPEG_QUALITY = 75

/** Batas ukuran file setelah diproses (2 MB). */
export const MAX_SELFIE_BYTES = 2 * 1024 * 1024

export function getSelfieDir(): string {
  const raw = process.env.SELFIE_DIR
  if (!raw) {
    const backendDir = resolve(here, '../..')
    const repoRoot = resolve(backendDir, '..')
    return resolve(repoRoot, 'backend/data/selfies')
  }
  if (isAbsolute(raw)) return raw
  const backendDir = resolve(here, '../..')
  const repoRoot = resolve(backendDir, '..')
  const base = raw.startsWith('backend/') || raw === 'backend' ? repoRoot : backendDir
  return resolve(base, raw)
}

/** Path deterministik untuk selfie sebuah record absensi. */
export function selfiePath(employeeId: string, attendanceId: string): string {
  return resolve(getSelfieDir(), employeeId, `${attendanceId}.jpg`)
}

/**
 * Memproses + menyimpan selfie. Rotate otomatis mengikuti EXIF orientation,
 * resize ke max 720 px (tanpa memperbesar), re-encode JPEG q75 — yang juga
 * membuang semua metadata (EXIF/GPS). Mengembalikan path absolut + ukuran byte.
 */
export async function saveSelfie(
  buffer: Buffer,
  employeeId: string,
  attendanceId: string,
): Promise<{ path: string; sizeBytes: number }> {
  const dir = resolve(getSelfieDir(), employeeId)
  mkdirSync(dir, { recursive: true })

  const processed = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_SELFIE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: SELFIE_JPEG_QUALITY })
    .toBuffer()

  if (processed.length > MAX_SELFIE_BYTES) {
    throw new Error(`selfie melebihi batas ukuran setelah diproses (${processed.length} bytes)`)
  }

  const path = resolve(dir, `${attendanceId}.jpg`)
  writeFileSync(path, processed)
  return { path, sizeBytes: processed.length }
}

/** Membaca kembali bytes selfie, atau null bila file tidak ada. */
export function readSelfie(employeeId: string, attendanceId: string): Buffer | null {
  try {
    return readFileSync(selfiePath(employeeId, attendanceId))
  } catch {
    return null
  }
}

/** Menghapus file selfie (best-effort). Untuk pembersihan orphan. */
export function deleteSelfie(employeeId: string, attendanceId: string): void {
  try {
    rmSync(selfiePath(employeeId, attendanceId), { force: true })
  } catch {
    // best-effort — meta tetap dihapus oleh pemanggil.
  }
}

/**
 * Purge retensi: menghapus baris `selfie_meta` yang sudah lewat `retention_until`
 * beserta file-nya, lalu membersihkan file yatim (baris meta sudah hilang via
 * cascade, mis. karyawan/bisnis dihapus) dari direktori. Mengembalikan jumlah
 * baris + file yang dibersihkan. Dipanggil job harian saat server boot.
 */
export function purgeSelfiesOlderThan(days: number): number {
  const { db } = getDb()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const expired = db.select().from(selfieMeta).where(lte(selfieMeta.retention_until, cutoff)).all()
  for (const row of expired) {
    try {
      rmSync(row.path, { force: true })
    } catch {
      // best-effort
    }
    db.delete(selfieMeta).where(eq(selfieMeta.attendance_id, row.attendance_id)).run()
  }

  return expired.length + purgeOrphanFiles()
}

function purgeOrphanFiles(): number {
  const base = getSelfieDir()
  if (!existsSync(base)) return 0
  const { db } = getDb()
  const known = new Set(db.select({ path: selfieMeta.path }).from(selfieMeta).all().map((r) => r.path))

  let removed = 0
  for (const entry of readdirSync(base)) {
    const full = join(base, entry)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    for (const file of readdirSync(full)) {
      const p = resolve(full, file)
      if (known.has(p)) continue
      try {
        rmSync(p, { force: true })
        removed++
      } catch {
        // best-effort
      }
    }
  }
  return removed
}
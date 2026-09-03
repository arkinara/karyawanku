import type { FastifyInstance, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { attendanceRecords, employees, selfieMeta } from '../db/schema.js'
import { currentUser, requireAuth, requireOwner } from '../lib/auth.js'
import { recordAudit } from '../lib/audit.js'
import { ApiError, ForbiddenError } from '../lib/errors.js'
import { hasCapability } from '../lib/capabilities.js'
import {
  deleteSelfie,
  getSelfieRetentionDays,
  readSelfie,
  saveSelfie,
} from '../lib/selfie-storage.js'

const MAX_SELFIE_UPLOAD_BYTES = 2 * 1024 * 1024
const ALLOWED_SELFIE_MIMETYPES = new Set(['image/jpeg', 'image/png'])

/** Record absensi + employee yang harus ada dan berada dalam bisnis user. */
function resolveSelfieRecord(attendanceId: string, businessId: string) {
  const { db } = getDb()
  const record = db
    .select({ record: attendanceRecords, employee: employees })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employee_id, employees.id))
    .where(eq(attendanceRecords.id, attendanceId))
    .get()
  if (!record || record.employee.business_id !== businessId) {
    throw new ApiError(404, 'Catatan absensi tidak ditemukan')
  }
  return record
}

/**
 * Otorisasi selfie per record. Owner/manager (attendance.manage) boleh semua
 * record dalam bisnisnya; employee hanya untuk record miliknya sendiri (403
 * bila mencoba mengakses milik orang lain).
 */
function assertSelfieAccess(req: FastifyRequest, record: { employee_id: string }): void {
  const user = currentUser(req)
  if (user.role === 'owner' || hasCapability(user.role, 'attendance.manage')) return
  if (user.employee_id !== record.employee_id) {
    throw new ForbiddenError('Anda hanya dapat mengakses selfie absensi Anda sendiri.')
  }
}

async function readImageUpload(req: FastifyRequest): Promise<Buffer> {
  const file = await req.file()
  if (!file) throw new ApiError(422, 'File selfie wajib diunggah')

  if (!file.mimetype || !ALLOWED_SELFIE_MIMETYPES.has(file.mimetype)) {
    throw new ApiError(415, 'File harus berupa gambar (JPG atau PNG)')
  }

  const chunks: Buffer[] = []
  let total = 0
  try {
    for await (const chunk of file.file) {
      const buf = chunk as Buffer
      total += buf.length
      if (total > MAX_SELFIE_UPLOAD_BYTES) {
        throw new ApiError(413, 'Ukuran foto maksimal 2 MB')
      }
      chunks.push(buf)
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    // Busboy membuang FST_REQ_FILE_TOO_LARGE saat file melampaui limits.fileSize
    // (10 MB global) sebelum handler sempat menghitung — samakan jadi 413.
    throw new ApiError(413, 'Ukuran foto maksimal 2 MB')
  }
  return Buffer.concat(chunks)
}

export default async function selfiesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Upload selfie verifikasi untuk sebuah record absensi. Owner/manager boleh
   * mengunggah untuk karyawan mana pun dalam bisnisnya; employee hanya untuk
   * record miliknya. Idempoten: satu selfie per record — upload kedua menimpa
   * file lama dan mengeset retention_until baru (90 hari).
   */
  app.post('/attendance/:id/selfie', { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { record, employee } = resolveSelfieRecord(id, user.business_id)
    assertSelfieAccess(req, record)

    const buffer = await readImageUpload(req)
    if (buffer.length === 0) {
      throw new ApiError(422, 'File selfie kosong')
    }

    let saved: { path: string; sizeBytes: number }
    try {
      saved = await saveSelfie(buffer, employee.id, record.id)
    } catch (err) {
      if (err instanceof ApiError) throw err
      throw new ApiError(422, 'File bukan gambar yang valid')
    }

    const uploadedAt = new Date()
    const retentionDays = getSelfieRetentionDays()
    const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)

    const { db } = getDb()
    db.insert(selfieMeta)
      .values({
        attendance_id: record.id,
        path: saved.path,
        mime_type: 'image/jpeg',
        size_bytes: saved.sizeBytes,
        uploaded_at: uploadedAt,
        retention_until: retentionUntil,
      })
      .onConflictDoUpdate({
        target: selfieMeta.attendance_id,
        set: {
          path: saved.path,
          mime_type: 'image/jpeg',
          size_bytes: saved.sizeBytes,
          uploaded_at: uploadedAt,
          retention_until: retentionUntil,
        },
      })
      .run()

    return reply.code(201).send({
      url: `/api/attendance/${record.id}/selfie`,
      size_bytes: saved.sizeBytes,
      retention_until: retentionUntil.toISOString(),
    })
  })

  /**
   * Mengambil bytes selfie sebuah record. Owner/manager melihat semua record
   * bisnisnya; employee hanya miliknya. 404 bila belum diunggah, 410 bila sudah
   * melewati masa simpan (`retention_until`).
   */
  app.get('/attendance/:id/selfie', { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { record, employee } = resolveSelfieRecord(id, user.business_id)
    assertSelfieAccess(req, record)

    const { db } = getDb()
    const row = db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, record.id)).get()
    if (!row) throw new ApiError(404, 'Selfie belum diunggah')
    if (row.retention_until.getTime() < Date.now()) {
      throw new ApiError(410, 'Selfie sudah melewati masa penyimpanan')
    }

    const buffer = readSelfie(employee.id, record.id)
    if (!buffer) throw new ApiError(404, 'File selfie tidak ditemukan')

    reply.header('Content-Type', row.mime_type)
    reply.header('Cache-Control', 'private, max-age=300')
    return reply.send(buffer)
  })

  /**
   * Menghapus selfie sebuah record — hanya owner. Selalu dicatat ke audit log
   * (`attendance.selfie.delete`) di transaksi yang sama dengan penghapusan meta.
   */
  app.delete('/attendance/:id/selfie', { preHandler: requireOwner }, async (req) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { record, employee } = resolveSelfieRecord(id, user.business_id)

    const { db } = getDb()
    const row = db.select().from(selfieMeta).where(eq(selfieMeta.attendance_id, record.id)).get()

    if (row) {
      deleteSelfie(employee.id, record.id)
      db.transaction((tx) => {
        tx.delete(selfieMeta).where(eq(selfieMeta.attendance_id, record.id)).run()
        recordAudit({
          db: tx,
          businessId: user.business_id,
          actorUserId: user.id,
          action: 'attendance.selfie.delete',
          entityType: 'attendance_record',
          entityId: record.id,
          before: { path: row.path, mime_type: row.mime_type, size_bytes: row.size_bytes },
          after: { deleted: true },
        })
      })
    }

    return { deleted: true }
  })
}
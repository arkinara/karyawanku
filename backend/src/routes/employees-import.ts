import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { employees, type NewEmployee } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'
import { parseCsv } from '../lib/csv.js'
import { createEmployeeSchema, suggestMapping, type EmployeeFormValues } from '../lib/employee-validation.js'

const MAX_CSV_BYTES = 5 * 1024 * 1024
const ALLOWED_MIMETYPES = new Set(['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'])

const importCommitSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  columnMapping: z.record(z.string(), z.string()).optional(),
})

export default async function employeesImportRoutes(app: FastifyInstance): Promise<void> {
  app.post('/employees/import/preview', { preHandler: requireOwner }, async (req) => {
    const upload = await readUpload(req)
    if (!upload) {
      throw new ApiError(422, 'File CSV wajib diunggah')
    }
    if (upload.size > MAX_CSV_BYTES) {
      throw new ApiError(422, 'Ukuran file maksimal 5 MB')
    }
    if (upload.mimetype && !ALLOWED_MIMETYPES.has(upload.mimetype)) {
      throw new ApiError(422, 'File yang diunggah bukan CSV')
    }

    const parsed = parseCsv(upload.text)
    if (parsed.length === 0) {
      throw new ApiError(422, 'File CSV tidak memiliki data')
    }

    const detectedHeaders = parsed[0]
    const rows = parsed.slice(1)
    const suggestedMapping = suggestMapping(detectedHeaders)
    const requiredMapped = ['no_ktp', 'nama_lengkap'].every((f) => Object.values(suggestedMapping).includes(f))

    return { rows, detectedHeaders, suggestedMapping, totalRows: rows.length, requiredMapped }
  })

  app.post('/employees/import/commit', { preHandler: requireOwner }, async (req) => {
    const parsed = importCommitSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data impor tidak valid', parsed.error.flatten())
    }
    const { rows } = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const existingNoKtps = new Set(
      db
        .select({ k: employees.no_ktp })
        .from(employees)
        .where(eq(employees.business_id, user.business_id))
        .all()
        .map((r) => r.k),
    )

    const seenInFile = new Set<string>()
    const errors: Array<{ rowIndex: number; errors: string[] }> = []
    const validRows: Array<{ data: z.infer<typeof createEmployeeSchema> }> = []

    rows.forEach((raw, i) => {
      const rowIndex = i + 2
      const row = normalizeRow(raw)
      const check = createEmployeeSchema.safeParse(row)

      if (!check.success) {
        const messages = Array.from(new Set(check.error.issues.map((issue) => issue.message)))
        if (row.no_ktp && seenInFile.has(row.no_ktp)) {
          messages.push('No KTP duplikat dalam file')
        } else if (row.no_ktp) {
          seenInFile.add(row.no_ktp)
        }
        errors.push({ rowIndex, errors: messages })
        return
      }

      const data = check.data
      if (existingNoKtps.has(data.no_ktp) || seenInFile.has(data.no_ktp)) {
        errors.push({ rowIndex, errors: ['No KTP sudah terdaftar (duplikat)'] })
        return
      }
      seenInFile.add(data.no_ktp)
      validRows.push({ data })
    })

    let created = 0
    if (validRows.length > 0) {
      db.transaction((tx) => {
        for (const { data } of validRows) {
          const values: NewEmployee = {
            business_id: user.business_id,
            nama_lengkap: data.nama_lengkap,
            no_ktp: data.no_ktp,
            npwp: data.npwp ?? null,
            tanggal_lahir: data.tanggal_lahir,
            jenis_kelamin: data.jenis_kelamin,
            alamat: data.alamat ?? null,
            kontak_darurat: data.kontak_darurat ?? null,
            tanggal_masuk: data.tanggal_masuk,
            jenis_kontrak: data.jenis_kontrak,
            status: data.status ?? 'aktif',
            custom_fields: data.custom_fields != null ? JSON.stringify(data.custom_fields) : null,
          }
          tx.insert(employees).values(values).run()
          created++
        }
      })
    }

    return { created, skipped: rows.length - created, errors }
  })
}

async function readUpload(req: FastifyRequest): Promise<{ filename: string; mimetype: string; size: number; text: string } | null> {
  const file = await req.file()
  if (!file) return null
  const chunks: Buffer[] = []
  for await (const chunk of file.file) {
    chunks.push(chunk as Buffer)
  }
  const buffer = Buffer.concat(chunks)
  return {
    filename: file.filename,
    mimetype: file.mimetype ?? '',
    size: buffer.length,
    text: buffer.toString('utf8'),
  }
}

function normalizeRow(row: EmployeeFormValues): EmployeeFormValues {
  const out: EmployeeFormValues = { ...row }
  for (const key of ['nama_lengkap', 'no_ktp', 'npwp', 'tanggal_lahir', 'alamat', 'kontak_darurat', 'tanggal_masuk'] as const) {
    const value = out[key]
    if (typeof value === 'string' && value.trim() === '') {
      out[key] = undefined
    }
  }
  return out
}

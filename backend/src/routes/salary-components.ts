import type { FastifyInstance } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { salaryComponents } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'
import { evaluate, validateFormula } from '../lib/formula.js'

const namaSchema = z.string().min(1, 'Nama komponen wajib diisi').max(100, 'Nama komponen maksimal 100 karakter')
const tipeSchema = z.enum(['earning', 'deduction'], { message: 'Tipe harus earning atau deduction' })
const nominalSchema = z.union([
  z.number().positive('Nominal harus bilangan positif'),
  z.null(),
])
const formulaSchema = z.union([
  z.string().trim().max(200, 'Formula maksimal 200 karakter'),
  z.null(),
])
const aktifSchema = z.boolean()

const createSchema = z
  .object({
    nama_komponen: namaSchema,
    tipe: tipeSchema,
    nominal: nominalSchema.optional(),
    formula: formulaSchema.optional(),
    aktif: aktifSchema.optional(),
  })
  .refine((d) => d.nominal != null || d.formula != null, {
    message: 'Wajib mengisi nominal atau formula',
  })

const updateSchema = z
  .object({
    nama_komponen: namaSchema.optional(),
    tipe: tipeSchema.optional(),
    nominal: nominalSchema.optional(),
    formula: formulaSchema.optional(),
    aktif: aktifSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

const previewSchema = z.object({
  formula: z.string().trim().min(1, 'Formula wajib diisi').max(200, 'Formula maksimal 200 karakter'),
  variables: z.record(z.string(), z.number()).default({}),
})

export default async function salaryComponentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireOwner)

  app.post('/salary-components/preview-formula', async (req) => {
    const parsed = previewSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data formula tidak valid', parsed.error.flatten())
    }
    const { formula, variables } = parsed.data
    const res = evaluate(formula, variables)
    if (res.error) {
      throw new ApiError(400, res.error)
    }
    return { result: res.result }
  })

  app.get('/salary-components', async (req) => {
    const q = req.query as Record<string, unknown>
    const user = currentUser(req)
    const { db } = getDb()

    const filters = [eq(salaryComponents.business_id, user.business_id)]
    if (q.active === 'true') filters.push(eq(salaryComponents.aktif, true))

    const rows = db
      .select()
      .from(salaryComponents)
      .where(and(...filters))
      .orderBy(asc(salaryComponents.nama_komponen))
      .all()

    return { components: rows }
  })

  app.post('/salary-components', async (req) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data komponen tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)

    const formulaError = data.formula ? validateFormula(data.formula) : null
    if (formulaError) {
      throw new ApiError(422, formulaError)
    }

    const { db } = getDb()
    const component = db
      .insert(salaryComponents)
      .values({
        business_id: user.business_id,
        nama_komponen: data.nama_komponen,
        tipe: data.tipe,
        nominal: data.nominal ?? null,
        formula: data.formula ?? null,
        aktif: data.aktif ?? true,
      })
      .returning()
      .get()

    return { component }
  })

  app.patch('/salary-components/:id', async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data komponen tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(salaryComponents)
      .where(and(eq(salaryComponents.id, id), eq(salaryComponents.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Komponen tidak ditemukan')
    }

    const nominal = data.nominal !== undefined ? data.nominal : target.nominal
    const formula = data.formula !== undefined ? data.formula : target.formula
    if (nominal == null && formula == null) {
      throw new ApiError(422, 'Komponen wajib memiliki nominal atau formula')
    }
    if (data.formula !== undefined && data.formula) {
      const formulaError = validateFormula(data.formula)
      if (formulaError) {
        throw new ApiError(422, formulaError)
      }
    }

    const patch: Record<string, unknown> = {}
    if (data.nama_komponen !== undefined) patch.nama_komponen = data.nama_komponen
    if (data.tipe !== undefined) patch.tipe = data.tipe
    if (data.nominal !== undefined) patch.nominal = data.nominal
    if (data.formula !== undefined) patch.formula = data.formula
    if (data.aktif !== undefined) patch.aktif = data.aktif

    const updated = db.update(salaryComponents).set(patch).where(eq(salaryComponents.id, id)).returning().get()
    return { component: updated }
  })

  app.delete('/salary-components/:id', async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(salaryComponents)
      .where(and(eq(salaryComponents.id, id), eq(salaryComponents.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Komponen tidak ditemukan')
    }

    db.update(salaryComponents).set({ aktif: false }).where(eq(salaryComponents.id, id)).run()
    return { ok: true }
  })
}

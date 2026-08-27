import type { FastifyInstance } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { salaryComponents } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ForbiddenError, ValidationError } from '../lib/errors.js'
import { validateFormula } from '../lib/formula.js'

const componentIdsSchema = z.object({
  component_ids: z.array(z.string().min(1, 'ID komponen wajib diisi')).min(1, 'Minimal satu komponen'),
})

const componentsBodySchema = z.object({
  components: z
    .array(
      z
        .object({
          nama_komponen: z
            .string()
            .min(1, 'Nama komponen wajib diisi')
            .max(100, 'Nama komponen maksimal 100 karakter'),
          tipe: z.enum(['earning', 'deduction'], { message: 'Tipe harus earning atau deduction' }),
          nominal: z.union([z.number().positive('Nominal harus bilangan positif'), z.null()]).optional(),
          formula: z.union([z.string().trim().max(200, 'Formula maksimal 200 karakter'), z.null()]).optional(),
          aktif: z.boolean().optional(),
        })
        .refine((d) => d.nominal != null || d.formula != null, {
          message: 'Wajib mengisi nominal atau formula',
        }),
    )
    .min(1, 'Minimal satu komponen'),
})

function assertBusinessScope(businessId: string, owner: { business_id: string }): void {
  if (owner.business_id !== businessId) {
    throw new ForbiddenError('Anda tidak memiliki izin untuk mengakses bisnis ini.')
  }
}

async function fetchDefaults(db: ReturnType<typeof getDb>['db'], businessId: string) {
  return db
    .select()
    .from(salaryComponents)
    .where(and(eq(salaryComponents.business_id, businessId), eq(salaryComponents.is_default, true)))
    .orderBy(asc(salaryComponents.nama_komponen))
    .all()
}

export default async function businessDefaultComponentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireOwner)

  app.get('/businesses/:id/default-salary-components', async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    assertBusinessScope(id, user)

    const { db } = getDb()
    const components = await fetchDefaults(db, id)
    return { components }
  })

  app.put('/businesses/:id/default-salary-components', async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    assertBusinessScope(id, user)

    const { db } = getDb()

    const idsSchema = componentIdsSchema.safeParse(req.body)
    const bodiesSchema = componentsBodySchema.safeParse(req.body)
    const componentIds = idsSchema.success ? idsSchema.data.component_ids : undefined
    const componentsToCreate = bodiesSchema.success ? bodiesSchema.data.components : undefined

    if (!componentIds && !componentsToCreate) {
      throw new ValidationError(
        'Data komponen default tidak valid',
        idsSchema.success ? undefined : idsSchema.error.flatten(),
      )
    }

    const selectedIds: string[] = []
    const createdIds: string[] = []

    db.transaction((tx) => {
      if (componentIds) {
        const missing = componentIds.filter((cid) => {
          const row = tx
            .select()
            .from(salaryComponents)
            .where(and(eq(salaryComponents.id, cid), eq(salaryComponents.business_id, id)))
            .get()
          return !row
        })
        if (missing.length > 0) {
          throw new ValidationError('Beberapa komponen tidak ditemukan dalam bisnis ini')
        }
        selectedIds.push(...componentIds)
      }

      if (componentsToCreate) {
        for (const c of componentsToCreate) {
          const formulaError = c.formula ? validateFormula(c.formula) : null
          if (formulaError) {
            throw new ValidationError(formulaError)
          }
          const created = tx
            .insert(salaryComponents)
            .values({
              business_id: id,
              nama_komponen: c.nama_komponen,
              tipe: c.tipe,
              nominal: c.nominal ?? null,
              formula: c.formula ?? null,
              aktif: c.aktif ?? true,
            })
            .returning()
            .get()
          createdIds.push(created.id)
        }
        selectedIds.push(...createdIds)
      }

      tx.update(salaryComponents).set({ is_default: false }).where(eq(salaryComponents.business_id, id)).run()

      for (const cid of selectedIds) {
        tx.update(salaryComponents)
          .set({ is_default: true })
          .where(and(eq(salaryComponents.id, cid), eq(salaryComponents.business_id, id)))
          .run()
      }
    })

    const components = await fetchDefaults(db, id)
    return { components }
  })
}
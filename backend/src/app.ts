import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { ZodError } from 'zod'
import { getDb } from './db/index.js'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import employeesRoutes from './routes/employees.js'
import employeesImportRoutes from './routes/employees-import.js'
import { ApiError } from './lib/errors.js'

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false })

  app.register(cors, { origin: true })
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 + 1024 } })

  app.register(
    async (api) => {
      await api.register(authRoutes)
      await api.register(usersRoutes)
      await api.register(employeesImportRoutes)
      await api.register(employeesRoutes)
    },
    { prefix: '/api' },
  )

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      reply.code(err.statusCode).send({ error: { message: err.message, details: err.details } })
      return
    }
    if (err instanceof ZodError) {
      reply.code(400).send({ error: { message: 'Data tidak valid', details: err.flatten() } })
      return
    }
    const e = err as { statusCode?: unknown; message?: string }
    const status = typeof e.statusCode === 'number' ? e.statusCode : 500
    if (status >= 500) {
      req.log.error(err)
    }
    const message = status >= 500 ? 'Terjadi kesalahan pada server' : (e.message ?? 'Terjadi kesalahan')
    reply.code(status).send({ error: { message } })
  })

  return app
}

export async function start(port = Number(process.env.PORT ?? 3001)): Promise<FastifyInstance> {
  getDb()
  const app = buildApp()

  app.addHook('onResponse', (req, reply, done) => {
    const { method, url } = req
    const status = reply.statusCode
    const duration = reply.elapsedTime.toFixed(2)
    console.log(`${method} ${url} ${status} ${duration}ms`)
    done()
  })

  await app.listen({ port, host: '0.0.0.0' })
  console.log(`[karyawanku] API berjalan di http://localhost:${port}`)
  return app
}

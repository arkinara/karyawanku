import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { getDb } from './db/index.js'
import authRoutes from './routes/auth.js'
import passwordResetRoutes from './routes/password-reset.js'
import businessesRoutes from './routes/businesses.js'
import businessDefaultComponentsRoutes from './routes/business-default-components.js'
import usersRoutes from './routes/users.js'
import employeesRoutes from './routes/employees.js'
import employeesImportRoutes from './routes/employees-import.js'
import salaryComponentsRoutes from './routes/salary-components.js'
import salaryAssignmentsRoutes from './routes/salary-assignments.js'
import attendanceRoutes from './routes/attendance.js'
import selfiesRoutes from './routes/selfies.js'
import leaveTypesRoutes from './routes/leave-types.js'
import leaveBalancesRoutes from './routes/leave-balances.js'
import leaveRequestsRoutes from './routes/leave-requests.js'
import shiftsRoutes from './routes/shifts.js'
import shiftAssignmentsRoutes from './routes/shift-assignments.js'
import rosterPublishRoutes from './routes/roster-publish.js'
import payrollRunsRoutes from './routes/payroll-runs.js'
import payslipsRoutes from './routes/payslips.js'
import payrollExportRoutes from './routes/payroll-export.js'
import thrRoutes from './routes/thr.js'
import dashboardRoutes from './routes/dashboard.js'
import auditLogsRoutes from './routes/audit-logs.js'
import { ApiError, RateLimitError } from './lib/errors.js'
import { assertJwtSecretValid } from './lib/auth.js'

const DEFAULT_JSON_LIMIT = 1024 * 1024 // 1 MB
const DEFAULT_MULTIPART_LIMIT = 10 * 1024 * 1024 // 10 MB
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:3000'

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function parseOrigins(raw?: string): string[] {
  return (raw === undefined || raw.trim() === '' ? DEFAULT_ALLOWED_ORIGINS : raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildApp(): FastifyInstance {
  const jsonBodyLimit = envNumber('BODY_JSON_LIMIT', DEFAULT_JSON_LIMIT)
  const multipartBodyLimit = envNumber('BODY_MULTIPART_LIMIT', DEFAULT_MULTIPART_LIMIT)
  const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS)

  const signInRateLimit = {
    max: envNumber('RATE_LIMIT_SIGNIN_MAX', 5),
    timeWindow: envNumber('RATE_LIMIT_SIGNIN_WINDOW_MS', 60_000),
  }
  const signUpRateLimit = {
    max: envNumber('RATE_LIMIT_SIGNUP_MAX', 3),
    timeWindow: envNumber('RATE_LIMIT_SIGNUP_WINDOW_MS', 60_000),
  }

  const app = Fastify({ logger: false, bodyLimit: jsonBodyLimit })

  app.register(helmet, {
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
  })

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        // Request non-browser (curl, server-to-server) — tidak perlu header CORS.
        cb(null, true)
        return
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, true)
        return
      }
      cb(new ApiError(403, 'Asal (origin) tidak diizinkan.'), false)
    },
  })

  app.register(multipart, { limits: { fileSize: multipartBodyLimit } })

  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, _context) => new RateLimitError('Terlalu banyak permintaan. Silakan coba lagi nanti.'),
  })

  app.register(
    async (api) => {
      await api.register(authRoutes, { rateLimit: { signIn: signInRateLimit, signUp: signUpRateLimit } })
      await api.register(passwordResetRoutes)
      await api.register(businessesRoutes)
      await api.register(businessDefaultComponentsRoutes)
      await api.register(usersRoutes)
      await api.register(employeesImportRoutes)
      await api.register(employeesRoutes)
      await api.register(salaryComponentsRoutes)
      await api.register(salaryAssignmentsRoutes)
      await api.register(attendanceRoutes)
      await api.register(selfiesRoutes)
      await api.register(leaveTypesRoutes)
      await api.register(leaveBalancesRoutes)
      await api.register(leaveRequestsRoutes)
      await api.register(shiftsRoutes)
      await api.register(shiftAssignmentsRoutes)
      await api.register(rosterPublishRoutes)
      await api.register(payrollRunsRoutes)
      await api.register(payslipsRoutes)
      await api.register(payrollExportRoutes)
      await api.register(thrRoutes)
      await api.register(dashboardRoutes)
      await api.register(auditLogsRoutes)
    },
    { prefix: '/api' },
  )

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof RateLimitError) {
      reply.code(429).send({ error: 'rate_limited', message: err.message })
      return
    }
    if (err instanceof ApiError) {
      reply.code(err.statusCode).send({ error: { message: err.message, details: err.details } })
      return
    }
    if (err instanceof ZodError) {
      reply.code(400).send({ error: { message: 'Data tidak valid', details: err.flatten() } })
      return
    }
    if ((err as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      reply.code(413).send({ error: { message: 'Ukuran badan permintaan melebihi batas' } })
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

/**
 * Memastikan skema database sudah diterapkan sebelum melayani request.
 * Produksi: gagal cepat (fail-fast). Non-produksi: peringatan.
 */
function assertSchemaCurrent(): void {
  const { sqlite } = getDb()
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_logs'")
    .get()
  if (row) return
  const msg = '[karyawanku] skema database belum dimigrasi. Jalankan `npm run db:migrate` lalu mulai ulang server.'
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg)
  }
  console.warn(msg)
}

export async function start(port = Number(process.env.PORT ?? 3001)): Promise<FastifyInstance> {
  assertJwtSecretValid()
  getDb()
  assertSchemaCurrent()
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
import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? 'backend/data/karyawanku.db'
  if (raw === ':memory:') return raw
  if (isAbsolute(raw)) return raw
  const backendDir = here
  const repoRoot = resolve(backendDir, '..')
  const base = raw.startsWith('backend/') || raw === 'backend' ? repoRoot : backendDir
  return resolve(base, raw)
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDbPath(),
  },
  strict: true,
  verbose: true,
})

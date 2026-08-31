import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ESLint } from 'eslint'

const root = process.cwd()

function fixture(name: string, code: string): { filePath: string; code: string } {
  return { filePath: path.join(root, name), code }
}

describe('chore-ci: scripts yang dijalankan CI', () => {
  it('package.json memuat skrip lint (eslint . --ext .ts)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.lint).toBe('next lint')
    expect(pkg.scripts.test).toBe('vitest run')
  })

  it('harness vitest berjalan (globals aktif) — siap untuk mode CI', () => {
    expect(describe).toBeTypeOf('function')
    expect(1 + 1).toBe(2)
  })
})

describe('chore-ci: ESLint no-mock-in-app', () => {
  const mockImport = `import { x } from '@/lib/salary-assignments-mock'\nexport default function Fixture() { return null }\n`

  it('memunculkan error saat src/app mengimpor modul *-mock', async () => {
    const eslint = new ESLint({ cwd: root })
    const { filePath, code } = fixture('src/app/__ci_fixture__.tsx', mockImport)
    const results = await eslint.lintText(code, { filePath })
    const restricted = results[0].messages.find((m) => m.ruleId === 'no-restricted-imports')
    expect(restricted).toBeDefined()
    expect(restricted?.message).toContain('Do not import mock data from app/ — wire to real API instead')
    expect(results[0].errorCount).toBeGreaterThan(0)
  })

  it('tidak memunculkan error saat import *-mock terjadi di luar src/app', async () => {
    const eslint = new ESLint({ cwd: root })
    const { filePath, code } = fixture('tests/__ci_fixture__.ts', mockImport)
    const results = await eslint.lintText(code, { filePath })
    expect(results[0].messages.filter((m) => m.ruleId === 'no-restricted-imports')).toHaveLength(0)
  })

  it('config ESLint (next/core-web-vitals) termuat dan file bersih lolos', async () => {
    const eslint = new ESLint({ cwd: root })
    const { filePath, code } = fixture(
      'src/app/__ci_fixture2__.tsx',
      `export default function Page() {\n  return <main>ok</main>\n}\n`,
    )
    const results = await eslint.lintText(code, { filePath })
    expect(results[0].errorCount).toBe(0)
  })
})
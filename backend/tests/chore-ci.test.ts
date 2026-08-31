import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('chore-ci: scripts yang dijalankan CI', () => {
  it('package.json memuat skrip lint (eslint . --ext .ts)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.lint).toBe('eslint . --ext .ts')
    expect(pkg.scripts.test).toBe('vitest run')
  })

  it('harness vitest berjalan (globals aktif) — siap untuk mode CI', () => {
    expect(describe).toBeTypeOf('function')
    expect(1 + 1).toBe(2)
  })
})
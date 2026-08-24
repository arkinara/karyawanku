/**
 * KaryawanKu — penyimpanan file PDF slip gaji di filesystem (ticket #31).
 *
 * PDF disimpan di `backend/data/payslips/{payslip_id}.pdf` secara default.
 * Lokasi dapat di-override lewat env `PAYSLIP_DIR` (mutlak atau relatif ke root repo).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export function getPayslipDir(): string {
  const raw = process.env.PAYSLIP_DIR
  if (!raw) {
    const backendDir = resolve(here, '../..')
    const repoRoot = resolve(backendDir, '..')
    return resolve(repoRoot, 'backend/data/payslips')
  }
  if (isAbsolute(raw)) return raw
  const backendDir = resolve(here, '../..')
  const repoRoot = resolve(backendDir, '..')
  const base = raw.startsWith('backend/') || raw === 'backend' ? repoRoot : backendDir
  return resolve(base, raw)
}

export function writePayslipFile(payslipId: string, buffer: Buffer): string {
  const dir = getPayslipDir()
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `${payslipId}.pdf`)
  writeFileSync(path, buffer)
  return path
}

export function readPayslipFile(payslipId: string): Buffer | null {
  const path = resolve(getPayslipDir(), `${payslipId}.pdf`)
  try {
    return readFileSync(path)
  } catch {
    return null
  }
}

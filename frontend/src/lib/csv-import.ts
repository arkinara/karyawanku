/**
 * KaryawanKu — CSV import domain logic (ticket #7).
 *
 * Pure functions only (no React), so validation + mapping can be unit-tested
 * without rendering the wizard: employee field list, auto-mapping heuristic,
 * per-row validation, duplicate-KTP detection, and the template generator.
 */

import type { ParsedCsv } from './csv'

export const EMPLOYEE_FIELDS = [
  'nama_lengkap',
  'no_ktp',
  'npwp',
  'jenis_kontrak',
  'tanggal_masuk',
  'tanggal_lahir',
  'alamat',
  'kontak_darurat',
] as const

export type EmployeeField = (typeof EMPLOYEE_FIELDS)[number]

export const FIELD_LABELS: Record<EmployeeField, string> = {
  nama_lengkap: 'Nama Lengkap',
  no_ktp: 'Nomor KTP',
  npwp: 'NPWP',
  jenis_kontrak: 'Jenis Kontrak',
  tanggal_masuk: 'Tanggal Masuk',
  tanggal_lahir: 'Tanggal Lahir',
  alamat: 'Alamat',
  kontak_darurat: 'Kontak Darurat',
}

/** The import is meaningless without these two mapped. */
export const REQUIRED_FIELDS: EmployeeField[] = ['nama_lengkap', 'no_ktp']

export const KONTRAK_OPTIONS = ['PKWTT', 'PKWT', 'PKL', 'Magang', 'Harian'] as const

export const MAX_FILE_SIZE = 5 * 1024 * 1024

export const TEMPLATE_FILENAME = 'template-import-karyawan.csv'

/** Per-CSV-column mapping: column index → employee field, or `'ignore'`. */
export type Mapping = Record<number, EmployeeField | 'ignore'>

export interface MappedRow {
  /** 1-based line number in the file; header = row 1, first data row = 2. */
  rowNumber: number
  values: Record<EmployeeField, string>
  errors: string[]
  valid: boolean
}

/** `"Nama Lengkap"` / `"nama_lengkap"` → `"namalengkap"` (case + punctuation). */
const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '')

/** Auto-mapping heuristic: exact field name match wins, else the column is ignored. */
export function suggestField(header: string): EmployeeField | 'ignore' {
  const key = normalizeKey(header)
  const match = EMPLOYEE_FIELDS.find((f) => normalizeKey(f) === key)
  return match ?? 'ignore'
}

export function autoMapping(headers: string[]): Mapping {
  const mapping: Mapping = {}
  headers.forEach((header, i) => {
    mapping[i] = suggestField(header)
  })
  return mapping
}

const NPWP_REGEX = /^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/

/** `[y, m, d]` for ISO `YYYY-MM-DD` or Indonesian `DD/MM/YYYY` / `DD-MM-YYYY`. */
function dateParts(value: string): [number, number, number] | null {
  const t = value.trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return [+iso[1], +iso[2], +iso[3]]
  const local = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (local) return [+local[3], +local[2], +local[1]]
  return null
}

function isValidDate(value: string): boolean {
  const parts = dateParts(value)
  if (!parts) return false
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** True when `value` (already a valid date) is after today, end-of-day. */
function isFutureDate(value: string): boolean {
  const parts = dateParts(value)!
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date.getTime() > today.getTime()
}

/** Per-row validation — Bahasa Indonesia reasons surfaced in the preview chips. */
export function validateRow(values: Record<EmployeeField, string>): string[] {
  const errors: string[] = []

  if (!values.nama_lengkap) errors.push('Nama kosong')
  else if (values.nama_lengkap.length < 3) errors.push('Nama minimal 3 karakter')

  if (!values.no_ktp) errors.push('KTP kosong')
  else if (!/^\d{16}$/.test(values.no_ktp)) errors.push('Format KTP salah (16 digit)')

  if (values.npwp && !NPWP_REGEX.test(values.npwp)) errors.push('Format NPWP salah')

  if (!values.jenis_kontrak) errors.push('Jenis kontrak kosong')
  else if (!(KONTRAK_OPTIONS as readonly string[]).includes(values.jenis_kontrak))
    errors.push('Jenis kontrak tidak valid')

  if (!values.tanggal_masuk) errors.push('Tanggal masuk kosong')
  else if (!isValidDate(values.tanggal_masuk)) errors.push('Tanggal masuk tidak valid')
  else if (isFutureDate(values.tanggal_masuk)) errors.push('Tanggal masuk di masa depan')

  return errors
}

/**
 * Apply a `Mapping` to the parsed rows and validate each one. Duplicate KTPs
 * are resolved across the whole file: the first occurrence stays valid, later
 * ones are flagged with the first row number (`"KTP duplikat baris 2"`).
 */
export function mapRows(parsed: ParsedCsv, mapping: Mapping): MappedRow[] {
  const rows: MappedRow[] = parsed.rows.map((cells, i) => {
    const values = Object.fromEntries(EMPLOYEE_FIELDS.map((f) => [f, ''])) as Record<
      EmployeeField,
      string
    >
    parsed.headers.forEach((_, ci) => {
      const target = mapping[ci]
      if (target && target !== 'ignore') values[target] = (cells[ci] ?? '').trim()
    })
    return { rowNumber: i + 2, values, errors: [], valid: false }
  })

  const counts = new Map<string, number>()
  for (const r of rows) {
    if (/^\d{16}$/.test(r.values.no_ktp)) {
      counts.set(r.values.no_ktp, (counts.get(r.values.no_ktp) ?? 0) + 1)
    }
  }

  const firstRowOf = new Map<string, number>()
  for (const r of rows) {
    const errors = validateRow(r.values)
    const ktp = r.values.no_ktp
    if ((counts.get(ktp) ?? 0) > 1) {
      if (!firstRowOf.has(ktp)) firstRowOf.set(ktp, r.rowNumber)
      else errors.push(`KTP duplikat baris ${firstRowOf.get(ktp)}`)
    }
    r.errors = errors
    r.valid = errors.length === 0
  }

  return rows
}

/** Downloadable template matching the import fields. */
export function buildTemplateCsv(): string {
  const header = EMPLOYEE_FIELDS.join(',')
  const sample = [
    'Budi Santoso,3201234567890001,01.234.567.8-901.000,PKWTT,2023-01-12,1995-04-12,"Jl. Melati No. 12, Jakarta Selatan",+62 812-3456-7890',
    'Siti Nurhaliza,3273011234567890,02.345.678.9-012.000,PKWT,2023-03-03,1998-08-21,Jl. Anggrek No. 3 Depok,0812-9876-5432',
  ].join('\n')
  return `${header}\n${sample}\n`
}
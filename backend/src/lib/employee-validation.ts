import { z } from 'zod'
import {
  employeeStatuses,
  jenisKelaminValues,
  jenisKontrakValues,
  type Employee,
  type EmployeeStatus,
  type JenisKelamin,
  type JenisKontrak,
} from '../db/schema.js'
import { PTKP_CATEGORIES } from './pph21.js'

export type EmployeeFormValues = {
  nama_lengkap?: string
  no_ktp?: string
  npwp?: string | null
  tanggal_lahir?: string
  jenis_kelamin?: JenisKelamin
  alamat?: string | null
  kontak_darurat?: string | null
  tanggal_masuk?: string
  jenis_kontrak?: JenisKontrak
  status?: EmployeeStatus
  ptkp_status?: (typeof PTKP_CATEGORIES)[number] | null
  custom_fields?: Record<string, unknown> | null
}
export type SerializedEmployee = Omit<Employee, 'custom_fields'> & {
  custom_fields: Record<string, unknown> | null
}

export function stripNpwpFormat(value: string): string {
  return value.replace(/[.\-\s]/g, '')
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime())
}

export function ageInYears(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const now = new Date()
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - d.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d.getUTCDate())) age--
  return age
}

const isoDateField = (message: string) => z.string().refine(isValidIsoDate, message)

export const noKtpSchema = z.string().regex(/^\d{16}$/, 'No KTP harus tepat 16 digit angka')

export const npwpSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null || v.trim() === '' ? null : stripNpwpFormat(v)))
  .superRefine((v, ctx) => {
    if (v !== null && !/^\d{15}$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NPWP harus 15 digit angka' })
    }
  })

const optionalText = (message: string, validator?: (s: string) => boolean) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === '' ? null : v))
    .superRefine((v, ctx) => {
      if (v !== null && validator && !validator(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message })
      }
    })

const alamatSchema = optionalText('Alamat tidak valid')
const kontakDaruratSchema = optionalText(
  'Format kontak darurat tidak valid',
  (v) => /^\+?[\d\s()-]{7,20}$/.test(v),
)

const customFieldsSchema = z
  .unknown()
  .optional()
  .nullable()
  .refine((v) => v == null || (typeof v === 'object' && !Array.isArray(v)), 'custom_fields harus berupa objek')

export const createEmployeeSchema = z.object({
  nama_lengkap: z.string().min(1, 'Nama lengkap wajib diisi'),
  no_ktp: noKtpSchema,
  npwp: npwpSchema,
  tanggal_lahir: isoDateField('Format tanggal lahir tidak valid (YYYY-MM-DD)').refine(
    (v) => ageInYears(v) >= 17,
    'Umur minimal 17 tahun',
  ),
  jenis_kelamin: z.enum(jenisKelaminValues, { message: 'Jenis kelamin tidak valid' }),
  alamat: alamatSchema,
  kontak_darurat: kontakDaruratSchema,
  tanggal_masuk: isoDateField('Format tanggal masuk tidak valid (YYYY-MM-DD)'),
  jenis_kontrak: z.enum(jenisKontrakValues, { message: 'Jenis kontrak tidak valid' }),
  status: z.enum(employeeStatuses).optional(),
  ptkp_status: z.enum(PTKP_CATEGORIES, { message: 'Status PTKP tidak valid' }).nullable().optional(),
  custom_fields: customFieldsSchema,
})

export const updateEmployeeSchema = z.object({
  nama_lengkap: z.string().min(1, 'Nama lengkap wajib diisi').optional(),
  no_ktp: noKtpSchema.optional(),
  npwp: npwpSchema,
  tanggal_lahir: isoDateField('Format tanggal lahir tidak valid (YYYY-MM-DD)')
    .refine((v) => ageInYears(v) >= 17, 'Umur minimal 17 tahun')
    .optional(),
  jenis_kelamin: z.enum(jenisKelaminValues, { message: 'Jenis kelamin tidak valid' }).optional(),
  alamat: alamatSchema,
  kontak_darurat: kontakDaruratSchema,
  tanggal_masuk: isoDateField('Format tanggal masuk tidak valid (YYYY-MM-DD)').optional(),
  jenis_kontrak: z.enum(jenisKontrakValues, { message: 'Jenis kontrak tidak valid' }).optional(),
  status: z.enum(employeeStatuses).optional(),
  ptkp_status: z.enum(PTKP_CATEGORIES, { message: 'Status PTKP tidak valid' }).nullable().optional(),
  custom_fields: customFieldsSchema,
})

export function parseCustomFields(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

export function serializeEmployee(emp: Employee): SerializedEmployee {
  return { ...emp, custom_fields: parseCustomFields(emp.custom_fields) }
}

const HEADER_ALIASES: Record<string, string> = {
  nama: 'nama_lengkap',
  namalengkap: 'nama_lengkap',
  name: 'nama_lengkap',
  noktp: 'no_ktp',
  ktp: 'no_ktp',
  nik: 'no_ktp',
  npwp: 'npwp',
  nonpwp: 'npwp',
  tanggallahir: 'tanggal_lahir',
  tgllahir: 'tanggal_lahir',
  birth: 'tanggal_lahir',
  jeniskelamin: 'jenis_kelamin',
  gender: 'jenis_kelamin',
  jk: 'jenis_kelamin',
  alamat: 'alamat',
  address: 'alamat',
  kontakdarurat: 'kontak_darurat',
  emergency: 'kontak_darurat',
  tanggalmasuk: 'tanggal_masuk',
  tglmasuk: 'tanggal_masuk',
  jeniskontrak: 'jenis_kontrak',
  kontrak: 'jenis_kontrak',
  contract: 'jenis_kontrak',
  status: 'status',
}

const EMPLOYEE_FIELDS = new Set([
  'nama_lengkap',
  'no_ktp',
  'npwp',
  'tanggal_lahir',
  'jenis_kelamin',
  'alamat',
  'kontak_darurat',
  'tanggal_masuk',
  'jenis_kontrak',
  'status',
  'ptkp_status',
])

export function suggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const used: Set<string> = new Set()
  for (const header of headers) {
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, '')
    const field = HEADER_ALIASES[key]
    if (field && EMPLOYEE_FIELDS.has(field) && !used.has(field)) {
      mapping[header] = field
      used.add(field)
    }
  }
  return mapping
}

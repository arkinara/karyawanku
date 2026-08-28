import { eq } from 'drizzle-orm'
import type { DB } from '../db/index.js'
import { businesses, users } from '../db/schema.js'
import { hashPassword } from './auth.js'
import { ConflictError } from './errors.js'

export interface RegistrationBusinessInput {
  namaBisnis: string
  jenisUsaha?: 'fnb' | 'jasa'
  alamat?: string | null
}

export interface RegistrationOwnerInput {
  nama: string
  email: string
  password: string
}

export interface RegistrationResult {
  business: typeof businesses.$inferSelect
  user: typeof users.$inferSelect
}

/**
 * Membuat bisnis + user owner pertama dalam satu transaksi.
 * Sumber kebenaran tunggal untuk semua jalur pendaftaran
 * (`POST /api/auth/sign-up` dan `POST /api/businesses`).
 *
 * Email unik secara global — dicek terhadap seluruh `users`, bukan hanya
 * bisnis baru. Indeks unik `users.email` di level DB menjamin atomisitas;
 * bila terjadi balapan (dua pendaftaran email sama bersamaan), pelanggaran
 * constraint diterjemahkan menjadi ConflictError (409) tanpa baris yatim.
 */
export async function registerBusinessAndOwner(
  db: DB,
  business: RegistrationBusinessInput,
  owner: RegistrationOwnerInput,
): Promise<RegistrationResult> {
  const passwordHash = await hashPassword(owner.password)
  const email = owner.email.toLowerCase()

  try {
    return db.transaction((tx) => {
      const existing = tx.select().from(users).where(eq(users.email, email)).get()
      if (existing) {
        throw new ConflictError('Email sudah terdaftar')
      }

      const b = tx
        .insert(businesses)
        .values({
          nama_bisnis: business.namaBisnis,
          jenis_usaha: business.jenisUsaha ?? 'fnb',
          alamat: business.alamat ?? null,
        })
        .returning()
        .get()

      const u = tx
        .insert(users)
        .values({
          business_id: b.id,
          nama: owner.nama,
          email,
          password_hash: passwordHash,
          role: 'owner',
        })
        .returning()
        .get()

      return { business: b, user: u }
    })
  } catch (err) {
    if (isEmailUniqueViolation(err)) {
      throw new ConflictError('Email sudah terdaftar')
    }
    throw err
  }
}

function isEmailUniqueViolation(err: unknown): boolean {
  const e = err as { code?: unknown; message?: string }
  return (
    typeof e.code === 'string' &&
    e.code.startsWith('SQLITE_CONSTRAINT') &&
    typeof e.message === 'string' &&
    e.message.includes('users.email')
  )
}
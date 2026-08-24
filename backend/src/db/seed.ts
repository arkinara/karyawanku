import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { businesses, users } from './schema.js'
import { getDb } from './index.js'
import { hashPassword } from '../lib/auth.js'

/**
 * Seed data awal untuk demo lokal:
 * 1 bisnis default + 1 owner + 2 karyawan.
 * Idempoten — melewatkan baris yang email-nya sudah terdaftar di bisnis itu.
 */
export async function seed(): Promise<void> {
  const { db } = getDb()

  let business = db.select().from(businesses).where(eq(businesses.nama_bisnis, 'Warung Kopi Nusantara')).get()

  if (!business) {
    const inserted = db
      .insert(businesses)
      .values({ nama_bisnis: 'Warung Kopi Nusantara', jenis_usaha: 'fnb' })
      .returning()
      .get()
    business = inserted
  }

  const seedUsers: Array<{ nama: string; email: string; password: string; role: 'owner' | 'employee' }> = [
    { nama: 'Darmawan', email: 'owner@demo.com', password: 'owner123', role: 'owner' },
    { nama: 'Siti', email: 'siti@demo.com', password: 'demo123', role: 'employee' },
    { nama: 'Budi', email: 'budi@demo.com', password: 'demo123', role: 'employee' },
  ]

  for (const u of seedUsers) {
    const existing = db
      .select()
      .from(users)
      .where(eq(users.business_id, business.id))
      .all()
      .find((row) => row.email === u.email)

    if (existing) continue

    db.insert(users).values({
      business_id: business.id,
      nama: u.nama,
      email: u.email,
      password_hash: await hashPassword(u.password),
      role: u.role,
    }).run()
  }

  console.log('[seed] selesai: 1 bisnis, 3 user demo')
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed().catch((err) => {
    console.error('[seed] gagal:', err)
    process.exit(1)
  })
}

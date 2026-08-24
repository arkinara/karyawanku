import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'node:crypto'

export const roles = ['owner', 'employee'] as const
export type Role = (typeof roles)[number]

export const userStatuses = ['aktif', 'nonaktif'] as const
export type UserStatus = (typeof userStatuses)[number]

export const businesses = sqliteTable('businesses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  nama_bisnis: text('nama_bisnis').notNull(),
  jenis_usaha: text('jenis_usaha', { enum: ['fnb', 'jasa'] }).notNull().default('fnb'),
  alamat: text('alamat'),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    password_hash: text('password_hash').notNull(),
    nama: text('nama').notNull(),
    role: text('role', { enum: roles }).notNull().default('employee'),
    employee_id: text('employee_id'),
    status: text('status', { enum: userStatuses }).notNull().default('aktif'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('users_business_email_unique').on(table.business_id, table.email),
    index('users_business_id_idx').on(table.business_id),
  ],
)

export type Business = typeof businesses.$inferSelect
export type NewBusiness = typeof businesses.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

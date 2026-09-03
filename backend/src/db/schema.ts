import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'node:crypto'

export const roles = ['owner', 'manager', 'employee'] as const
export type Role = (typeof roles)[number]

export const userStatuses = ['aktif', 'nonaktif'] as const
export type UserStatus = (typeof userStatuses)[number]

export const jenisKelaminValues = ['L', 'P'] as const
export type JenisKelamin = (typeof jenisKelaminValues)[number]

export const jenisKontrakValues = ['pkwtt', 'pkwt', 'pkl', 'magang', 'harian'] as const
export type JenisKontrak = (typeof jenisKontrakValues)[number]

export const employeeStatuses = ['aktif', 'nonaktif'] as const
export type EmployeeStatus = (typeof employeeStatuses)[number]

export const salaryComponentTypes = ['earning', 'deduction'] as const
export type SalaryComponentType = (typeof salaryComponentTypes)[number]

export const leavePolicyValues = ['hangus', 'carry-over'] as const
export type LeavePolicy = (typeof leavePolicyValues)[number]

export const leaveRequestStatuses = ['pending', 'disetujui', 'ditolak'] as const
export type LeaveRequestStatus = (typeof leaveRequestStatuses)[number]

export const attendanceStatuses = ['hadir', 'telat', 'absen', 'izin'] as const
export type AttendanceStatus = (typeof attendanceStatuses)[number]

/** Cara record absensi dikirim (ticket #59): live vs flush dari antrian offline. */
export const attendanceSubmissionMethods = ['live', 'offline_queue'] as const
export type AttendanceSubmissionMethod = (typeof attendanceSubmissionMethods)[number]

export const payrollRunStatuses = ['draft', 'disetujui', 'locked'] as const
export type PayrollRunStatus = (typeof payrollRunStatuses)[number]

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
    employee_id: text('employee_id').references(() => employees.id),
    status: text('status', { enum: userStatuses }).notNull().default('aktif'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_business_id_idx').on(table.business_id),
  ],
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jti: text('jti').notNull(),
    issued_at: integer('issued_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
    revoked_at: integer('revoked_at', { mode: 'timestamp' }),
    user_agent: text('user_agent'),
    ip: text('ip'),
  },
  (table) => [
    uniqueIndex('sessions_jti_unique').on(table.jti),
    index('sessions_user_id_idx').on(table.user_id),
  ],
)

export const passwordResets = sqliteTable(
  'password_resets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull(),
    expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
    used_at: integer('used_at', { mode: 'timestamp' }),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('password_resets_token_hash_unique').on(table.token_hash),
    index('password_resets_user_id_idx').on(table.user_id),
  ],
)

export const employees = sqliteTable(
  'employees',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    nama_lengkap: text('nama_lengkap').notNull(),
    no_ktp: text('no_ktp').notNull(),
    npwp: text('npwp'),
    tanggal_lahir: text('tanggal_lahir').notNull(),
    jenis_kelamin: text('jenis_kelamin', { enum: jenisKelaminValues }).notNull(),
    alamat: text('alamat'),
    kontak_darurat: text('kontak_darurat'),
    tanggal_masuk: text('tanggal_masuk').notNull(),
    jenis_kontrak: text('jenis_kontrak', { enum: jenisKontrakValues }).notNull(),
    status: text('status', { enum: employeeStatuses }).notNull().default('aktif'),
    ptkp_status: text('ptkp_status'),
    custom_fields: text('custom_fields'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('employees_business_no_ktp_unique').on(table.business_id, table.no_ktp),
    index('employees_business_id_idx').on(table.business_id),
  ],
)

export const salaryComponents = sqliteTable(
  'salary_components',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    nama_komponen: text('nama_komponen').notNull(),
    tipe: text('tipe', { enum: salaryComponentTypes }).notNull().default('earning'),
    nominal: real('nominal'),
    formula: text('formula'),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
    is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    /**
     * Tunjangan tetap (ticket #55) — basis THR Permenaker 6/2016.
     * `is_fixed=true` berarti komponen masuk ke basis upah THR (gaji pokok +
     * tunjangan tetap); `false` (variabel / tidak tetap) tidak dihitung.
     */
    is_fixed: integer('is_fixed', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('salary_components_business_id_idx').on(table.business_id)],
)

export const employeeSalaryAssignments = sqliteTable(
  'employee_salary_assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    salary_component_id: text('salary_component_id')
      .notNull()
      .references(() => salaryComponents.id, { onDelete: 'cascade' }),
    override_nominal: real('override_nominal'),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('employee_salary_assignments_employee_idx').on(table.employee_id)],
)

export const leaveTypes = sqliteTable(
  'leave_types',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    nama_jenis_cuti: text('nama_jenis_cuti').notNull(),
    default_kuota_hari: integer('default_kuota_hari').notNull().default(12),
    kebijakan_sisa: text('kebijakan_sisa', { enum: leavePolicyValues }).notNull().default('hangus'),
    carry_over_max_days: integer('carry_over_max_days'),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('leave_types_business_id_idx').on(table.business_id)],
)

export const leaveBalances = sqliteTable(
  'leave_balances',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leave_type_id: text('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'cascade' }),
    tahun: integer('tahun').notNull(),
    kuota_hari: real('kuota_hari').notNull().default(0),
    terpakai_hari: real('terpakai_hari').notNull().default(0),
  },
  (table) => [index('leave_balances_employee_idx').on(table.employee_id)],
)

export const leaveRequests = sqliteTable(
  'leave_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leave_type_id: text('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'cascade' }),
    tanggal_mulai: text('tanggal_mulai').notNull(),
    tanggal_selesai: text('tanggal_selesai').notNull(),
    alasan: text('alasan'),
    status: text('status', { enum: leaveRequestStatuses }).notNull().default('pending'),
    approver_user_id: text('approver_user_id').references(() => users.id),
    catatan_approver: text('catatan_approver'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    decided_at: integer('decided_at', { mode: 'timestamp' }),
  },
  (table) => [index('leave_requests_employee_idx').on(table.employee_id)],
)

export const shiftNames = ['Pagi', 'Siang', 'Malam', 'Libur'] as const
export type ShiftName = (typeof shiftNames)[number]

export const shifts = sqliteTable(
  'shifts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    nama_shift: text('nama_shift').notNull(),
    jam_mulai: text('jam_mulai').notNull(),
    jam_selesai: text('jam_selesai').notNull(),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('shifts_business_id_idx').on(table.business_id)],
)

export const shiftAssignments = sqliteTable(
  'shift_assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    shift_id: text('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    tanggal: text('tanggal').notNull(),
    published: integer('published', { mode: 'boolean' }).notNull().default(false),
    published_at: integer('published_at', { mode: 'timestamp' }),
    published_by_user_id: text('published_by_user_id').references(() => users.id),
  },
  (table) => [
    index('shift_assignments_employee_idx').on(table.employee_id),
    index('shift_assignments_tanggal_idx').on(table.tanggal),
  ],
)

export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    tanggal: text('tanggal').notNull(),
    /**
     * Waktu otoritatif (ticket #59): `clock_in` / `clock_out` selalu jam server
     * (`Date.now()` saat request diproses). Waktu yang dikirim klien disimpan
     * terpisah sebagai klaim (`client_claim_at`) dan TIDAK pernah menjadi waktu
     * otoritatif — kecuali untuk submission dari antrian offline
     * (`submission_method = 'offline_queue'`), di mana `clock_in` mempertahankan
     * waktu aksi asli klien (klaim) karena itu durasi offline yang sah.
     */
    clock_in: text('clock_in'),
    clock_out: text('clock_out'),
    /** Klaim waktu clock-in dari klien (jam server ≠ jam klien di luar toleransi). */
    client_claim_at: text('client_claim_at'),
    /** Klaim waktu clock-out dari klien. */
    clock_out_client_claim_at: text('clock_out_client_claim_at'),
    /** true bila submission live dan selisih klaim vs jam server > toleransi. */
    time_drift_detected: integer('time_drift_detected', { mode: 'boolean' }).notNull().default(false),
    /** Asal submission: 'live' (langsung) atau 'offline_queue' (flush antrian offline). */
    submission_method: text('submission_method', { enum: attendanceSubmissionMethods })
      .notNull()
      .default('live'),
    catatan: text('catatan'),
    status: text('status', { enum: attendanceStatuses }).notNull().default('hadir'),
    late_minutes: integer('late_minutes').notNull().default(0),
    /**
     * Jam lembur (ticket #54): menit di luar jam selesai shift (+grace), diturunkan
     * saat clock-out. Untuk hari dengan status `absen` selalu 0.
     */
    overtime_minutes: integer('overtime_minutes').notNull().default(0),
    /** Koreksi manual jam lembur (menit) yang menang atas nilai turunan; null = pakai turunan. */
    overtime_override_minutes: integer('overtime_override_minutes'),
  },
  (table) => [
    index('attendance_records_employee_idx').on(table.employee_id),
    uniqueIndex('attendance_records_employee_tanggal_unique').on(table.employee_id, table.tanggal),
  ],
)

export const payrollRuns = sqliteTable(
  'payroll_runs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    periode: text('periode').notNull(),
    status: text('status', { enum: payrollRunStatuses }).notNull().default('draft'),
    total_gaji: real('total_gaji').notNull().default(0),
    total_potongan: real('total_potongan').notNull().default(0),
    take_home: real('take_home').notNull().default(0),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    approved_at: integer('approved_at', { mode: 'timestamp' }),
    approved_by_user_id: text('approved_by_user_id').references(() => users.id),
  },
  (table) => [index('payroll_runs_business_id_idx').on(table.business_id)],
)

export const payrollItems = sqliteTable(
  'payroll_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    payroll_run_id: text('payroll_run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    gaji_pokok: real('gaji_pokok').notNull().default(0),
    total_tunjangan: real('total_tunjangan').notNull().default(0),
    total_bpjs_kesehatan: real('total_bpjs_kesehatan').notNull().default(0),
    total_bpjs_tk: real('total_bpjs_tk').notNull().default(0),
    pph21: real('pph21').notNull().default(0),
    take_home: real('take_home').notNull().default(0),
    koreksi: real('koreksi').notNull().default(0),
    catatan_koreksi: text('catatan_koreksi'),
    detail_breakdown: text('detail_breakdown'),
  },
  (table) => [index('payroll_items_payroll_run_idx').on(table.payroll_run_id)],
)

export const payslips = sqliteTable(
  'payslips',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    payroll_item_id: text('payroll_item_id')
      .unique()
      .notNull()
      .references(() => payrollItems.id, { onDelete: 'cascade' }),
    pdf_url: text('pdf_url'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('payslips_payroll_item_id_idx').on(table.payroll_item_id)],
)

/**
 * Pencairan THR (Tunjangan Hari Raya Keagamaan, Permenaker 6/2016) per karyawan
 * per tahun (ticket #55). Satu baris per (employee_id, periode=tahun), dijamin
 * unik sehingga tidak ada pembayaran ganda dalam satu tahun.
 */
export const thrPayments = sqliteTable(
  'thr_payments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** Tahun THR dibayarkan, format 'YYYY'. */
    periode: text('periode').notNull(),
    /** Tanggal pembayaran aktual, format 'YYYY-MM-DD'. */
    tanggal_bayar: text('tanggal_bayar').notNull(),
    amount: real('amount').notNull(),
    basis: real('basis').notNull(),
    months_of_service: integer('months_of_service').notNull(),
    proportion: real('proportion').notNull(),
    created_by: text('created_by')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('thr_payments_employee_periode_unique').on(table.employee_id, table.periode),
    index('thr_payments_business_id_idx').on(table.business_id),
  ],
)

/**
 * Catatan audit append-only (ticket #57). Satu-satunya jalur tulis adalah
 * `recordAudit` dari `src/lib/audit.ts`, dipanggil DI DALAM transaksi yang sama
 * dengan perubahan yang dideskripsikannya. TIDAK ADA rute update/delete untuk
 * tabel ini; `before`/`after` disimpan sebagai JSON dengan field sensitif
 * (password hash, token, secret) otomatis diredaksi.
 */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    business_id: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    actor_user_id: text('actor_user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    before: text('before', { mode: 'json' }),
    after: text('after', { mode: 'json' }),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('audit_logs_business_created_at_idx').on(table.business_id, table.created_at)],
)

/**
 * Metadata selfie verifikasi absensi (ticket #69). File gambar disimpan di
 * filesystem (`backend/data/selfies/{employee_id}/{attendance_id}.jpg`) — hanya
 * referensi (path) + ukuran + masa simpan yang dicatat di DB. `attendance_id`
 * adalah primary key sehingga satu record absensi punya paling banyak satu
 * selfie (upload kedua menimpa yang pertama dengan masa simpan baru).
 * `retention_until` (default 90 hari) adalah batas waktu file boleh disajikan;
 * job purge harian menghapus baris + file yang sudah lewat batas.
 */
export const selfieMeta = sqliteTable(
  'selfie_meta',
  {
    attendance_id: text('attendance_id')
      .primaryKey()
      .references(() => attendanceRecords.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    /** Selalu `image/jpeg` — server menurunkan ukuran + re-encode saat simpan. */
    mime_type: text('mime_type').notNull(),
    size_bytes: integer('size_bytes').notNull(),
    uploaded_at: integer('uploaded_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    retention_until: integer('retention_until', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('selfie_meta_retention_until_idx').on(table.retention_until)],
)

/**
 * Kunci idempotensi submission absensi (ticket #70): satu `idempotency_key`
 * per tindakan clock-in/out yang dihasilkan klien (UUID v4 / hex 256-bit),
 * disimpan SEBELUM respons sukses dikirim (di dalam transaksi yang sama dengan
 * write). Kirim ulang dengan key yang sama mengembalikan record asli tanpa
 * menulis ulang — mencegah absensi ganda saat retry antrian offline / respons
 * hilang di tengah jalan.
 *
 * `idempotency_key` adalah primary key (unik global) sehingga key milik satu
 * karyawan TIDAK bisa dipakai karyawan lain — insert dengan key yang sudah
 * terpakai batal (diterjemahkan menjadi 422). `endpoint` ikut dipakai saat
 * pencarian replay sehingga key clock-in tidak bisa membalas sebagai clock-out.
 * `expires_at` default 30 hari; key yang kedaluwarsa dianggap tidak ada
 * (tidak pernah dipakai untuk menahan double-write) dan dibersihkan oleh job
 * harian (`purgeExpired`).
 */
export const attendanceIdempotency = sqliteTable(
  'attendance_idempotency',
  {
    idempotency_key: text('idempotency_key').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    attendance_id: text('attendance_id')
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: 'cascade' }),
    /** `clock_in` | `clock_out` — endpoint yang memproduksi record ini. */
    endpoint: text('endpoint', { enum: ['clock_in', 'clock_out'] }).notNull(),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    /** Batas pemakaian key (30 hari sejak dibuat). Kedaluwarsa = dianggap tak ada. */
    expires_at: integer('expires_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch() + 2592000)`),
  },
  (table) => [index('attendance_idempotency_employee_idx').on(table.employee_id)],
)

/**
 * Bookkeeping key-value untuk proses berkala (ticket #56). Key yang dikenal:
 * `last_leave_reset_year` (tahun terakhir reset tahunan cuti, ditulis oleh
 * `runYearlyResetIfNeeded`) dan `last_thr_reset_year` (dicadangkan untuk proses
 * THR berkala). Satu baris per key — unik oleh `key` (primary key).
 */
export const systemState = sqliteTable('system_state', {
  key: text('key').primaryKey(),
  value: integer('value'),
})

export type Business = typeof businesses.$inferSelect
export type NewBusiness = typeof businesses.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type PasswordReset = typeof passwordResets.$inferSelect
export type NewPasswordReset = typeof passwordResets.$inferInsert
export type Employee = typeof employees.$inferSelect
export type NewEmployee = typeof employees.$inferInsert
export type SalaryComponent = typeof salaryComponents.$inferSelect
export type EmployeeSalaryAssignment = typeof employeeSalaryAssignments.$inferSelect
export type LeaveType = typeof leaveTypes.$inferSelect
export type LeaveBalance = typeof leaveBalances.$inferSelect
export type LeaveRequest = typeof leaveRequests.$inferSelect
export type Shift = typeof shifts.$inferSelect
export type ShiftAssignment = typeof shiftAssignments.$inferSelect
export type AttendanceRecord = typeof attendanceRecords.$inferSelect
export type PayrollRun = typeof payrollRuns.$inferSelect
export type PayrollItem = typeof payrollItems.$inferSelect
export type Payslip = typeof payslips.$inferSelect
export type ThrPayment = typeof thrPayments.$inferSelect
export type NewThrPayment = typeof thrPayments.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type SelfieMeta = typeof selfieMeta.$inferSelect
export type NewSelfieMeta = typeof selfieMeta.$inferInsert
export type AttendanceIdempotency = typeof attendanceIdempotency.$inferSelect
export type NewAttendanceIdempotency = typeof attendanceIdempotency.$inferInsert

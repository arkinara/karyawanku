import 'dotenv/config'
import { eq } from 'drizzle-orm'
import {
  attendanceRecords,
  businesses,
  employees,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  payrollItems,
  payrollRuns,
  payslips,
  shiftAssignments,
  shifts,
  users,
} from './schema.js'
import { getDb } from './index.js'
import { hashPassword } from '../lib/auth.js'
import { ensureLeaveTypesSeeded } from '../lib/leave-reset.js'

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentPeriode(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isoTime(dayOffset: number, hhmm: string): string {
  return new Date(`${isoDate(dayOffset)}T${hhmm}:00`).toISOString()
}

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

  await seedEmployeeData(business.id)
}

/**
 * Data karyawan demo (roster, absensi, cuti, payroll) supaya dashboard owner
 * dan beranda employee sama-sama menampilkan angka nyata, bukan nol semua.
 * Idempoten — dilewati kalau employee "Siti" untuk bisnis ini sudah ada.
 */
async function seedEmployeeData(businessId: string): Promise<void> {
  const { db } = getDb()

  const existingSiti = db
    .select()
    .from(employees)
    .where(eq(employees.business_id, businessId))
    .all()
    .find((e) => e.no_ktp === '3171012501980001')
  if (existingSiti) return

  const siti = db
    .insert(employees)
    .values({
      business_id: businessId,
      nama_lengkap: 'Siti',
      no_ktp: '3171012501980001',
      tanggal_lahir: '1998-01-25',
      jenis_kelamin: 'P',
      alamat: 'Jakarta Selatan',
      tanggal_masuk: '2023-03-01',
      jenis_kontrak: 'pkwtt',
      status: 'aktif',
    })
    .returning()
    .get()

  const budi = db
    .insert(employees)
    .values({
      business_id: businessId,
      nama_lengkap: 'Budi',
      no_ktp: '3171012803950002',
      tanggal_lahir: '1995-03-28',
      jenis_kelamin: 'L',
      alamat: 'Jakarta Selatan',
      tanggal_masuk: '2022-11-15',
      jenis_kontrak: 'pkwt',
      status: 'aktif',
    })
    .returning()
    .get()

  db.update(users).set({ employee_id: siti.id }).where(eq(users.email, 'siti@demo.com')).run()
  db.update(users).set({ employee_id: budi.id }).where(eq(users.email, 'budi@demo.com')).run()

  const owner = db.select().from(users).where(eq(users.email, 'owner@demo.com')).get()

  // Reuse the app's own default leave types (created lazily by
  // `ensureLeaveTypesSeeded` the first time any /leave-types or
  // /leave-balances request hits this business) instead of inserting a
  // parallel "Cuti X" set — two sets with matching names but different ids
  // silently split balances/requests across them.
  ensureLeaveTypesSeeded(businessId)
  const insertedLeaveTypes = db
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.business_id, businessId))
    .all()
  const tahunan = insertedLeaveTypes.find((t) => t.nama_jenis_cuti === 'Tahunan')!
  const sakit = insertedLeaveTypes.find((t) => t.nama_jenis_cuti === 'Sakit')!

  const tahun = new Date().getFullYear()
  for (const emp of [siti, budi]) {
    for (const lt of insertedLeaveTypes) {
      db.insert(leaveBalances)
        .values({ employee_id: emp.id, leave_type_id: lt.id, tahun, kuota_hari: lt.default_kuota_hari, terpakai_hari: 0 })
        .run()
    }
  }

  db.insert(leaveRequests)
    .values({
      employee_id: siti.id,
      leave_type_id: tahunan.id,
      tanggal_mulai: isoDate(7),
      tanggal_selesi: isoDate(9),
      alasan: 'Pulang kampung menengok orang tua',
      status: 'pending',
    })
    .run()

  db.insert(leaveRequests)
    .values({
      employee_id: budi.id,
      leave_type_id: sakit.id,
      tanggal_mulai: isoDate(-10),
      tanggal_selesi: isoDate(-9),
      alasan: 'Demam, ada surat keterangan dokter',
      status: 'disetujui',
      approver_user_id: owner?.id,
      catatan_approver: 'Sudah sesuai surat dokter',
      decided_at: new Date(),
    })
    .run()

  const pagi = db
    .insert(shifts)
    .values({ business_id: businessId, nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' })
    .returning()
    .get()
  const siang = db
    .insert(shifts)
    .values({ business_id: businessId, nama_shift: 'Siang', jam_mulai: '15:00', jam_selesai: '23:00' })
    .returning()
    .get()

  for (const offset of [0, 1, 2]) {
    db.insert(shiftAssignments)
      .values({ employee_id: siti.id, shift_id: pagi.id, tanggal: isoDate(offset), published: true })
      .run()
    db.insert(shiftAssignments)
      .values({ employee_id: budi.id, shift_id: siang.id, tanggal: isoDate(offset), published: true })
      .run()
  }

  db.insert(attendanceRecords)
    .values({ employee_id: siti.id, tanggal: isoDate(0), clock_in: isoTime(0, '07:05'), status: 'hadir', late_minutes: 0 })
    .run()
  db.insert(attendanceRecords)
    .values({ employee_id: budi.id, tanggal: isoDate(0), clock_in: isoTime(0, '15:12'), status: 'telat', late_minutes: 12 })
    .run()
  db.insert(attendanceRecords)
    .values({
      employee_id: siti.id,
      tanggal: isoDate(-1),
      clock_in: isoTime(-1, '06:58'),
      clock_out: isoTime(-1, '15:03'),
      status: 'hadir',
      late_minutes: 0,
    })
    .run()
  db.insert(attendanceRecords)
    .values({
      employee_id: budi.id,
      tanggal: isoDate(-1),
      clock_in: isoTime(-1, '15:00'),
      clock_out: isoTime(-1, '23:05'),
      status: 'hadir',
      late_minutes: 0,
    })
    .run()

  const sitiItem = { gaji_pokok: 4_200_000, total_tunjangan: 300_000, total_bpjs_kesehatan: 42_000, total_bpjs_tk: 84_000, pph21: 0 }
  const budiItem = { gaji_pokok: 3_800_000, total_tunjangan: 250_000, total_bpjs_kesehatan: 38_000, total_bpjs_tk: 76_000, pph21: 0 }
  const takeHome = (i: typeof sitiItem) =>
    i.gaji_pokok + i.total_tunjangan - i.total_bpjs_kesehatan - i.total_bpjs_tk - i.pph21

  const run = db
    .insert(payrollRuns)
    .values({
      business_id: businessId,
      periode: currentPeriode(),
      status: 'disetujui',
      total_gaji: sitiItem.gaji_pokok + sitiItem.total_tunjangan + budiItem.gaji_pokok + budiItem.total_tunjangan,
      total_potongan:
        sitiItem.total_bpjs_kesehatan +
        sitiItem.total_bpjs_tk +
        sitiItem.pph21 +
        budiItem.total_bpjs_kesehatan +
        budiItem.total_bpjs_tk +
        budiItem.pph21,
      take_home: takeHome(sitiItem) + takeHome(budiItem),
      approved_at: new Date(),
      approved_by_user_id: owner?.id,
    })
    .returning()
    .get()

  for (const [emp, item] of [
    [siti, sitiItem],
    [budi, budiItem],
  ] as const) {
    const detailBreakdown = {
      komponen_gaji_pokok: [
        { komponen: 'Gaji Pokok', override_nominal: null, nominal: item.gaji_pokok, formula: null, nilai: item.gaji_pokok },
      ],
      komponen_tunjangan: [
        {
          komponen: 'Tunjangan Transport',
          override_nominal: null,
          nominal: item.total_tunjangan,
          formula: null,
          nilai: item.total_tunjangan,
        },
      ],
      komponen_potongan: [],
    }
    const payrollItem = db
      .insert(payrollItems)
      .values({
        payroll_run_id: run.id,
        employee_id: emp.id,
        ...item,
        take_home: takeHome(item),
        detail_breakdown: JSON.stringify(detailBreakdown),
      })
      .returning()
      .get()
    db.insert(payslips).values({ payroll_item_id: payrollItem.id }).run()
  }

  console.log('[seed] data karyawan demo selesai: 2 karyawan, absensi, cuti, payroll bulan ini')
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed().catch((err) => {
    console.error('[seed] gagal:', err)
    process.exit(1)
  })
}

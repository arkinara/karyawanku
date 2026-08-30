import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  salaryComponents,
  shifts,
  shiftAssignments,
  users,
} from '../src/db/schema.js'
import { computeOvertimeMinutes } from '../src/lib/overtime.js'
import { buildAttendanceVars } from '../src/lib/payroll.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '5566778899' + String(700000 + i)
}

async function seedEmployee(name = 'Siti', ktpIdx = 1): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(ktpIdx),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function seedComponent(
  name: string,
  opts: { tipe?: 'earning' | 'deduction'; nominal?: number; formula?: string } = {},
) {
  return ctx.db.db
    .insert(salaryComponents)
    .values({
      business_id: ctx.businessId,
      nama_komponen: name,
      tipe: opts.tipe ?? 'earning',
      nominal: opts.nominal ?? null,
      formula: opts.formula ?? null,
    })
    .returning()
    .get()
}

async function assign(employeeId: string, componentId: string) {
  await ctx.db.db
    .insert(employeeSalaryAssignments)
    .values({ employee_id: employeeId, salary_component_id: componentId })
    .run()
}

async function linkEmployeeUser(employeeId: string) {
  await ctx.db.db.update(users).set({ employee_id: employeeId }).where(eq(users.email, 'siti@demo.com')).run()
}

describe('computeOvertimeMinutes (pure)', () => {
  it('clock-out 30 mnt setelah jam selesai shift dengan grace 15 mnt → 15 mnt lembur', () => {
    const clockIn = new Date('2026-08-10T07:00:00')
    const clockOut = new Date('2026-08-10T15:30:00') // jam selesai 15:00
    expect(computeOvertimeMinutes(clockIn, clockOut, '15:00')).toBe(15)
  })

  it('clock-out dalam batas grace → 0 mnt', () => {
    const clockIn = new Date('2026-08-10T07:00:00')
    const clockOut = new Date('2026-08-10T15:10:00')
    expect(computeOvertimeMinutes(clockIn, clockOut, '15:00')).toBe(0)
  })

  it('clock-out tepat di ambang grace (15:15) → 0 mnt', () => {
    const clockIn = new Date('2026-08-10T07:00:00')
    const clockOut = new Date('2026-08-10T15:15:00')
    expect(computeOvertimeMinutes(clockIn, clockOut, '15:00')).toBe(0)
  })

  it('grace dapat dikonfigurasi (grace 0) → 30 mnt', () => {
    const clockIn = new Date('2026-08-10T07:00:00')
    const clockOut = new Date('2026-08-10T15:30:00')
    expect(computeOvertimeMinutes(clockIn, clockOut, '15:00', 0)).toBe(30)
  })

  it('override menang atas nilai turunan', () => {
    const clockIn = new Date('2026-08-10T07:00:00')
    const clockOut = new Date('2026-08-10T15:10:00') // dalam grace → turunan 0
    expect(computeOvertimeMinutes(clockIn, clockOut, '15:00', 15, 120)).toBe(120)
  })

  it('shift Malam lintas tengah malam: clock-out sebelum jam selesai berikutnya → 0', () => {
    const clockIn = new Date('2026-08-10T22:00:00')
    const clockOut = new Date('2026-08-10T23:30:00') // shift 22:00–06:00, belum usai
    expect(computeOvertimeMinutes(clockIn, clockOut, '06:00')).toBe(0)
  })

  it('shift Malam lintas tengah malam: clock-out 06:30 → 15 mnt lembur', () => {
    const clockIn = new Date('2026-08-10T22:00:00')
    const clockOut = new Date('2026-08-11T06:30:00') // shift selesai 06:00 (hari berikutnya)
    expect(computeOvertimeMinutes(clockIn, clockOut, '06:00')).toBe(15)
  })

  it('shift 00:00–00:00 (tidak lintas tengah malam) dengan jam mulai eksplisit → dihitung dari hari yang sama', () => {
    const clockIn = new Date('2026-08-10T08:00:00')
    const clockOut = new Date('2026-08-10T01:00:00') // 45 mnt setelah 00:00 + grace
    // jam mulai eksplisit '00:00' → tidak lintas tengah malam (tanpa itu, heuristik
    // jam clock-in 08 > 0 salah menganggap lintas → 0 lembur)
    expect(computeOvertimeMinutes(clockIn, clockOut, '00:00', 15, null, '00:00')).toBe(45)
  })

  it('clock-out sebelum jam selesai → 0 (tidak pernah negatif)', () => {
    const clockIn = new Date('2026-08-10T07:00:00')
    const clockOut = new Date('2026-08-10T13:00:00')
    expect(computeOvertimeMinutes(clockIn, clockOut, '15:00')).toBe(0)
  })
})

describe('buildAttendanceVars → jam_lembur & tarif_lembur', () => {
  it('jam_lembur = total menit lembur / 60, tarif_lembur = (gaji_pokok / 173) × 1.5', () => {
    const vars = buildAttendanceVars(
      {
        hadir: 3,
        telat: 1,
        absen: 0,
        izin: 0,
        total_late_minutes: 12,
        total_overtime_minutes: 150,
      },
      3_000_000,
    )
    expect(vars.jam_lembur).toBe(2.5)
    expect(vars.tarif_lembur).toBe(26012) // round(3000000 / 173 * 1.5)
    expect(vars.hadir).toBe(3)
    expect(vars.telat).toBe(1)
    expect(vars.absen).toBe(0)
    expect(vars.izin).toBe(0)
  })

  it('tanpa lembur → jam_lembur 0 (bukan null)', () => {
    const vars = buildAttendanceVars(
      { hadir: 0, telat: 0, absen: 0, izin: 0, total_late_minutes: 0, total_overtime_minutes: 0 },
      0,
    )
    expect(vars.jam_lembur).toBe(0)
    expect(vars.tarif_lembur).toBe(0)
  })

  it('kontrak: variabel lembur yang diizinkan validateFormula tersedia di runtime', () => {
    const vars = buildAttendanceVars(
      { hadir: 0, telat: 0, absen: 0, izin: 0, total_late_minutes: 0, total_overtime_minutes: 0 },
      3_000_000,
    )
    // Variabel yang dipromosikan ticket ini wajib ada di runtime payroll.
    for (const name of ['hadir', 'telat', 'absen', 'izin', 'gaji_pokok', 'jam_lembur', 'tarif_lembur']) {
      expect(vars).toHaveProperty(name)
      expect(typeof vars[name]).toBe('number')
    }
  })
})

describe('POST /api/attendance/manual — overtime', () => {
  it('overtime_minutes=120 tersimpan langsung', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: emp.id,
        tanggal: '2026-08-05',
        clock_in: '2026-08-05T07:00:00.000Z',
        clock_out: '2026-08-05T16:00:00.000Z',
        status: 'hadir',
        overtime_minutes: 120,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.overtime_minutes).toBe(120)
  })

  it('overtime pada hari absen → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: emp.id,
        tanggal: '2026-08-05',
        status: 'absen',
        overtime_minutes: 30,
      },
    })
    expect(res.statusCode).toBe(422)
  })

  it('overtime negatif / melebihi batas harian (720) → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const negative = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: emp.id,
        tanggal: '2026-08-05',
        status: 'hadir',
        overtime_minutes: -5,
      },
    })
    expect(negative.statusCode).toBe(422)

    const tooBig = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: emp.id,
        tanggal: '2026-08-05',
        status: 'hadir',
        overtime_minutes: 721,
      },
    })
    expect(tooBig.statusCode).toBe(422)
  })
})

describe('Override lembur (PATCH /api/attendance/:id)', () => {
  it('override tersimpan dan menang atas nilai turunan di aggregate', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = ctx.db.db
      .insert(attendanceRecords)
      .values({
        employee_id: emp.id,
        tanggal: '2026-08-05',
        clock_in: '2026-08-05T07:00:00.000Z',
        clock_out: '2026-08-05T16:30:00.000Z',
        status: 'hadir',
        overtime_minutes: 60, // nilai turunan
      })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${rec.id}`,
      headers: auth(ctx.ownerToken),
      payload: { overtime_override_minutes: 120 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.overtime_override_minutes).toBe(120)
    expect(res.json().record.overtime_minutes).toBe(60)

    const agg = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-08`,
      headers: auth(ctx.ownerToken),
    })
    expect(agg.json().total_overtime_minutes).toBe(120)
  })

  it('override dibersihkan (null) → kembali ke nilai turunan', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = ctx.db.db
      .insert(attendanceRecords)
      .values({
        employee_id: emp.id,
        tanggal: '2026-08-05',
        status: 'hadir',
        overtime_minutes: 90,
        overtime_override_minutes: 200,
      })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${rec.id}`,
      headers: auth(ctx.ownerToken),
      payload: { overtime_override_minutes: null },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.overtime_override_minutes).toBeNull()

    const agg = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-08`,
      headers: auth(ctx.ownerToken),
    })
    expect(agg.json().total_overtime_minutes).toBe(90)
  })

  it('override pada hari absen → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const rec = ctx.db.db
      .insert(attendanceRecords)
      .values({ employee_id: emp.id, tanggal: '2026-08-05', status: 'absen' })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${rec.id}`,
      headers: auth(ctx.ownerToken),
      payload: { overtime_override_minutes: 30 },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('Clock-out otomatis menurunkan overtime (ticket #54)', () => {
  it('clock-out melebihi jam selesai shift + grace → overtime_minutes turunan tersimpan', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const today = new Date()
    const tanggal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`

    // Shift berakhir tengah malam → clock-out kapan pun hari ini melebihi jam selesai.
    const shift = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.businessId, nama_shift: 'Pagi', jam_mulai: '00:00', jam_selesai: '00:00' })
      .returning()
      .get()
    ctx.db.db
      .insert(shiftAssignments)
      .values({ employee_id: emp.id, shift_id: shift.id, tanggal, published: true })
      .run()

    const clockIn = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: emp.id, submission_method: 'live' },
    })
    expect(clockIn.statusCode).toBe(200)

    const clockOut = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-out',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: emp.id, submission_method: 'live' },
    })
    expect(clockOut.statusCode).toBe(200)

    const rec = clockOut.json().record
    const clockOutDate = new Date(rec.clock_out)
    const midnight = new Date(clockOutDate)
    midnight.setHours(0, 0, 0, 0)
    const expected = Math.max(0, Math.round((clockOutDate.getTime() - midnight.getTime()) / 60000) - 15)
    expect(rec.overtime_minutes).toBe(expected)
  })
})

describe('Payroll: formula jam_lembur * tarif_lembur', () => {
  async function seedPayrollFixture() {
    const emp = await seedEmployee()
    const gajiPokok = await seedComponent('Gaji Pokok', { nominal: 3_000_000 })
    const lembur = await seedComponent('Tunjangan Lembur', { formula: 'jam_lembur * tarif_lembur' })
    await assign(emp.id, gajiPokok.id)
    await assign(emp.id, lembur.id)
    ctx.db.db
      .insert(attendanceRecords)
      .values([
        { employee_id: emp.id, tanggal: '2026-08-01', status: 'hadir', overtime_minutes: 60 },
        { employee_id: emp.id, tanggal: '2026-08-02', status: 'hadir', overtime_minutes: 60 },
      ])
      .run()
    return emp
  }

  it('run payroll berhasil — tidak melempar "Variabel tidak dikenal"', async () => {
    ctx = await setupTest()
    await seedPayrollFixture()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    expect(res.statusCode).toBe(201)
    const item = res.json().items[0]
    expect(item.gaji_pokok).toBe(3_000_000)
    expect(item.detail_breakdown.attendance.total_overtime_minutes).toBe(120)
    expect(item.detail_breakdown.attendance.jam_lembur).toBeUndefined() // aggregate mentah, bukan vars formula
  })

  it('komponen Tunjangan Lembur bernilai jam_lembur × tarif_lembur', async () => {
    ctx = await setupTest()
    await seedPayrollFixture()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    expect(res.statusCode).toBe(201)
    const item = res.json().items[0]

    const tarif = Math.round((3_000_000 / 173) * 1.5)
    const expectedNilai = 2 * tarif // jam_lembur = 120/60 = 2 jam
    const line = item.detail_breakdown.komponen_tunjangan.find(
      (c: { komponen: string }) => c.komponen === 'Tunjangan Lembur',
    )
    expect(line.nilai).toBe(expectedNilai)
    expect(item.total_tunjangan).toBe(expectedNilai)
    expect(item.take_home).toBe(Math.round(3_000_000 + expectedNilai - 30_000 - 90_000))
  })
})
import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceRecords,
  employees,
  notificationLog,
  pushDevices,
  reminderSettings,
  shiftAssignments,
  shiftReminderLog,
  shifts,
  users,
} from '../src/db/schema.js'
import { resetPushProviderCache } from '../src/lib/push-service.js'
import { runTick } from '../src/lib/shift-reminder-scheduler.js'

let ctx: TestCtx

afterEach(() => {
  resetPushProviderCache()
  ctx?.cleanup()
})

let ktpCounter = 0
function makeNoKtp(): string {
  ktpCounter += 1
  return '6677889911' + String(200000 + ktpCounter)
}

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function atHour(hour: number, minute = 0): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0)
}

interface Seed {
  employeeId: string
  assignmentId: string
  userId: string
}

async function seedPublishedShift(published = true): Promise<Seed> {
  const emp = ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: 'Siti',
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
  const user = ctx.db.db.select().from(users).where(eq(users.email, 'siti@demo.com')).get()!
  ctx.db.db.update(users).set({ employee_id: emp.id }).where(eq(users.id, user.id)).run()

  const shift = ctx.db.db
    .insert(shifts)
    .values({ business_id: ctx.businessId, nama_shift: 'Pagi', jam_mulai: '09:00', jam_selesai: '17:00', aktif: true })
    .returning()
    .get()

  const assignment = ctx.db.db
    .insert(shiftAssignments)
    .values({ employee_id: emp.id, shift_id: shift.id, tanggal: todayStr(), published })
    .returning()
    .get()

  ctx.db.db
    .insert(pushDevices)
    .values({ user_id: user.id, business_id: ctx.businessId, platform: 'android', token: 'fcm-shift-token' })
    .run()

  return { employeeId: emp.id, assignmentId: assignment.id, userId: user.id }
}

const tick = () => new Promise((r) => setTimeout(r, 80))

describe('ticket #71 — scheduler pengingat shift', () => {
  it('menembak sekali per assignment pada jendela + menulis log + mengirim notifikasi', async () => {
    ctx = await setupTest()
    const seed = await seedPublishedShift()

    const fired = runTick(atHour(8, 35)) // window 08:30 (lead 30, start 09:00)
    expect(fired).toBe(1)

    const logs = ctx.db.db.select().from(shiftReminderLog).all()
    expect(logs).toHaveLength(1)
    expect(logs[0].assignment_id).toBe(seed.assignmentId)

    await tick()
    const pushes = ctx.db.db.select().from(notificationLog).all()
    expect(pushes).toHaveLength(1)
    expect(pushes[0].kind).toBe('shift_reminder')
    const payload = JSON.parse(String(pushes[0].payload_json))
    expect(payload.assignmentId).toBe(seed.assignmentId)
    expect(payload.kind).toBe('shift_reminder')
  })

  it('belum masuk jendela → tidak menembak', async () => {
    ctx = await setupTest()
    await seedPublishedShift()
    const fired = runTick(atHour(8, 0)) // jendela 08:30, belum
    expect(fired).toBe(0)
    expect(ctx.db.db.select().from(shiftReminderLog).all()).toHaveLength(0)
  })

  it('restart tidak menembak dua kali (idempotensi via shift_reminder_log)', async () => {
    ctx = await setupTest()
    await seedPublishedShift()

    expect(runTick(atHour(8, 35))).toBe(1)
    // "Restart" = tick baru pada jendela yang sama — baris log sudah ada.
    expect(runTick(atHour(8, 50))).toBe(0)
    expect(runTick(atHour(9, 0))).toBe(0) // shift sudah mulai pula
    expect(ctx.db.db.select().from(shiftReminderLog).all()).toHaveLength(1)
  })

  it('shift dibatalkan (unpublished) → tidak menembak', async () => {
    ctx = await setupTest()
    await seedPublishedShift(false)
    const fired = runTick(atHour(8, 35))
    expect(fired).toBe(0)
    expect(ctx.db.db.select().from(shiftReminderLog).all()).toHaveLength(0)
    expect(ctx.db.db.select().from(notificationLog).all()).toHaveLength(0)
  })

  it('pengingat dimatikan user → tidak menembak', async () => {
    ctx = await setupTest()
    const seed = await seedPublishedShift()
    ctx.db.db
      .insert(reminderSettings)
      .values({ user_id: seed.userId, shift_reminders_enabled: false, reminder_lead_minutes: 30 })
      .run()

    const fired = runTick(atHour(8, 35))
    expect(fired).toBe(0)
    expect(ctx.db.db.select().from(shiftReminderLog).all()).toHaveLength(0)
  })

  it('shift sudah di-clock-in → tidak menembak', async () => {
    ctx = await setupTest()
    const { employeeId } = await seedPublishedShift()
    ctx.db.db
      .insert(attendanceRecords)
      .values({
        employee_id: employeeId,
        tanggal: todayStr(),
        clock_in: new Date().toISOString(),
        status: 'hadir',
      })
      .run()

    const fired = runTick(atHour(8, 35))
    expect(fired).toBe(0)
    expect(ctx.db.db.select().from(shiftReminderLog).all()).toHaveLength(0)
  })

  it('lead time dari reminder_settings dipakai (60 menit) + body menyebut 60 menit', async () => {
    ctx = await setupTest()
    const { userId } = await seedPublishedShift()
    ctx.db.db
      .insert(reminderSettings)
      .values({ user_id: userId, shift_reminders_enabled: true, reminder_lead_minutes: 60 })
      .run()

    // Dengan lead 60, jendela 08:00 — 08:20 sudah lewat jendela.
    const fired = runTick(atHour(8, 20))
    expect(fired).toBe(1)
    await tick()

    const push = ctx.db.db.select().from(notificationLog).get()!
    const { _n } = JSON.parse(String(push.payload_json))
    expect(_n.body).toContain('09:00')
    expect(_n.body).toContain('60 menit lagi')
  })
})
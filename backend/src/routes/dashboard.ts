import type { FastifyInstance } from 'fastify'
import { and, asc, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import {
  attendanceRecords,
  employees,
  leaveRequests,
  leaveTypes,
  payrollItems,
  payrollRuns,
  payslips,
  shiftAssignments,
  shifts,
} from '../db/schema.js'
import { currentUser, requireAuth } from '../lib/auth.js'
import { ApiError, ForbiddenError } from '../lib/errors.js'

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function currentMonthStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { db } = getDb()
    const q = req.query as Record<string, unknown>

    if (user.role === 'owner') {
      const today = localDateStr(new Date())
      const end = localDateStr(new Date(Date.now() + 2 * 86400000))
      const month = currentMonthStr(new Date())

      if (q.employee_id !== undefined) {
        throw new ForbiddenError('Owner tidak boleh memfilter dashboard per karyawan.')
      }

      const attendanceRows = db
        .select({
          status: attendanceRecords.status,
          c: sql<number>`count(*)`,
        })
        .from(attendanceRecords)
        .innerJoin(employees, eq(attendanceRecords.employee_id, employees.id))
        .where(and(eq(employees.business_id, user.business_id), eq(attendanceRecords.tanggal, today)))
        .groupBy(attendanceRecords.status)
        .all()

      const todayAttendance = { hadir: 0, telat: 0, absen: 0, izin: 0 }
      for (const r of attendanceRows) {
        if (r.status === 'hadir') todayAttendance.hadir = r.c
        else if (r.status === 'telat') todayAttendance.telat = r.c
        else if (r.status === 'absen') todayAttendance.absen = r.c
        else if (r.status === 'izin') todayAttendance.izin = r.c
      }

      const pendingLeaveRows = db
        .select({
          request: leaveRequests,
          employee_name: employees.nama_lengkap,
          leave_type_name: leaveTypes.nama_jenis_cuti,
        })
        .from(leaveRequests)
        .innerJoin(employees, eq(leaveRequests.employee_id, employees.id))
        .innerJoin(leaveTypes, eq(leaveRequests.leave_type_id, leaveTypes.id))
        .where(
          and(
            eq(employees.business_id, user.business_id),
            eq(leaveRequests.status, 'pending'),
          ),
        )
        .orderBy(desc(leaveRequests.created_at))
        .limit(5)
        .all()

      const upcomingShiftRows = db
        .select({
          employee_name: employees.nama_lengkap,
          shift_name: shifts.nama_shift,
          jam_mulai: shifts.jam_mulai,
          jam_selesai: shifts.jam_selesai,
          tanggal: shiftAssignments.tanggal,
        })
        .from(shiftAssignments)
        .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
        .innerJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
        .where(
          and(
            eq(employees.business_id, user.business_id),
            eq(shiftAssignments.published, true),
            gte(shiftAssignments.tanggal, today),
            lte(shiftAssignments.tanggal, end),
          ),
        )
        .orderBy(asc(shiftAssignments.tanggal))
        .all()

      const paySums = db
        .select({
          totalGaji: sql<number>`coalesce(sum(${payrollRuns.total_gaji}), 0)`,
          takeHome: sql<number>`coalesce(sum(${payrollRuns.take_home}), 0)`,
        })
        .from(payrollRuns)
        .where(and(eq(payrollRuns.business_id, user.business_id), eq(payrollRuns.periode, month)))
        .get()

      const lastRun = db
        .select({ periode: payrollRuns.periode })
        .from(payrollRuns)
        .where(eq(payrollRuns.business_id, user.business_id))
        .orderBy(desc(payrollRuns.created_at))
        .limit(1)
        .get()

      const totalKaryawan = db
        .select({ c: count() })
        .from(employees)
        .where(eq(employees.business_id, user.business_id))
        .get()?.c ?? 0
      const totalAktif = db
        .select({ c: count() })
        .from(employees)
        .where(and(eq(employees.business_id, user.business_id), eq(employees.status, 'aktif')))
        .get()?.c ?? 0

      return {
        today_attendance: todayAttendance,
        pending_leaves: pendingLeaveRows.map((r) => ({
          id: r.request.id,
          employee: { nama: r.employee_name },
          leave_type: r.leave_type_name,
          tanggal_mulai: r.request.tanggal_mulai,
          tanggal_selesai: r.request.tanggal_selesi,
          alasan: r.request.alasan,
          created_at: r.request.created_at,
        })),
        upcoming_shifts: upcomingShiftRows.map((r) => ({
          employee: { nama: r.employee_name, avatar: null },
          shift: r.shift_name,
          tanggal: r.tanggal,
          jam_mulai: r.jam_mulai,
          jam_selesai: r.jam_selesai,
        })),
        payroll_summary: {
          current_month_total: paySums?.totalGaji ?? 0,
          current_month_take_home: paySums?.takeHome ?? 0,
          last_run_periode: lastRun?.periode ?? null,
        },
        metrics: { total_karyawan: totalKaryawan, total_aktif: totalAktif },
      }
    }

    if (q.employee_id !== undefined) {
      throw new ForbiddenError('Anda hanya dapat melihat data diri Anda sendiri.')
    }

    if (!user.employee_id) {
      throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
    }
    const employeeId = user.employee_id

    const today = localDateStr(new Date())
    const end = localDateStr(new Date(Date.now() + 2 * 86400000))

    const myToday = db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, employeeId), eq(attendanceRecords.tanggal, today)))
      .get()

    const upcomingShiftRows = db
      .select({
        shift_name: shifts.nama_shift,
        jam_mulai: shifts.jam_mulai,
        jam_selesai: shifts.jam_selesai,
        tanggal: shiftAssignments.tanggal,
      })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
      .where(
        and(
          eq(shiftAssignments.employee_id, employeeId),
          eq(shiftAssignments.published, true),
          gte(shiftAssignments.tanggal, today),
          lte(shiftAssignments.tanggal, end),
        ),
      )
      .orderBy(asc(shiftAssignments.tanggal))
      .all()

    const recentPayslipRows = db
      .select({
        periode: payrollRuns.periode,
        take_home: payrollItems.take_home,
        pdf_url: payslips.pdf_url,
      })
      .from(payslips)
      .innerJoin(payrollItems, eq(payslips.payroll_item_id, payrollItems.id))
      .innerJoin(payrollRuns, eq(payrollItems.payroll_run_id, payrollRuns.id))
      .where(
        and(
          eq(payrollRuns.business_id, user.business_id),
          eq(payrollItems.employee_id, employeeId),
        ),
      )
      .orderBy(desc(payrollRuns.periode))
      .limit(3)
      .all()

    return {
      my_today: myToday
        ? {
            clock_in: myToday.clock_in,
            clock_out: myToday.clock_out,
            status: myToday.status,
            late_minutes: myToday.late_minutes,
            catatan: myToday.catatan,
          }
        : null,
      upcoming_shifts: upcomingShiftRows.map((r) => ({
        shift: r.shift_name,
        tanggal: r.tanggal,
        jam_mulai: r.jam_mulai,
        jam_selesai: r.jam_selesai,
      })),
      my_recent_payslips: recentPayslipRows.map((r) => ({
        periode: r.periode,
        take_home: r.take_home,
        pdf_url: r.pdf_url,
      })),
    }
  })
}

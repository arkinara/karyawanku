import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  KONTRAK_LABEL,
  api,
  type Employee,
} from '@/lib/api-client'
import {
  findLeaveTypeIdByName,
  hitungDurasi,
  mapLeaveBalances,
  mapLeaveRequest,
  type BeLeaveBalanceResponse,
  type BeLeaveRequest,
} from '@/lib/leave-adapter'
import {
  emptyPayrollRun,
  gross,
  mapPayrollRun,
  potongan,
  summarize,
  takeHome,
  type BePayrollItem,
  type BePayrollRunResponse,
} from '@/lib/payroll-adapter'
import {
  breakdownOf,
  composePayslip,
  formatPeriode,
  type BePayslipDetail,
  type BePayslipRow,
} from '@/lib/payslips-adapter'
import {
  activeShifts,
  buildCellMatrix,
  getWeekStart,
  weekDates,
  weekPublishMeta,
  type BeShift,
  type BeShiftAssignment,
} from '@/lib/shifts-adapter'
import { mapAttendanceRow, toClockTime, type BeAttendanceRecord } from '@/lib/attendance-adapter'

// Structural stand-in for the (non-exported) BE payslip item detail shape.
interface BePayslipItemDetailLocal {
  id: string
  payroll_run_id: string
  employee_id: string
  gaji_pokok: number
  total_tunjangan: number
  total_bpjs_kesehatan: number
  total_bpjs_tk: number
  pph21: number
  koreksi: number
  catatan_koreksi: string | null
  take_home: number
  detail_breakdown: Record<string, unknown> | null
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Adapter smoke tests — employees (api-client)', () => {
  it('api.get /api/employees melewati payload BE dan KONTRAK_LABEL memetakan enum', async () => {
    const items = [
      {
        id: '1', business_id: 'b', nama_lengkap: 'Budi Santoso', no_ktp: '3201234567890001',
        npwp: null, tanggal_lahir: '1990-01-01', jenis_kelamin: 'L', alamat: null,
        kontak_darurat: null, tanggal_masuk: '2023-01-12', jenis_kontrak: 'pkwtt',
        status: 'aktif', ptkp_status: null, custom_fields: null,
      },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => json({ items, total: 1, page: 1, limit: 100, has_more: false })))
    const res = await api.get<{ items: Array<Record<string, unknown>> }>('/api/employees')
    expect(res.items).toHaveLength(1)
    expect(res.items[0].nama_lengkap).toBe('Budi Santoso')
    expect(KONTRAK_LABEL.pkwtt).toBe('PKWTT')
    expect(KONTRAK_LABEL.pkwt).toBe('PKWT')
    expect(KONTRAK_LABEL.harian).toBe('Harian')
    expect(KONTRAK_LABEL.magang).toBe('Magang')
  })

  it('response 500 → apiRequest melempar ApiError dengan pesan BE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { message: 'Internal Server Error' } }, 500)),
    )
    const promise = api.get('/api/employees')
    await expect(promise).rejects.toThrow(ApiError)
    await expect(promise).rejects.toThrow('Internal Server Error')
  })
})

describe('Adapter smoke tests — leave', () => {
  it('mapLeaveRequest: snake_case BE → camelCase FE, durasi inclusive, status dipetakan', () => {
    const be: BeLeaveRequest = {
      id: 'lrv-01', employee_id: 'e1', employee_name: 'Budi Santoso',
      leave_type_id: 'lt-tahunan', leave_type_name: 'Cuti Tahunan',
      tanggal_mulai: '2026-08-25', tanggal_selesai: '2026-08-27',
      alasan: 'Perayaan keluarga', status: 'disetujui',
      approver_user_id: 'u1', catatan_approver: 'Disetujui.',
      created_at: '2026-08-20T00:00:00Z', decided_at: null,
    }
    const mapped = mapLeaveRequest(be)
    expect(mapped).toMatchObject({
      id: 'lrv-01', employeeId: 'e1', nama: 'Budi Santoso',
      jenis: 'tahunan', tanggalMulai: '2026-08-25', tanggalSelesai: '2026-08-27',
      durasi: 3, status: 'approved', catatan: 'Disetujui.', alasan: 'Perayaan keluarga',
    })
  })

  it('mapLeaveRequest: status ditolak → rejected, nama kosong → fallback', () => {
    const mapped = mapLeaveRequest({
      id: 'lrv-02', employee_id: 'e2', employee_name: '',
      leave_type_id: 'lt-izin', leave_type_name: 'Cuti Izin',
      tanggal_mulai: '2026-09-01', tanggal_selesai: '2026-09-01',
      alasan: null, status: 'ditolak', approver_user_id: 'u1',
      catatan_approver: 'Ditolak.', created_at: '', decided_at: null,
    })
    expect(mapped.status).toBe('rejected')
    expect(mapped.nama).toBe('Karyawan')
    expect(mapped.alasan).toBe('')
  })

  it('mapLeaveBalances: mengelompokkan kuota/terpakai per jenis', () => {
    const be: BeLeaveBalanceResponse = {
      employee_id: 'e1', tahun: 2026,
      balances: [
        { id: 'b1', employee_id: 'e1', leave_type_id: 'lt-tahunan', nama_jenis_cuti: 'Cuti Tahunan', tahun: 2026, kuota_hari: 12, terpakai_hari: 2, sisa_hari: 10 },
        { id: 'b2', employee_id: 'e1', leave_type_id: 'lt-sakit', nama_jenis_cuti: 'Cuti Sakit', tahun: 2026, kuota_hari: 5, terpakai_hari: 1, sisa_hari: 4 },
      ],
    }
    const balance = mapLeaveBalances(be)
    expect(balance.tahunan).toEqual({ kuota: 12, terpakai: 2 })
    expect(balance.sakit).toEqual({ kuota: 5, terpakai: 1 })
    expect(balance.izin).toEqual({ kuota: 0, terpakai: 0 })
  })

  it('findLeaveTypeIdByName: nama tak dikenal fallback ke tahunan', () => {
    expect(findLeaveTypeIdByName('Cuti Tahunan')).toBe('tahunan')
    expect(findLeaveTypeIdByName('Cuti Sakit')).toBe('sakit')
    expect(findLeaveTypeIdByName('Cuti Melahirkan')).toBe('melahirkan')
    expect(findLeaveTypeIdByName('Custom Nama')).toBe('tahunan')
  })

  it('hitungDurasi: hitungan inklusif (mulai === selesai → 1)', () => {
    expect(hitungDurasi('2026-08-25', '2026-08-25')).toBe(1)
    expect(hitungDurasi('2026-08-25', '2026-08-27')).toBe(3)
    expect(hitungDurasi('2026-08-27', '2026-08-25')).toBe(0)
  })
})

describe('Adapter smoke tests — payslips', () => {
  const row: BePayslipRow = {
    id: 'ps-1', pdf_url: null, created_at: '2026-08-19T08:00:00Z',
    periode: '2026-08', status: 'disetujui', payroll_item_id: 'pi-1', take_home: 2420000,
    employee: { id: 'e1', nama_lengkap: 'Budi Santoso' },
  }

  it('composePayslip: breakdown detail dipakai → tunjangan/potongan/take-home', () => {
    const item: BePayslipItemDetailLocal = {
      id: 'pi-1', payroll_run_id: 'pr-1', employee_id: 'e1', gaji_pokok: 2600000,
      total_tunjangan: 300000, total_bpjs_kesehatan: 26000, total_bpjs_tk: 52000,
      pph21: 402000, koreksi: 0, catatan_koreksi: null, take_home: 2420000,
      detail_breakdown: {
        tunjangan: [{ nama: 'Tunjangan Transport', nominal: 200000 }, { nama: 'Tunjangan Makan', nominal: 100000 }],
        potongan: [{ nama: 'BPJS Kesehatan', nominal: 26000 }, { nama: 'PPh 21', nominal: 402000 }],
        penyesuaian: 0,
        catatan: '',
      },
    }
    const p = composePayslip(row, item)
    expect(p.nama).toBe('Budi Santoso')
    expect(p.period).toBe('2026-08')
    expect(p.tunjangan).toEqual([
      { nama: 'Tunjangan Transport', nominal: 200000 },
      { nama: 'Tunjangan Makan', nominal: 100000 },
    ])
    expect(p.potongan).toEqual([
      { nama: 'BPJS Kesehatan', nominal: 26000 },
      { nama: 'PPh 21', nominal: 402000 },
    ])
    expect(p.takeHome).toBe(2600000 + 300000 - 26000 - 402000)
  })

  it('composePayslip: breakdown hilang → fallback agregat BPJS + take_home BE', () => {
    const item: BePayslipItemDetailLocal = {
      id: 'pi-1', payroll_run_id: 'pr-1', employee_id: 'e1', gaji_pokok: 2600000,
      total_tunjangan: 0, total_bpjs_kesehatan: 26000, total_bpjs_tk: 52000,
      pph21: 402000, koreksi: 0, catatan_koreksi: null, take_home: 2420000,
      detail_breakdown: null,
    }
    const p = composePayslip(row, item)
    expect(p.tunjangan).toEqual([])
    expect(p.potongan).toEqual([
      { nama: 'BPJS Kesehatan', nominal: 26000 },
      { nama: 'BPJS Ketenagakerjaan', nominal: 52000 },
      { nama: 'PPh 21', nominal: 402000 },
    ])
    // take-home dihitung ulang dari agregat (bukan row.take_home): 2.600.000 + 0 − 480.000.
    expect(p.takeHome).toBe(2120000)
  })

  it('formatPeriode: "2026-07" → "Juli 2026", input rusak dikembalikan apa adanya', () => {
    expect(formatPeriode('2026-07')).toBe('Juli 2026')
    expect(formatPeriode('2026-13')).toBe('2026-13')
  })

  it('breakdownOf: detail kosong → totals null; berisi → totals dipakai', () => {
    expect(breakdownOf(null)).toEqual({ earnings: [], deductions: [], totals: null })
    const detail: BePayslipDetail = {
      id: 'ps-1', payroll_item_id: 'pi-1',
      employee: { id: 'e1', nama: 'Budi Santoso', jabatan: '-' },
      periode: '2026-08',
      breakdown: {
        earnings: [{ nama_komponen: 'Gaji Pokok', nominal: 2600000 }],
        deductions: [{ nama_komponen: 'PPh 21', nominal: 402000 }],
        totals: { total_earnings: 2600000, total_deductions: 402000, take_home: 2198000 },
      },
      totals: { total_earnings: 2600000, total_deductions: 402000, take_home: 2198000 },
      pdf_url: '',
    }
    const bd = breakdownOf(detail)
    expect(bd.earnings).toEqual([{ nama: 'Gaji Pokok', nominal: 2600000 }])
    expect(bd.deductions).toEqual([{ nama: 'PPh 21', nominal: 402000 }])
    expect(bd.totals?.take_home).toBe(2198000)
  })
})

describe('Adapter smoke tests — shifts', () => {
  const shift: BeShift = {
    id: 's-pagi', business_id: 'b', nama_shift: 'Pagi',
    jam_mulai: '08:00', jam_selesai: '16:00', aktif: true,
  }
  const nonaktifShift: BeShift = { ...shift, id: 's-libur', nama_shift: 'Libur', aktif: false }

  it('getWeekStart: Senin untuk tanggal apapun di minggu itu', () => {
    // 2026-08-17 adalah Senin.
    expect(getWeekStart(new Date('2026-08-17T10:00:00'))).toBe('2026-08-17')
    // 2026-08-18 adalah Selasa — tetap kembali ke Senin 17.
    expect(getWeekStart(new Date('2026-08-18T10:00:00'))).toBe('2026-08-17')
    // 2026-08-22 adalah Sabtu — tetap Senin 17.
    expect(getWeekStart(new Date('2026-08-22T10:00:00'))).toBe('2026-08-17')
    // 2026-08-23 adalah Minggu — tetap Senin 17.
    expect(getWeekStart(new Date('2026-08-23T10:00:00'))).toBe('2026-08-17')
  })

  it('weekDates: 7 tanggal Senin–Minggu', () => {
    expect(weekDates('2026-08-17')).toEqual([
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
      '2026-08-21', '2026-08-22', '2026-08-23',
    ])
  })

  it('buildCellMatrix: assignment diletakkan di hari yang benar, karyawan lain kosong', () => {
    const assignment: BeShiftAssignment = {
      id: 'a1', employee_id: 'e1', employee_name: 'Budi Santoso',
      shift_id: 's-pagi', shift, tanggal: '2026-08-19', published: true,
      published_at: '2026-08-18T08:00:00Z', published_by_user_id: 'u1',
    }
    const employees = [{ id: 'e1' }, { id: 'e2' }] as Employee[]
    const matrix = buildCellMatrix([assignment], '2026-08-17', employees)
    // Assignment di Rabu (index 2, Senin 17 → Rabu 19).
    expect(matrix[0][2]).toEqual({ assignmentId: 'a1', shiftId: 's-pagi' })
    // Hari lain & karyawan lain tetap Libur.
    expect(matrix[0][0]).toEqual({ assignmentId: null, shiftId: null })
    expect(matrix[1][2]).toEqual({ assignmentId: null, shiftId: null })
  })

  it('weekPublishMeta: published dari baris pertama yang sudah publish', () => {
    const draft: BeShiftAssignment = {
      id: 'a2', employee_id: 'e1', employee_name: 'Budi Santoso',
      shift_id: 's-pagi', shift, tanggal: '2026-08-18', published: false,
      published_at: null, published_by_user_id: null,
    }
    expect(weekPublishMeta([draft])).toEqual({ published: false, publishedAt: null, publishedByUserId: null })
    expect(weekPublishMeta([draft, { ...draft, id: 'a1', published: true, published_at: '2026-08-18T08:00:00Z', published_by_user_id: 'u1' }])).toEqual({
      published: true, publishedAt: '2026-08-18T08:00:00Z', publishedByUserId: 'u1',
    })
  })

  it('activeShifts: menyaring shift nonaktif', () => {
    expect(activeShifts([shift, nonaktifShift])).toEqual([shift])
  })
})

describe('Adapter smoke tests — attendance', () => {
  const record: BeAttendanceRecord = {
    id: 'att-1', employee_id: 'e1', tanggal: '2026-08-18',
    clock_in: '2026-08-18T00:05:00Z', clock_out: null,
    catatan: null, status: 'telat', late_minutes: 5, is_manual: false,
  }

  it('mapAttendanceRow: status/late_minutes/jam berasal dari server', () => {
    const row = mapAttendanceRow({ id: 'e1', nama_lengkap: 'Budi Santoso', no_ktp: '123' }, record, '2026-08-18')
    expect(row.nama).toBe('Budi Santoso')
    expect(row.status).toBe('telat')
    expect(row.lateMinutes).toBe(5)
    expect(row.clockIn).toMatch(/^\d{2}:\d{2}$/)
    expect(row.clockOut).toBeNull()
    expect(row.isManual).toBe(false)
  })

  it('mapAttendanceRow: tanpa record → absen, jam kosong, id sintetis', () => {
    const row = mapAttendanceRow({ id: 'e1', nama_lengkap: 'Budi Santoso', no_ktp: '123' }, null, '2026-08-18')
    expect(row.status).toBe('absen')
    expect(row.clockIn).toBeNull()
    expect(row.id).toBe('att-e1-2026-08-18')
  })

  it('toClockTime: null / tanggal invalid → null', () => {
    expect(toClockTime(null)).toBeNull()
    expect(toClockTime('not-a-date')).toBeNull()
  })
})

describe('Adapter smoke tests — payroll', () => {
  const item: BePayrollItem = {
    id: 'pi-1', payroll_run_id: 'pr-1', employee_id: 'e1',
    gaji_pokok: 2600000, total_tunjangan: 300000,
    total_bpjs_kesehatan: 26000, total_bpjs_tk: 52000, pph21: 402000,
    koreksi: 100000, catatan_koreksi: 'lembur belum tercatat', take_home: 2520000,
    detail_breakdown: {
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 200000 }, { nama: 'Tunjangan Makan', nominal: 100000 }],
      potongan: [{ nama: 'BPJS Kesehatan', nominal: 26000 }, { nama: 'PPh 21', nominal: 402000 }],
      penyesuaian: 100000,
      catatan: 'lembur belum tercatat',
    },
    employee: { id: 'e1', nama_lengkap: 'Budi Santoso' },
  }

  const beRun: BePayrollRunResponse = {
    run: {
      id: 'pr-1', business_id: 'b', periode: '2026-08', status: 'disetujui',
      total_gaji: 2900000, total_potongan: 480000, take_home: 2520000,
      approved_at: '2026-08-20T08:00:00Z', approved_by_user_id: 'u1',
      created_at: '2026-08-19T08:00:00Z', updated_at: '2026-08-20T08:00:00Z',
    },
    items: [item],
  }

  it('mapPayrollRun: run+items snake_case → PayrollRun camelCase', () => {
    const run = mapPayrollRun(beRun)
    expect(run.period).toBe('2026-08')
    expect(run.status).toBe('approved')
    expect(run.items).toHaveLength(1)
    const mapped = run.items[0]
    expect(mapped).toMatchObject({
      employeeId: 'e1', nama: 'Budi Santoso', gajiPokok: 2600000,
      tunjangan: [{ nama: 'Tunjangan Transport', nominal: 200000 }, { nama: 'Tunjangan Makan', nominal: 100000 }],
      penyesuaian: 100000,
    })
    expect(mapped.potongan.length).toBe(2)
  })

  it('mapPayrollRun: breakdown hilang → fallback agregat + koreksi', () => {
    const run = mapPayrollRun({
      ...beRun,
      items: [{ ...item, detail_breakdown: null, total_tunjangan: 300000 }],
    })
    const mapped = run.items[0]
    expect(mapped.tunjangan).toEqual([{ nama: 'Tunjangan', nominal: 300000 }])
    expect(mapped.potongan).toEqual([
      { nama: 'BPJS Kesehatan', nominal: 26000 },
      { nama: 'BPJS Ketenagakerjaan', nominal: 52000 },
      { nama: 'PPh 21', nominal: 402000 },
    ])
    expect(mapped.penyesuaian).toBe(item.koreksi)
  })

  it('helper murni: gross / potongan / takeHome / summarize', () => {
    const mapped = mapPayrollRun(beRun).items[0]
    expect(gross(mapped)).toBe(2600000 + 300000)
    expect(potongan(mapped)).toBe(26000 + 402000)
    expect(takeHome(mapped)).toBe(gross(mapped) - potongan(mapped) + mapped.penyesuaian)
    const summary = summarize(mapPayrollRun(beRun))
    expect(summary.count).toBe(1)
    expect(summary.totalTakeHome).toBe(takeHome(mapped))
  })

  it('emptyPayrollRun: run kosong status draft', () => {
    const run = emptyPayrollRun('2026-08')
    expect(run.period).toBe('2026-08')
    expect(run.status).toBe('draft')
    expect(run.items).toEqual([])
  })
})
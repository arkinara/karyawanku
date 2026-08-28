import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'
import BerandaPage from '@/app/beranda/page'

const ownerDashboard = {
  today_attendance: { hadir: 10, telat: 2, absen: 0, izin: 0 },
  pending_leaves: [
    {
      id: 'lv-1',
      employee: { nama: 'Siti Nurhaliza' },
      leave_type: 'Cuti Tahunan',
      tanggal_mulai: '2026-08-22',
      tanggal_selesai: '2026-08-23',
      alasan: 'Liburan keluarga',
      created_at: 1,
    },
    {
      id: 'lv-2',
      employee: { nama: 'Budi Prasetyo' },
      leave_type: 'Izin Sakit',
      tanggal_mulai: '2026-08-20',
      tanggal_selesai: '2026-08-20',
      alasan: 'Demam',
      created_at: 2,
    },
  ],
  upcoming_shifts: [],
  payroll_summary: {
    current_month_total: 28_500_000,
    current_month_take_home: 22_750_000,
    last_run_periode: '2026-07',
  },
  metrics: { total_karyawan: 12, total_aktif: 11 },
}

const employeeDashboard = {
  my_today: {
    clock_in: '2026-08-19T08:00:00',
    clock_out: null,
    status: 'hadir',
    late_minutes: 0,
    catatan: null,
  },
  upcoming_shifts: [
    { shift: 'Pagi', tanggal: '2026-08-20', jam_mulai: '07:00', jam_selesai: '15:00' },
    { shift: 'Siang', tanggal: '2026-08-21', jam_mulai: '15:00', jam_selesai: '23:00' },
  ],
  my_recent_payslips: [{ periode: '2026-07', take_home: 3_500_000, pdf_url: null }],
}

const employeeDashboardNoCheckin = {
  ...employeeDashboard,
  my_today: null,
  upcoming_shifts: [],
  my_recent_payslips: [],
}

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/mock-path',
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'kk-user',
    JSON.stringify({
      id: 'usr-test',
      business_id: 'biz-test',
      nama: 'Pak Darmawan',
      email: 'owner@usaha.com',
      role: 'owner',
      employee_id: null,
    }),
  )
  localStorage.setItem('kk-token', 'test-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/dashboard')) {
        return new Response(JSON.stringify(ownerDashboard), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
})

describe('Quick Dashboard (Owner)', () => {
  it('menampilkan judul halaman yang menyapa Pak Darmawan', async () => {
    render(<DashboardPage />)
    expect(screen.getByText('Selamat pagi, Pak Darmawan')).toBeInTheDocument()
    expect(screen.getByText('Ringkasan hari ini')).toBeInTheDocument()
  })

  it('merender metric card dengan nilai dari /api/dashboard', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Total karyawan')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Hadir hari ini')).toBeInTheDocument()
    expect(screen.getByText('/12')).toBeInTheDocument()
    expect(screen.getByText('Cuti menunggu')).toBeInTheDocument()
    expect(screen.getByText('Gaji bulan ini')).toBeInTheDocument()
    expect(screen.getByText('Rp 28.500.000')).toBeInTheDocument()
  })

  it('merender priority banner ketika ada cuti menunggu', async () => {
    render(<DashboardPage />)
    await waitFor(() =>
      expect(
        screen.getByText('2 pengajuan cuti menunggu keputusan Anda'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: 'Tinjau' })).toBeInTheDocument()
  })

  it('merender ringkasan kehadiran dengan 4 statistik', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Kehadiran Hari Ini')).toBeInTheDocument())
    expect(screen.getByText('Hadir')).toBeInTheDocument()
    expect(screen.getByText('Telat')).toBeInTheDocument()
    expect(screen.getByText('Absen')).toBeInTheDocument()
    expect(screen.getByText('Izin')).toBeInTheDocument()
  })

  it('merender daftar cuti menunggu dengan item dari BE', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Cuti Menunggu Persetujuan')).toBeInTheDocument())
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
    expect(screen.getByText('Budi Prasetyo')).toBeInTheDocument()
    expect(screen.getAllByText('Cuti Tahunan').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Izin Sakit').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Setujui' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Tolak' })).toHaveLength(2)
  })

  it('merender 3 kartu aksi cepat', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Rekap absensi')).toBeInTheDocument())
    expect(screen.getByText('Tambah karyawan')).toBeInTheDocument()
    expect(screen.getByText('Jalankan payroll')).toBeInTheDocument()
  })
})

describe('Quick Dashboard (Employee)', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('kk-token', 'test-token')
    localStorage.setItem(
      'kk-user',
      JSON.stringify({
        id: 'usr-test',
        business_id: 'biz-test',
        nama: 'Budi Santoso',
        email: 'b@usaha.com',
        role: 'employee',
        employee_id: '1',
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/dashboard')) {
          return new Response(JSON.stringify(employeeDashboard), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
  })

  it('merender widget check-in, jadwal 3 hari, dan slip gaji terakhir dari API', async () => {
    render(<BerandaPage />)
    await waitFor(() => expect(screen.getByText('Sedang bekerja')).toBeInTheDocument())
    expect(screen.getByText(/Check-in sejak/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument()
    expect(screen.getByText('Jadwal 3 Hari ke Depan')).toBeInTheDocument()
    expect(screen.getAllByText('Pagi').length).toBeGreaterThan(0)
    expect(screen.getByText('Slip Gaji Terakhir')).toBeInTheDocument()
    expect(screen.getByText('Periode 2026-07')).toBeInTheDocument()
    expect(screen.getByText('Rp 3.500.000')).toBeInTheDocument()
  })

  it('tombol Clock In mengirim POST clock-in lalu refetch dashboard', async () => {
    localStorage.setItem(
      'kk-user',
      JSON.stringify({
        id: 'usr-test',
        business_id: 'biz-test',
        nama: 'Budi Santoso',
        email: 'b@usaha.com',
        role: 'employee',
        employee_id: '1',
      }),
    )
    let checkedIn = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/attendance/clock-in') && init?.method === 'POST') {
          checkedIn = true
          return new Response(JSON.stringify({ record: { id: 'r' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        if (url.includes('/api/dashboard')) {
          return new Response(JSON.stringify(checkedIn ? employeeDashboard : employeeDashboardNoCheckin), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    const { container } = render(<BerandaPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clock In' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument())
    expect(container.querySelector('table')).toBeNull()
  })
})
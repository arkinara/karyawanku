import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'
import EmployeesPage from '@/app/employees/page'
import LeavePage from '@/app/leave/page'
import { AppShell } from '@/components/ui/app-shell'
import { capabilitiesForRole } from '@/lib/role-capabilities'
import { getNavForRole, roleHome } from '@/lib/nav-config'

const managerUser = {
  id: 'usr-mgr',
  business_id: 'biz-test',
  nama: 'Rina Permata',
  email: 'manager@usaha.com',
  role: 'manager',
  employee_id: null,
}

const managerDashboard = {
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
  ],
  upcoming_shifts: [
    {
      employee: { nama: 'Budi Santoso', avatar: null },
      shift: 'Pagi',
      tanggal: '2026-08-20',
      jam_mulai: '07:00',
      jam_selesai: '15:00',
    },
    {
      employee: { nama: 'Siti Nurhaliza', avatar: null },
      shift: 'Siang',
      tanggal: '2026-08-21',
      jam_mulai: '15:00',
      jam_selesai: '23:00',
    },
  ],
  payroll_summary: {
    current_month_total: 28_500_000,
    current_month_take_home: 22_750_000,
    last_run_periode: '2026-07',
  },
  metrics: { total_karyawan: 12, total_aktif: 11 },
}

const employeesPayload = [
  { id: '1', nama_lengkap: 'Budi Santoso', no_ktp: '3201234567890001', jenis_kontrak: 'pkwtt', status: 'aktif', tanggal_masuk: '2023-01-12', jenis_kelamin: 'L', tanggal_lahir: '1990-01-01', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
  { id: '2', nama_lengkap: 'Siti Nurhaliza', no_ktp: '3201234567890002', jenis_kontrak: 'pkwtt', status: 'aktif', tanggal_masuk: '2023-03-03', jenis_kelamin: 'P', tanggal_lahir: '1992-02-02', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
]

const leaveRequestsPayload = {
  items: [
    {
      id: 'lrv-01',
      employee_id: '1',
      employee_name: 'Budi Santoso',
      leave_type_id: 'lt-tahunan',
      leave_type_name: 'Cuti Tahunan',
      tanggal_mulai: '2026-08-25',
      tanggal_selesai: '2026-08-25',
      alasan: 'Perayaan keluarga',
      status: 'pending',
      approver_user_id: null,
      catatan_approver: null,
      created_at: '2026-08-20T00:00:00Z',
      decided_at: null,
    },
  ],
}

function stubFetch(payloads: { dashboard?: unknown; employees?: unknown; leaves?: unknown } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/dashboard')) {
        return new Response(JSON.stringify(payloads.dashboard ?? managerDashboard), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/employees')) {
        return new Response(JSON.stringify({ items: payloads.employees ?? employeesPayload }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/leave-requests')) {
        return new Response(JSON.stringify(payloads.leaves ?? leaveRequestsPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

function setManagerSession() {
  window.localStorage.setItem('kk-token', 'test-token')
  window.localStorage.setItem('kk-user', JSON.stringify(managerUser))
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Capability matrix (ticket #50)', () => {
  it('setiap role mengembalikan capability set yang benar', () => {
    const owner = capabilitiesForRole('owner')
    expect(owner).toEqual({
      canViewPayroll: true,
      canRunPayroll: true,
      canEditEmployees: true,
      canViewEmployees: true,
      canApproveLeave: true,
      canPublishRoster: true,
      canEditBusinessProfile: true,
      canManageUsers: true,
      canEditSalaryComponents: true,
    })

    const manager = capabilitiesForRole('manager')
    expect(manager.canViewEmployees).toBe(true)
    expect(manager.canApproveLeave).toBe(true)
    expect(manager.canPublishRoster).toBe(true)
    expect(manager.canManageUsers).toBe(true)
    expect(manager.canEditEmployees).toBe(false)
    expect(manager.canViewPayroll).toBe(false)
    expect(manager.canRunPayroll).toBe(false)
    expect(manager.canEditBusinessProfile).toBe(false)
    expect(manager.canEditSalaryComponents).toBe(false)

    const employee = capabilitiesForRole('employee')
    expect(employee.canViewPayroll).toBe(false)
    expect(employee.canRunPayroll).toBe(false)
    expect(employee.canEditEmployees).toBe(false)
    expect(employee.canViewEmployees).toBe(false)
    expect(employee.canApproveLeave).toBe(false)
    expect(employee.canPublishRoster).toBe(false)
    expect(employee.canEditBusinessProfile).toBe(false)
    expect(employee.canManageUsers).toBe(false)
    expect(employee.canEditSalaryComponents).toBe(false)
  })

  it('role tidak dikenal jatuh ke capability employee (paling aman)', () => {
    expect(capabilitiesForRole('superadmin' as never)).toEqual(capabilitiesForRole('employee'))
  })
})

describe('Manager landing page', () => {
  it('manager sign-in lands on /dashboard, bukan /beranda', () => {
    expect(roleHome('manager')).toBe('/dashboard')
    expect(roleHome('owner')).toBe('/dashboard')
    expect(roleHome('employee')).toBe('/beranda')
  })

  it('manager nav tidak mengandung payroll atau settings', () => {
    const nav = getNavForRole('manager')
    for (const item of [...nav.primary, ...nav.secondary]) {
      expect(item.href).not.toMatch(/^\/payroll/)
      expect(item.href).not.toMatch(/^\/settings/)
    }
  })

  it('app shell manager menampilkan nav operasional tanpa payroll', () => {
    setManagerSession()
    render(
      <AppShell userRole="manager" activeNav="dashboard" title="Ringkasan hari ini">
        <p>Konten</p>
      </AppShell>,
    )
    const rail = screen.getByRole('navigation', { name: 'Navigasi utama' })
    for (const label of ['Ringkasan', 'Absensi', 'Cuti', 'Jadwal Shift', 'Karyawan']) {
      expect(within(rail).getByText(label)).toBeInTheDocument()
    }
    expect(within(rail).queryByText('Payroll')).not.toBeInTheDocument()
    expect(within(rail).queryByText('Pengaturan')).not.toBeInTheDocument()
  })
})

describe('Manager dashboard', () => {
  beforeEach(() => {
    setManagerSession()
    stubFetch()
  })

  it('manager melihat kehadiran tim + antrean persetujuan cuti', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Kehadiran Hari Ini')).toBeInTheDocument())
    expect(screen.getByText('Cuti Menunggu Persetujuan')).toBeInTheDocument()
    expect(screen.getByText('Hadir')).toBeInTheDocument()
    expect(screen.getAllByText('Siti Nurhaliza').length).toBeGreaterThan(0)
  })

  it('manager melihat jadwal shift 3 hari ke depan', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Jadwal Shift 3 Hari ke Depan')).toBeInTheDocument())
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Pagi')).toBeInTheDocument()
    expect(screen.getByText('Siang')).toBeInTheDocument()
  })

  it('manager TIDAK melihat total karyawan, payroll, atau aksi jalankan payroll', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Kehadiran Hari Ini')).toBeInTheDocument())
    expect(screen.queryByText('Total karyawan')).not.toBeInTheDocument()
    expect(screen.queryByText('Gaji bulan ini')).not.toBeInTheDocument()
    expect(screen.queryByText('Jalankan payroll')).not.toBeInTheDocument()
    expect(screen.queryByText('Rp 28.500.000')).not.toBeInTheDocument()
  })
})

describe('Manager leave approvals', () => {
  beforeEach(() => {
    setManagerSession()
    stubFetch()
  })

  it('manager melihat antrean persetujuan cuti di /leave', async () => {
    render(<LeavePage />)
    const queue = await waitFor(() => screen.getByTestId('approval-queue'))
    await waitFor(() => {
      expect(within(queue).getByText('Cuti Menunggu Persetujuan')).toBeInTheDocument()
      expect(within(queue).getByRole('button', { name: 'Setujui' })).toBeInTheDocument()
      expect(within(queue).getByRole('button', { name: 'Tolak' })).toBeInTheDocument()
    })
  })
})

describe('Manager employee directory (read-only)', () => {
  beforeEach(() => {
    setManagerSession()
    stubFetch()
  })

  it('manager melihat daftar karyawan tetapi tanpa aksi edit/hapus/tambah', async () => {
    render(<EmployeesPage />)
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tambah Karyawan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Budi Santoso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hapus Budi Santoso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nonaktifkan Budi Santoso' })).not.toBeInTheDocument()
  })
})
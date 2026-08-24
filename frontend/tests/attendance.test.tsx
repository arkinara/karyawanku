import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import AttendancePage from '@/app/attendance/page'
import { computeStatus } from '@/lib/attendance-status'
import { OfflineQueue } from '@/lib/offline-queue'

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    api: {
      get: getMock,
      post: postMock,
      patch: vi.fn(),
      delete: vi.fn(),
      upload: vi.fn(),
      download: vi.fn(),
    },
  }
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const employees = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  nama_lengkap: ['Budi Santoso', 'Siti Nurhaliza', 'Ahmad Fauzi', 'Dewi Lestari', 'Rudi Hermawan', 'Maya Sari', 'Fajar Nugraha', 'Lestari Wulandari', 'Indra Permadi', 'Ratna Sari', 'Hendro Wibowo', 'Ani Rahmawati'][i],
  no_ktp: `KTP-${i + 1}`,
  status: 'aktif',
}))

// Attendance state machine shared by the owner + employee mocks.
const state = {
  today: null as {
    id: string
    employee_id: string
    tanggal: string
    clock_in: string | null
    clock_out: string | null
    catatan: string | null
    status: string
    late_minutes: number | null
  } | null,
}

const defaultUser = { id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }

function isIsoClockIn(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function setupApiMocks() {
  state.today = null

  getMock.mockImplementation(async (path: string, query?: Record<string, unknown>) => {
    if (path.includes('/api/auth/me')) {
      const stored = localStorage.getItem('kk-user')
      return { user: stored ? JSON.parse(stored) : defaultUser }
    }
    if (path.includes('/api/employees')) {
      return { employees, total: employees.length }
    }
    if (path.includes('/api/attendance/today')) {
      return { record: state.today }
    }
    const match = path.match(/\/api\/attendance\/employee\/(\d+)/)
    if (match) {
      const id = match[1]
      const today = todayIso()
      const index = Number(id) - 1
      const isLate = index >= 10
      const records = state.today
        ? [state.today]
        : [
            {
              id: `att-${id}`,
              employee_id: id,
              tanggal: today,
              clock_in: `2026-01-01T0${isLate ? '8:20' : '7:45'}:00`,
              clock_out: null,
              catatan: '',
              status: isLate ? 'telat' : 'hadir',
              late_minutes: isLate ? 20 : 0,
            },
          ]
      return { records }
    }
    return {}
  })

  postMock.mockImplementation(async (path: string, body?: Record<string, unknown>) => {
    if (path.includes('/api/attendance/clock-in')) {
      state.today = {
        id: 'att-1',
        employee_id: String(body?.employee_id ?? '1'),
        tanggal: todayIso(),
        clock_in: new Date().toISOString(),
        clock_out: null,
        catatan: (body?.catatan as string | null) ?? null,
        status: 'hadir',
        late_minutes: 0,
      }
      return { record: state.today }
    }
    if (path.includes('/api/attendance/clock-out')) {
      state.today = {
        ...(state.today ?? ({ id: 'att-1', employee_id: '1', tanggal: todayIso(), clock_in: new Date().toISOString(), clock_out: null, catatan: null, status: 'hadir', late_minutes: 0 } as NonNullable<typeof state.today>)),
        clock_out: new Date().toISOString(),
      }
      return { record: state.today }
    }
    return {}
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  getMock.mockClear()
  postMock.mockClear()
  setupApiMocks()
})

describe('Attendance Page — Owner view', () => {
  it('merender 12 baris absensi dari API', async () => {
    const { container, findByText } = render(<AttendancePage />)
    await findByText('Budi Santoso')
    const table = document.querySelector('table')
    expect(table).not.toBeNull()
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(12)
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('menampilkan 4 metric card dengan jumlah dari server', async () => {
    render(<AttendancePage />)
    const summary = await waitFor(() => screen.getByTestId('attendance-summary'))
    await waitFor(() => {
      expect(within(summary).getByText('Hadir')).toBeInTheDocument()
      expect(within(summary).getByText('10')).toBeInTheDocument()
      expect(within(summary).getByText('Telat')).toBeInTheDocument()
      expect(within(summary).getByText('2')).toBeInTheDocument()
      expect(within(summary).getByText('Absen')).toBeInTheDocument()
      expect(within(summary).getByText('Izin')).toBeInTheDocument()
    })
  })

  it('chip status memakai warna sesuai status (hadir/telat)', async () => {
    render(<AttendancePage />)
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
    const hadirChips = screen.getAllByText('Hadir').filter((el) => el.closest('tbody'))
    expect(hadirChips).toHaveLength(10)
    hadirChips.forEach((chip) => expect(chip.className).toContain('bg-emerald-100'))

    const telatChips = screen.getAllByText('Telat').filter((el) => el.closest('tbody'))
    expect(telatChips).toHaveLength(2)
    telatChips.forEach((chip) => expect(chip.className).toContain('bg-amber-100'))
  })

  it('membuka dialog manual entry dan memvalidasi field wajib', async () => {
    render(<AttendancePage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Input Manual' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Input Manual' }))
    expect(screen.getByText('Input Absensi Manual')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(screen.getByText('Pilih karyawan terlebih dahulu')).toBeInTheDocument()
    expect(screen.getByText('Clock in wajib diisi')).toBeInTheDocument()
  })

  it('menyimpan entri manual memanggil POST /api/attendance/manual', async () => {
    render(<AttendancePage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Input Manual' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Input Manual' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(screen.getByLabelText(/Cari karyawan/), { target: { value: 'Budi' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Budi Santoso/ }))
    fireEvent.change(screen.getByLabelText(/Clock In/), { target: { value: '07:15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => {
      expect(screen.queryByText('Input Absensi Manual')).not.toBeInTheDocument()
    })
    expect(postMock).toHaveBeenCalledWith(
      '/api/attendance/manual',
      expect.objectContaining({ employee_id: '1', clock_in: '07:15' }),
    )
  })

  it('dialog menampilkan status otomatis dari jam clock in', async () => {
    render(<AttendancePage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Input Manual' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Input Manual' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(screen.getByLabelText(/Cari karyawan/), { target: { value: 'Budi' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Budi Santoso/ }))
    fireEvent.change(screen.getByLabelText(/Clock In/), { target: { value: '08:45' } })
    expect(within(dialog).getByText('Telat')).toBeInTheDocument()
  })
})

describe('computeStatus — auto-detection', () => {
  it('clock in sebelum 08:00 = hadir tanpa keterlambatan', () => {
    const d = new Date()
    d.setHours(7, 30, 0, 0)
    const result = computeStatus(d)
    expect(result.status).toBe('hadir')
    expect(result.lateMinutes).toBe(0)
  })

  it('clock in setelah 08:00 = telat dengan menit keterlambatan', () => {
    const d = new Date()
    d.setHours(8, 45, 0, 0)
    const result = computeStatus(d)
    expect(result.status).toBe('telat')
    expect(result.lateMinutes).toBe(45)
  })
})

describe('OfflineQueue', () => {
  beforeEach(() => window.localStorage.clear())

  it('enqueue menambahkan entri dan size bertambah', () => {
    const queue = new OfflineQueue<{ type: string }>()
    queue.enqueue({ type: 'clock-in' })
    expect(queue.size()).toBe(1)
    expect(queue.getAll()).toHaveLength(1)
    expect(queue.getAll()[0].submittedAt).not.toBeNull()
  })

  it('markSynced menghapus dari antrean pending', () => {
    const queue = new OfflineQueue<{ type: string }>()
    queue.simulateOffline(true)
    const entry = queue.enqueue({ type: 'clock-in' })
    expect(queue.getPending()).toHaveLength(1)
    queue.markSynced(entry.id)
    expect(queue.getPending()).toHaveLength(0)
  })

  it('persistensi berjalan antar instance', () => {
    const first = new OfflineQueue<{ type: string }>()
    first.enqueue({ type: 'clock-in' })
    const second = new OfflineQueue<{ type: string }>()
    expect(second.size()).toBe(1)
    expect(second.getAll()[0].item).toEqual({ type: 'clock-in' })
  })

  it('flush mengirim entri pending ke api.post', async () => {
    const queue = new OfflineQueue<{ type: string; employeeId?: string }>()
    queue.simulateOffline(true)
    queue.enqueue({ type: 'clock-in', employeeId: '1' })
    expect(queue.getPending()).toHaveLength(1)
    await queue.flush()
    expect(queue.getPending()).toHaveLength(0)
    expect(postMock).toHaveBeenCalledWith(
      '/api/attendance/clock-in',
      expect.objectContaining({ employee_id: '1' }),
    )
  })
})

describe('Attendance Page — Employee view', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('kk-token', 'test-token')
    window.localStorage.setItem(
      'kk-user',
      JSON.stringify({ id: 'u', business_id: 'b', nama: 'Budi Santoso', email: 'b@x', role: 'employee', employee_id: '1' }),
    )
    window.history.replaceState(null, '', '/?role=employee')
    setupApiMocks()
  })

  it('tombol Clock In beralih menjadi Clock Out setelah POST clock-in', async () => {
    render(<AttendancePage />)
    const btn = await waitFor(() => screen.getByRole('button', { name: 'Clock In' }))
    fireEvent.click(btn)

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/api/attendance/clock-in',
        expect.objectContaining({ employee_id: '1' }),
      )
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument()
    })
    expect(screen.getByText('Sedang bekerja')).toBeInTheDocument()
  })

  it('clock in saat offline masuk queue dan auto-sync saat online', async () => {
    render(<AttendancePage />)
    await waitFor(() => screen.getByRole('button', { name: 'Clock In' }))

    window.dispatchEvent(new Event('offline'))
    await waitFor(() => expect(screen.getByText(/Mode offline/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }))

    await waitFor(() => expect(screen.getByText('Menunggu sinkronisasi')).toBeInTheDocument())
    expect(postMock).not.toHaveBeenCalledWith('/api/attendance/clock-in', expect.anything())

    window.dispatchEvent(new Event('online'))
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/api/attendance/clock-in',
        expect.objectContaining({ employee_id: '1' }),
      )
    })
    await waitFor(() => {
      expect(screen.queryByText('Menunggu sinkronisasi')).not.toBeInTheDocument()
    })
  })

  it('double clock in saat offline dicegah (tombol beralih ke Clock Out)', async () => {
    render(<AttendancePage />)
    await waitFor(() => screen.getByRole('button', { name: 'Clock In' }))

    window.dispatchEvent(new Event('offline'))
    await waitFor(() => expect(screen.getByText(/Mode offline/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument()
    })
    expect(screen.getByText('Menunggu sinkronisasi')).toBeInTheDocument()
  })
})

describe('attendance adapter clock time mapping', () => {
  it('mengubah ISO timestamp menjadi HH:mm lokal', async () => {
    const { mapAttendanceRow } = await import('@/lib/attendance-adapter')
    const row = mapAttendanceRow(
      { id: '1', nama_lengkap: 'Budi Santoso', no_ktp: 'KTP-1' },
      {
        id: 'a1',
        employee_id: '1',
        tanggal: '2026-08-01',
        clock_in: '2026-08-01T07:45:00',
        clock_out: null,
        catatan: null,
        status: 'hadir',
        late_minutes: 0,
      },
      '2026-08-01',
    )
    expect(row.clockIn).toBe(isIsoClockIn('2026-08-01T07:45:00'))
    expect(row.status).toBe('hadir')
  })
})
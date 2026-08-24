import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import AttendancePage from '@/app/attendance/page'
import { computeStatus } from '@/lib/attendance-status'
import { timeToDate } from '@/lib/attendance-mock'
import { OfflineQueue } from '@/lib/offline-queue'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  )
})

describe('Attendance Page — Owner view', () => {
  it('merender 12 baris absensi hari ini', () => {
    render(<AttendancePage />)
    const table = document.querySelector('table')
    expect(table).not.toBeNull()
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(12)
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('menampilkan 4 metric card dengan jumlah yang benar', () => {
    render(<AttendancePage />)
    const summary = screen.getByTestId('attendance-summary')
    expect(within(summary).getByText('Hadir')).toBeInTheDocument()
    expect(within(summary).getByText('10')).toBeInTheDocument()
    expect(within(summary).getByText('Telat')).toBeInTheDocument()
    expect(within(summary).getByText('2')).toBeInTheDocument()
    expect(within(summary).getByText('Absen')).toBeInTheDocument()
    expect(within(summary).getByText('Izin')).toBeInTheDocument()
    expect(within(summary).getAllByText('0')).toHaveLength(2)
  })

  it('chip status memakai warna sesuai status (hadir/telat)', () => {
    render(<AttendancePage />)
    const hadirChips = screen.getAllByText('Hadir').filter((el) => el.closest('tbody'))
    expect(hadirChips).toHaveLength(10)
    hadirChips.forEach((chip) => expect(chip.className).toContain('bg-emerald-100'))

    const telatChips = screen.getAllByText('Telat').filter((el) => el.closest('tbody'))
    expect(telatChips).toHaveLength(2)
    telatChips.forEach((chip) => expect(chip.className).toContain('bg-amber-100'))
  })

  it('membuka dialog manual entry dan memvalidasi field wajib', () => {
    render(<AttendancePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Input Manual' }))
    expect(screen.getByText('Input Absensi Manual')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(screen.getByText('Pilih karyawan terlebih dahulu')).toBeInTheDocument()
    expect(screen.getByText('Clock in wajib diisi')).toBeInTheDocument()
  })

  it('menyimpan entri manual dan menambah baris', () => {
    render(<AttendancePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Input Manual' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(screen.getByLabelText(/Cari karyawan/), {
      target: { value: 'Budi' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Budi Santoso/ }))
    fireEvent.change(screen.getByLabelText(/Clock In/), {
      target: { value: '07:15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.queryByText('Input Absensi Manual')).not.toBeInTheDocument()
    const table = document.querySelector('table')
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(13)
  })

  it('dialog menampilkan status otomatis dari jam clock in', () => {
    render(<AttendancePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Input Manual' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(screen.getByLabelText(/Cari karyawan/), {
      target: { value: 'Budi' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Budi Santoso/ }))
    fireEvent.change(screen.getByLabelText(/Clock In/), {
      target: { value: '08:45' },
    })
    expect(within(dialog).getByText('Telat')).toBeInTheDocument()
  })
})

describe('computeStatus — auto-detection', () => {
  it('clock in sebelum 08:00 = hadir tanpa keterlambatan', () => {
    const result = computeStatus(timeToDate(new Date(), '07:30'))
    expect(result.status).toBe('hadir')
    expect(result.lateMinutes).toBe(0)
  })

  it('clock in setelah 08:00 = telat dengan menit keterlambatan', () => {
    const result = computeStatus(timeToDate(new Date(), '08:45'))
    expect(result.status).toBe('telat')
    expect(result.lateMinutes).toBe(45)
  })

  it('tepat 08:00 = hadir, 0 menit telat', () => {
    const result = computeStatus(timeToDate(new Date(), '08:00'))
    expect(result.status).toBe('hadir')
    expect(result.lateMinutes).toBe(0)
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
    expect(queue.size()).toBe(1)
    expect(queue.getAll()[0].submittedAt).not.toBeNull()
  })

  it('persistensi berjalan antar instance', () => {
    const first = new OfflineQueue<{ type: string }>()
    first.enqueue({ type: 'clock-in' })
    const second = new OfflineQueue<{ type: string }>()
    expect(second.size()).toBe(1)
    expect(second.getAll()[0].item).toEqual({ type: 'clock-in' })
  })

  it('kembali online mem-flush antrean pending', () => {
    const queue = new OfflineQueue<{ type: string }>()
    queue.simulateOffline(true)
    queue.enqueue({ type: 'clock-in' })
    expect(queue.getPending()).toHaveLength(1)
    queue.simulateOffline(false)
    expect(queue.getPending()).toHaveLength(0)
    expect(queue.size()).toBe(1)
  })
})

describe('Attendance Page — Employee view', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/?role=employee')
  })

  it('tombol Clock In beralih menjadi Clock Out setelah klik', () => {
    render(<AttendancePage />)
    expect(screen.getByRole('button', { name: 'Clock In' })).toBeInTheDocument()
    expect(screen.getByText('Belum check-in')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }))

    expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument()
    expect(screen.getByText('Sedang bekerja')).toBeInTheDocument()
    expect(screen.getByText('Clock In')).toBeInTheDocument()
  })

  it('clock in saat offline masuk queue dan menunggu sinkronisasi', () => {
    render(<AttendancePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Simulasi offline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }))
    expect(screen.getByText('Menunggu sinkronisasi')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Kembali online' }))
    expect(screen.queryByText('Menunggu sinkronisasi')).not.toBeInTheDocument()
  })

  it('double clock in saat offline dicegah (tombol beralih ke Clock Out)', () => {
    render(<AttendancePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Simulasi offline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }))
    expect(screen.getByRole('button', { name: 'Clock Out' })).toBeInTheDocument()
    expect(screen.getByText('Menunggu sinkronisasi')).toBeInTheDocument()
  })
})
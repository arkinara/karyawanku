import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import LeavePage from '@/app/leave/page'
import { LEAVE_REQUESTS, summarizeLeave } from '@/lib/leave-mock'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Leave Page — Owner view', () => {
  it('merender summary metrics 2 / 5 / 1', () => {
    render(<LeavePage />)
    const summary = screen.getByTestId('leave-summary')
    expect(within(summary).getByText('Total Menunggu')).toBeInTheDocument()
    expect(within(summary).getByText('2')).toBeInTheDocument()
    expect(within(summary).getByText('Disetujui Bulan Ini')).toBeInTheDocument()
    expect(within(summary).getByText('5')).toBeInTheDocument()
    expect(within(summary).getByText('Ditolak Bulan Ini')).toBeInTheDocument()
    expect(within(summary).getByText('1')).toBeInTheDocument()
  })

  it('merender approval queue dengan 2 pending + tombol Setujui/Tolak', () => {
    render(<LeavePage />)
    const queue = screen.getByTestId('approval-queue')
    expect(within(queue).getByText('Cuti Menunggu Persetujuan')).toBeInTheDocument()
    expect(within(queue).getAllByRole('button', { name: 'Setujui' })).toHaveLength(2)
    expect(within(queue).getAllByRole('button', { name: 'Tolak' })).toHaveLength(2)
    expect(within(queue).getByText('Budi Santoso')).toBeInTheDocument()
    expect(within(queue).getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('filter status "Menunggu" menyaring tabel semua pengajuan', () => {
    render(<LeavePage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Menunggu' }))
    const all = screen.getByTestId('all-requests')
    expect(all.querySelectorAll('tbody tr')).toHaveLength(2)

    fireEvent.click(screen.getByRole('tab', { name: 'Disetujui' }))
    const allApproved = screen.getByTestId('all-requests')
    expect(allApproved.querySelectorAll('tbody tr')).toHaveLength(6)
  })

  it('approve mengubah status pending menjadi approved dan menghapus dari queue', () => {
    render(<LeavePage />)
    const queue = screen.getByTestId('approval-queue')
    fireEvent.click(within(queue).getAllByRole('button', { name: 'Setujui' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Setujui Cuti')).toBeInTheDocument()
    expect(within(dialog).getByText('Budi Santoso')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Setujui' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(queue).getAllByRole('button', { name: 'Setujui' })).toHaveLength(1)
    expect(within(queue).queryByText('Budi Santoso')).not.toBeInTheDocument()
  })

  it('reject dengan catatan menampilkan catatan di tabel semua pengajuan', () => {
    render(<LeavePage />)
    const queue = screen.getByTestId('approval-queue')
    fireEvent.click(within(queue).getAllByRole('button', { name: 'Tolak' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Tolak Cuti')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Catatan'), { target: { value: 'Kebutuhan operasional' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tolak' }))

    expect(screen.getByText('Kebutuhan operasional')).toBeInTheDocument()
    expect(within(queue).getAllByRole('button', { name: 'Tolak' })).toHaveLength(1)
  })
})

describe('summarizeLeave — mock metrics', () => {
  it('menghitung 2 pending, 5 disetujui, 1 ditolak bulan berjalan', () => {
    const summary = summarizeLeave(LEAVE_REQUESTS)
    expect(summary.pending).toBe(2)
    expect(summary.approvedThisMonth).toBe(5)
    expect(summary.rejectedThisMonth).toBe(1)
  })
})

describe('Leave Page — Employee view', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/?role=employee')
  })

  it('merender kartu saldo cuti 12/12, 5/5, 3/3', () => {
    render(<LeavePage />)
    const balance = screen.getByTestId('leave-balance')
    expect(within(balance).getByText('Cuti Tahunan')).toBeInTheDocument()
    expect(within(balance).getByText('12/12 hari')).toBeInTheDocument()
    expect(within(balance).getByText('Cuti Sakit')).toBeInTheDocument()
    expect(within(balance).getByText('5/5 hari')).toBeInTheDocument()
    expect(within(balance).getByText('Cuti Izin')).toBeInTheDocument()
    expect(within(balance).getByText('3/3 hari')).toBeInTheDocument()
  })

  it('merender histori pengajuan milik sendiri dengan semua status', () => {
    render(<LeavePage />)
    expect(screen.getByText('Histori Pengajuan')).toBeInTheDocument()
    expect(screen.getAllByText('Cuti Tahunan').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Menunggu').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Disetujui').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ditolak').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Pengganti shift diatur oleh supervisor/)).toBeInTheDocument()
  })

  it('membuka dialog Ajukan Cuti dan memvalidasi field wajib', () => {
    render(<LeavePage />)
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Ajukan Cuti')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Kirim Pengajuan' }))

    expect(screen.getByText('Tanggal mulai wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Tanggal selesai wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Alasan wajib diisi')).toBeInTheDocument()
  })

  it('tanggal_selesai sebelum tanggal_mulai menampilkan error', () => {
    render(<LeavePage />)
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))

    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/), { target: { value: '2026-08-24' } })
    fireEvent.change(screen.getByLabelText(/Tanggal Selesai/), { target: { value: '2026-08-20' } })

    expect(
      screen.getByText('Tanggal selesai harus setelah atau sama dengan tanggal mulai'),
    ).toBeInTheDocument()
  })

  it('pengajuan melebihi saldo menampilkan peringatan kuota tidak cukup', () => {
    render(<LeavePage />)
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))

    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/), { target: { value: '2026-08-24' } })
    fireEvent.change(screen.getByLabelText(/Tanggal Selesai/), { target: { value: '2026-09-06' } })

    expect(
      screen.getByText(/Sisa saldo Cuti Tahunan tidak cukup/),
    ).toBeInTheDocument()
  })

  it('submit valid menambahkan entri pending ke histori', () => {
    render(<LeavePage />)
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))

    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/), { target: { value: '2026-08-24' } })
    fireEvent.change(screen.getByLabelText(/Tanggal Selesai/), { target: { value: '2026-08-25' } })
    fireEvent.change(screen.getByLabelText(/Alasan/), {
      target: { value: 'Urusan keluarga mendadak' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Urusan keluarga mendadak')).toBeInTheDocument()
    const pendingChips = screen.getAllByText('Menunggu')
    expect(pendingChips.length).toBeGreaterThanOrEqual(2)
  })
})
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import ShiftsPage from '@/app/shifts/page'
import {
  __resetShiftStore,
  formatWeekLabel,
  getWeekStart,
  publishWeek,
  shiftWeek,
} from '@/lib/shifts-mock'

beforeEach(() => {
  __resetShiftStore()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Shifts Page — Owner view', () => {
  it('grid editor merender 12 baris × 7 kolom shift', () => {
    render(<ShiftsPage />)
    const grid = screen.getByTestId('shift-grid')
    const rows = grid.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(12)
    rows.forEach((row) => {
      expect(row.querySelectorAll('select')).toHaveLength(7)
    })
    expect(grid.querySelectorAll('tbody select')).toHaveLength(84)
  })

  it('menampilkan status draft untuk minggu berjalan', () => {
    render(<ShiftsPage />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Publikasikan Jadwal' }),
    ).toBeInTheDocument()
  })

  it('perubahan select pada sel memperbarui state sel', () => {
    render(<ShiftsPage />)
    const grid = screen.getByTestId('shift-grid')
    const firstSelect = grid.querySelector('tbody tr td select') as HTMLSelectElement
    fireEvent.change(firstSelect, { target: { value: 'malam' } })
    expect(firstSelect.value).toBe('malam')
    expect(firstSelect.className).toContain('bg-amber')
  })

  it('tombol publish mengubah status minggu menjadi dipublikasikan', () => {
    render(<ShiftsPage />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publikasikan Jadwal' }))
    expect(screen.getByText('Dipublikasikan')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  it('navigasi prev/next memperbarui rentang minggu', () => {
    render(<ShiftsPage />)
    const current = getWeekStart()
    const label = screen.getByTestId('week-label')

    fireEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }))
    expect(label.textContent).toBe(formatWeekLabel(shiftWeek(current, 1)))

    fireEvent.click(screen.getByRole('button', { name: 'Minggu sebelumnya' }))
    expect(label.textContent).toBe(formatWeekLabel(shiftWeek(current, 0)))
  })
})

describe('Shifts Page — Employee view', () => {
  beforeEach(() => {
    __resetShiftStore()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/?role=employee')
  })

  it('menampilkan hanya shift miliknya sendiri (7 hari, bukan grid penuh)', () => {
    publishWeek(getWeekStart())
    render(<ShiftsPage />)
    const list = screen.getByTestId('my-shifts')
    expect(list.querySelectorAll('li')).toHaveLength(7)
    // Karyawan demo = Siti Nurhaliza, baris index 1 => hari Senin = Siang.
    const firstBadge = list.querySelector('li span')
    expect(firstBadge?.textContent).toContain('Siang')
    expect(screen.queryByTestId('shift-grid')).not.toBeInTheDocument()
  })

  it('minggu belum dipublikasikan menampilkan empty state (tidak ada shift)', () => {
    render(<ShiftsPage />)
    expect(screen.getByText('Tidak ada shift terjadwal minggu ini')).toBeInTheDocument()
    expect(screen.queryByTestId('my-shifts')).not.toBeInTheDocument()
  })

  it('tidak menampilkan tombol edit/swap (read-only)', () => {
    publishWeek(getWeekStart())
    render(<ShiftsPage />)
    expect(screen.queryByRole('button', { name: 'Publikasikan Jadwal' })).not.toBeInTheDocument()
    expect(screen.queryByText('Terapkan pola ke semua')).not.toBeInTheDocument()
  })
})

describe('Shifts Page — legenda', () => {
  it('menampilkan legenda dengan 4 opsi shift', () => {
    render(<ShiftsPage />)
    const legend = screen.getByTestId('shift-legend')
    expect(within(legend).getByText('Pagi')).toBeInTheDocument()
    expect(within(legend).getByText('Siang')).toBeInTheDocument()
    expect(within(legend).getByText('Malam')).toBeInTheDocument()
  })
})

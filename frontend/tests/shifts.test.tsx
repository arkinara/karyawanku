import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ShiftsPage from '@/app/shifts/page'
import type { BeShiftAssignment } from '@/lib/shifts-adapter'
import { formatWeekLabel, getWeekStart, shiftWeek } from '@/lib/shifts-mock'

// BE-shaped payloads — the page maps these into its camelCase FE shapes.
const shiftsPayload = {
  shifts: [
    { id: 's-pagi', business_id: 'b', nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00', aktif: true },
    { id: 's-siang', business_id: 'b', nama_shift: 'Siang', jam_mulai: '12:00', jam_selesai: '20:00', aktif: true },
    { id: 's-malam', business_id: 'b', nama_shift: 'Malam', jam_mulai: '16:00', jam_selesai: '00:00', aktif: true },
    { id: 's-libur', business_id: 'b', nama_shift: 'Libur', jam_mulai: '00:00', jam_selesai: '00:00', aktif: true },
  ],
}

// 12 employees × 7 days for the demo week — Sidi (emp id 2) Senin = Siang.
function buildAssignments(): { assignments: BeShiftAssignment[] } {
  const employees = [
    { id: '1', name: 'Budi Santoso' },
    { id: '2', name: 'Siti Nurhaliza' },
    { id: '3', name: 'Ahmad Fauzi' },
    { id: '4', name: 'Dewi Lestari' },
    { id: '5', name: 'Rudi Hermawan' },
    { id: '6', name: 'Maya Sari' },
    { id: '7', name: 'Fajar Nugraha' },
    { id: '8', name: 'Lina Marlina' },
    { id: '9', name: 'Indra Permadi' },
    { id: '10', name: 'Yusuf Hidayat' },
    { id: '11', name: 'Ratna Dewi' },
    { id: '12', name: 'Hendra Kusuma' },
  ]
  const pattern = [
    ['pagi', 'pagi', 'pagi', 'siang', 'siang', 'libur', 'libur'],
    ['siang', 'siang', 'malam', 'pagi', 'pagi', 'pagi', 'libur'],
    ['malam', 'malam', 'malam', 'pagi', 'pagi', 'libur', 'libur'],
    ['pagi', 'pagi', 'siang', 'siang', 'malam', 'malam', 'libur'],
    ['libur', 'pagi', 'pagi', 'siang', 'siang', 'pagi', 'pagi'],
    ['siang', 'malam', 'pagi', 'pagi', 'pagi', 'libur', 'siang'],
    ['pagi', 'pagi', 'malam', 'malam', 'malam', 'libur', 'libur'],
    ['libur', 'libur', 'pagi', 'pagi', 'siang', 'siang', 'pagi'],
    ['siang', 'siang', 'pagi', 'pagi', 'pagi', 'libur', 'libur'],
    ['malam', 'malam', 'siang', 'pagi', 'pagi', 'pagi', 'libur'],
    ['pagi', 'pagi', 'libur', 'siang', 'siang', 'malam', 'malam'],
    ['libur', 'libur', 'siang', 'siang', 'pagi', 'pagi', 'pagi'],
  ]
  const shiftByName: Record<string, string> = {
    pagi: 's-pagi',
    siang: 's-siang',
    malam: 's-malam',
    libur: 's-libur',
  }
  const week = getWeekStart()
  const out: Array<ReturnType<typeof buildAssignments>['assignments'][number]> = []
  let counter = 0
  for (let e = 0; e < employees.length; e += 1) {
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(`${week}T00:00:00`)
      day.setDate(day.getDate() + d)
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      const key = pattern[e][d]
      const shiftName = key === 'pagi' ? 'Pagi' : key === 'siang' ? 'Siang' : key === 'malam' ? 'Malam' : 'Libur'
      out.push({
        id: `as-${counter}`,
        employee_id: employees[e].id,
        employee_name: employees[e].name,
        shift_id: shiftByName[key],
        shift: {
          id: shiftByName[key],
          business_id: 'b',
          nama_shift: shiftName,
          jam_mulai: '00:00',
          jam_selesai: '00:00',
          aktif: true,
        },
        tanggal: iso,
        published: false,
        published_at: null,
        published_by_user_id: null,
      })
      counter += 1
    }
  }
  return { assignments: out }
}

function stubOwnerFetch(extraAssignments: BeShiftAssignment[] = []) {
  const { assignments } = buildAssignments()
  const all: BeShiftAssignment[] = [...assignments, ...extraAssignments]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/shifts')) {
        return new Response(JSON.stringify(shiftsPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/shift-assignments')) {
        return new Response(JSON.stringify({ assignments: all }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/roster/publish')) {
        return new Response(JSON.stringify({ updated: all.length }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

function stubEmployeeFetch(opts: { published?: boolean } = {}) {
  const { assignments } = buildAssignments()
  // For the employee view we only return Siti's (id 2) assignments.
  const sidiAssignments = assignments.filter((a) => a.employee_id === '2').map((a) => ({
    ...a,
    published: opts.published ?? false,
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/shift-assignments')) {
        return new Response(JSON.stringify({ assignments: sidiAssignments }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  window.localStorage.setItem('kk-token', 'test-token')
  window.localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
})

describe('Shifts Page — Owner view', () => {
  beforeEach(() => stubOwnerFetch())

  it('grid editor merender 12 baris × 7 kolom shift', async () => {
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => {
      const rows = grid.querySelectorAll('tbody tr')
      expect(rows).toHaveLength(12)
      rows.forEach((row) => {
        expect(row.querySelectorAll('select')).toHaveLength(7)
      })
      expect(grid.querySelectorAll('tbody select')).toHaveLength(84)
    })
  })

  it('menampilkan status draft untuk minggu berjalan', async () => {
    render(<ShiftsPage />)
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Publikasikan Jadwal' })).toBeInTheDocument()
    })
  })

  it('perubahan select pada sel memperbarui state sel', async () => {
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))
    const firstSelect = grid.querySelector('tbody tr td select') as HTMLSelectElement
    fireEvent.change(firstSelect, { target: { value: 'malam' } })
    await waitFor(() => {
      expect(firstSelect.value).toBe('malam')
      expect(firstSelect.className).toContain('bg-amber')
    })
  })

  it('tombol publish mengubah status minggu menjadi dipublikasikan', async () => {
    render(<ShiftsPage />)
    await waitFor(() => screen.getByText('Draft'))
    fireEvent.click(screen.getByRole('button', { name: 'Publikasikan Jadwal' }))
    await waitFor(() => {
      expect(screen.getByText('Dipublikasikan')).toBeInTheDocument()
      expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    })
  })

  it('navigasi prev/next memperbarui rentang minggu', async () => {
    render(<ShiftsPage />)
    const current = getWeekStart()
    const label = await waitFor(() => screen.getByTestId('week-label'))

    fireEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }))
    await waitFor(() => {
      expect(label.textContent).toBe(formatWeekLabel(shiftWeek(current, 1)))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Minggu sebelumnya' }))
    await waitFor(() => {
      expect(label.textContent).toBe(formatWeekLabel(shiftWeek(current, 0)))
    })
  })
})

describe('Shifts Page — Employee view', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?role=employee')
  })

  it('menampilkan hanya shift miliknya sendiri (7 hari, bukan grid penuh)', async () => {
    stubEmployeeFetch({ published: true })
    render(<ShiftsPage />)
    const list = await waitFor(() => screen.getByTestId('my-shifts'))
    await waitFor(() => {
      expect(list.querySelectorAll('li')).toHaveLength(7)
      // Karyawan demo = Siti Nurhaliza (id 2), Senin (idx 0) = Siang.
      const firstBadge = list.querySelector('li span')
      expect(firstBadge?.textContent).toContain('Siang')
      expect(screen.queryByTestId('shift-grid')).not.toBeInTheDocument()
    })
  })

  it('minggu belum dipublikasikan menampilkan empty state (tidak ada shift)', async () => {
    stubEmployeeFetch({ published: false })
    render(<ShiftsPage />)
    await waitFor(() => {
      expect(screen.getByText('Tidak ada shift terjadwal minggu ini')).toBeInTheDocument()
      expect(screen.queryByTestId('my-shifts')).not.toBeInTheDocument()
    })
  })

  it('tidak menampilkan tombol edit/swap (read-only)', async () => {
    stubEmployeeFetch({ published: true })
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('my-shifts'))
    expect(screen.queryByRole('button', { name: 'Publikasikan Jadwal' })).not.toBeInTheDocument()
    expect(screen.queryByText('Terapkan pola ke semua')).not.toBeInTheDocument()
  })
})

describe('Shifts Page — legenda', () => {
  beforeEach(() => stubOwnerFetch())

  it('menampilkan legenda dengan 4 opsi shift', async () => {
    render(<ShiftsPage />)
    const legend = await waitFor(() => screen.getByTestId('shift-legend'))
    await waitFor(() => {
      expect(within(legend).getByText('Pagi')).toBeInTheDocument()
      expect(within(legend).getByText('Siang')).toBeInTheDocument()
      expect(within(legend).getByText('Malam')).toBeInTheDocument()
    })
  })
})

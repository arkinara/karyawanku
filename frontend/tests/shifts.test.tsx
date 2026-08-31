import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ShiftsPage from '@/app/shifts/page'
import type { BeShift, BeShiftAssignment } from '@/lib/shifts-adapter'
import { formatWeekLabel, getWeekStart, shiftWeek, weekEndIso } from '@/lib/shifts-adapter'

const shiftsPayload: BeShift[] = [
  { id: 's-pagi', business_id: 'b', nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00', aktif: true },
  { id: 's-siang', business_id: 'b', nama_shift: 'Siang', jam_mulai: '12:00', jam_selesai: '20:00', aktif: true },
  { id: 's-malam', business_id: 'b', nama_shift: 'Malam', jam_mulai: '16:00', jam_selesai: '00:00', aktif: true },
  { id: 's-libur', business_id: 'b', nama_shift: 'Libur', jam_mulai: '00:00', jam_selesai: '00:00', aktif: true },
]

const employeesPayload = [
  { id: '1', nama_lengkap: 'Budi Santoso', no_ktp: '3201', status: 'aktif' },
  { id: '2', nama_lengkap: 'Siti Nurhaliza', no_ktp: '3273', status: 'aktif' },
  { id: '3', nama_lengkap: 'Ahmad Fauzi', no_ktp: '3578', status: 'aktif' },
  { id: '4', nama_lengkap: 'Dewi Lestari', no_ktp: '3275', status: 'aktif' },
  { id: '5', nama_lengkap: 'Rudi Hermawan', no_ktp: '3101', status: 'aktif' },
  { id: '6', nama_lengkap: 'Maya Sari', no_ktp: '3174', status: 'aktif' },
  { id: '7', nama_lengkap: 'Fajar Nugraha', no_ktp: '3578', status: 'aktif' },
  { id: '8', nama_lengkap: 'Lina Marlina', no_ktp: '3275', status: 'aktif' },
  { id: '9', nama_lengkap: 'Indra Permadi', no_ktp: '3578', status: 'aktif' },
  { id: '10', nama_lengkap: 'Yusuf Hidayat', no_ktp: '3174', status: 'aktif' },
  { id: '11', nama_lengkap: 'Ratna Dewi', no_ktp: '3275', status: 'aktif' },
  { id: '12', nama_lengkap: 'Hendra Kusuma', no_ktp: '3578', status: 'aktif' },
  // Nonaktif employee must be filtered out of the roster grid.
  { id: '99', nama_lengkap: 'Pensiun Wati', no_ktp: '9999', status: 'nonaktif' },
]

function dayIso(weekStart: string, offset: number): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 12 employees × 7 days. Libur cells are left unassigned (no row) so those
// cells exercise the POST path on edit; assigned cells exercise PATCH.
const PATTERN = [
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

const SHIFT_ID_BY_KEY: Record<string, string> = {
  pagi: 's-pagi',
  siang: 's-siang',
  malam: 's-malam',
  libur: 's-libur',
}

function buildAssignments(): BeShiftAssignment[] {
  const week = getWeekStart()
  const out: BeShiftAssignment[] = []
  let counter = 0
  for (let e = 0; e < 12; e += 1) {
    for (let d = 0; d < 7; d += 1) {
      const key = PATTERN[e][d]
      if (key === 'libur') continue
      const id = SHIFT_ID_BY_KEY[key]
      const shift = shiftsPayload.find((s) => s.id === id)!
      out.push({
        id: `as-${counter}`,
        employee_id: String(e + 1),
        employee_name: employeesPayload[e].nama_lengkap,
        shift_id: id,
        shift,
        tanggal: dayIso(week, d),
        published: false,
        published_at: null,
        published_by_user_id: null,
      })
      counter += 1
    }
  }
  return out
}

interface StubState {
  shifts: BeShift[]
  assignments: BeShiftAssignment[]
  users: Array<{ id: string; nama: string }>
  /** Mark returned assignments as published (employee view sees a published week). */
  publishAssignments: boolean
  fail: {
    postAssignments: boolean
    patchAssignments: boolean
    deleteAssignments: boolean
    postShifts: boolean
    patchShifts: boolean
    deleteShifts: boolean
    publish: boolean
  }
}

type Call = { method: string; url: string; body?: Record<string, unknown> }

function createStub(
  state: Partial<Omit<StubState, 'fail'>> & { fail?: Partial<StubState['fail']> } = {},
) {
  const calls: Call[] = []
  const full: StubState = {
    shifts: [...shiftsPayload],
    assignments: buildAssignments(),
    users: [{ id: 'u', nama: 'Pak Darmawan' }],
    publishAssignments: false,
    ...state,
    fail: {
      postAssignments: false,
      patchAssignments: false,
      deleteAssignments: false,
      postShifts: false,
      patchShifts: false,
      deleteShifts: false,
      publish: false,
      ...(state.fail ?? {}),
    },
  }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined
    calls.push({ method, url, body })

    if (method === 'GET' && url.includes('/api/employees')) {
      return json({ items: employeesPayload })
    }
    if (method === 'GET' && url.includes('/api/shifts?')) {
      return json({ shifts: full.shifts })
    }
    if (method === 'POST' && url.includes('/api/shifts')) {
      if (full.fail.postShifts) return json({ error: { message: 'Gagal simpan shift' } }, 500)
      const shift: BeShift = {
        id: `s-${full.shifts.length + 1}`,
        business_id: 'b',
        nama_shift: body?.nama_shift as BeShift['nama_shift'],
        jam_mulai: String(body?.jam_mulai),
        jam_selesai: String(body?.jam_selesai),
        aktif: (body?.aktif as boolean) ?? true,
      }
      full.shifts = [...full.shifts, shift]
      return json({ shift })
    }
    if (method === 'PATCH' && url.includes('/api/shifts/')) {
      if (full.fail.patchShifts) return json({ error: { message: 'Gagal ubah shift' } }, 500)
      const id = url.split('/api/shifts/')[1].split('?')[0]
      full.shifts = full.shifts.map((s) => (s.id === id ? { ...s, ...(body as Partial<BeShift>) } : s))
      return json({ shift: full.shifts.find((s) => s.id === id) })
    }
    if (method === 'DELETE' && url.includes('/api/shifts/')) {
      if (full.fail.deleteShifts) return json({ error: { message: 'Gagal hapus shift' } }, 500)
      const id = url.split('/api/shifts/')[1].split('?')[0]
      full.shifts = full.shifts.map((s) => (s.id === id ? { ...s, aktif: false } : s))
      return json({ ok: true })
    }

    if (method === 'GET' && url.includes('/api/shift-assignments')) {
      let items = full.assignments
      const empMatch = url.match(/employee_id=(\d+)/)
      if (empMatch) items = items.filter((a) => a.employee_id === empMatch[1])
      if (full.publishAssignments) {
        items = items.map((a) => ({
          ...a,
          published: true,
          published_at: a.published_at ?? new Date().toISOString(),
          published_by_user_id: a.published_by_user_id ?? 'u',
        }))
      }
      return json({
        items,
        total: items.length,
        page: 1,
        limit: 100,
        has_more: false,
      })
    }
    if (method === 'POST' && url.includes('/api/shift-assignments')) {
      if (full.fail.postAssignments) return json({ error: { message: 'Gagal simpan penugasan' } }, 500)
      const assignment: BeShiftAssignment = {
        id: `as-new-${full.assignments.length}`,
        employee_id: String(body?.employee_id),
        employee_name: employeesPayload.find((e) => e.id === String(body?.employee_id))?.nama_lengkap ?? '',
        shift_id: String(body?.shift_id),
        shift: full.shifts.find((s) => s.id === body?.shift_id) ?? null,
        tanggal: String(body?.tanggal),
        published: false,
        published_at: null,
        published_by_user_id: null,
      }
      full.assignments = [...full.assignments, assignment]
      return json({ assignment })
    }
    if (method === 'PATCH' && url.includes('/api/shift-assignments/')) {
      if (full.fail.patchAssignments) return json({ error: { message: 'Gagal ubah penugasan' } }, 500)
      const id = url.split('/api/shift-assignments/')[1].split('?')[0]
      full.assignments = full.assignments.map((a) =>
        a.id === id
          ? {
              ...a,
              shift_id: String(body?.shift_id),
              shift: full.shifts.find((s) => s.id === body?.shift_id) ?? a.shift,
            }
          : a,
      )
      return json({ assignment: full.assignments.find((a) => a.id === id) })
    }
    if (method === 'DELETE' && url.includes('/api/shift-assignments/')) {
      if (full.fail.deleteAssignments) return json({ error: { message: 'Gagal hapus penugasan' } }, 500)
      const id = url.split('/api/shift-assignments/')[1].split('?')[0]
      full.assignments = full.assignments.filter((a) => a.id !== id)
      return json({ ok: true })
    }

    if (method === 'GET' && url.includes('/api/users')) {
      return json({ items: full.users })
    }
    if (method === 'POST' && url.includes('/api/roster/publish')) {
      if (full.fail.publish) return json({ error: { message: 'Gagal publikasi' } }, 500)
      const now = new Date().toISOString()
      full.assignments = full.assignments.map((a) => ({
        ...a,
        published: true,
        published_at: now,
        published_by_user_id: 'u',
      }))
      return json({ updated: full.assignments.length, published_at: now, published_by_user_id: 'u' })
    }

    return json({})
  })

  return { calls, full, fetchMock }
}

function setSession(role: 'owner' | 'manager' | 'employee') {
  window.localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'User', email: 'u@x', role }),
  )
}

function gridSelects(grid: HTMLElement): HTMLSelectElement[] {
  return Array.from(grid.querySelectorAll('tbody tr td select'))
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  window.localStorage.setItem('kk-token', 'test-token')
  setSession('owner')
})

describe('Shifts Page — shift catalogue wiring', () => {
  it('memuat katalog shift dari GET /api/shifts', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const legend = await waitFor(() => screen.getByTestId('shift-legend'))
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'GET' && c.url.includes('/api/shifts?'))).toBe(true)
      expect(within(legend).getByText('Pagi')).toBeInTheDocument()
      expect(within(legend).getByText('Siang')).toBeInTheDocument()
      expect(within(legend).getByText('Malam')).toBeInTheDocument()
    })
  })

  it('membuat shift memanggil POST /api/shifts dan me-refetch katalog', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('shift-grid'))
    const before = calls.filter((c) => c.method === 'GET' && c.url.includes('/api/shifts?')).length

    fireEvent.click(screen.getByRole('button', { name: 'Tambah shift' }))
    fireEvent.change(await screen.findByLabelText(/Nama shift/), { target: { value: 'Siang' } })
    fireEvent.change(screen.getByLabelText(/Jam mulai/), { target: { value: '13:00' } })
    fireEvent.change(screen.getByLabelText(/Jam selesai/), { target: { value: '21:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tambah' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.includes('/api/shifts'))
      expect(post).toBeTruthy()
      expect(post?.body).toMatchObject({
        nama_shift: 'Siang',
        jam_mulai: '13:00',
        jam_selesai: '21:00',
        aktif: true,
      })
      expect(calls.filter((c) => c.method === 'GET' && c.url.includes('/api/shifts?'))).toHaveLength(before + 1)
    })
    const legend = screen.getByTestId('shift-legend')
    await waitFor(() => {
      expect(within(legend).getByText('13:00-21:00')).toBeInTheDocument()
    })
  })

  it('mengedit shift memanggil PATCH /api/shifts/:id dan me-refetch', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('shift-grid'))

    fireEvent.click(screen.getByRole('button', { name: 'Edit shift Pagi' }))
    fireEvent.change(await screen.findByLabelText(/Jam mulai/), { target: { value: '08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/api/shifts/s-pagi'))
      expect(patch).toBeTruthy()
      expect(patch?.body).toMatchObject({ nama_shift: 'Pagi', jam_mulai: '08:00', jam_selesai: '15:00' })
      expect(calls.filter((c) => c.method === 'GET' && c.url.includes('/api/shifts?'))).toHaveLength(2)
    })
  })

  it('menonaktifkan shift memanggil DELETE /api/shifts/:id dan me-refetch', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('shift-grid'))

    fireEvent.click(screen.getByRole('button', { name: 'Hapus shift Pagi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan' }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/api/shifts/s-pagi'))).toBe(true)
      expect(calls.filter((c) => c.method === 'GET' && c.url.includes('/api/shifts?'))).toHaveLength(2)
    })
    const legend = screen.getByTestId('shift-legend')
    await waitFor(() => {
      const pagiRow = within(legend).getByText('Pagi').closest('li')
      expect(pagiRow).not.toBeNull()
      expect(within(pagiRow!).getByText('Nonaktif')).toBeInTheDocument()
    })
  })
})

describe('Shifts Page — weekly grid', () => {
  it('merender baris karyawan dari GET /api/employees dan menyaring yang nonaktif', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'GET' && c.url.includes('/api/employees'))).toBe(true)
      expect(grid.querySelectorAll('tbody tr')).toHaveLength(12)
      expect(grid.textContent).toContain('Budi Santoso')
      expect(grid.textContent).not.toContain('Pensiun Wati')
      grid.querySelectorAll('tbody tr').forEach((row) => {
        expect(row.querySelectorAll('select')).toHaveLength(7)
      })
    })
  })

  it('klik sel membuka dropdown shift yang tersedia + Libur', async () => {
    const { fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))
    const select = gridSelects(grid)[0]
    fireEvent.click(select)
    // Libur (empty) + 4 configured shifts.
    expect(select.options).toHaveLength(5)
    expect(select.options[0].value).toBe('')
    expect(Array.from(select.options).map((o) => o.value)).toContain('s-pagi')
    expect(Array.from(select.options).map((o) => o.value)).toContain('s-malam')
  })

  it('mengubah sel tanpa penugasan memanggil POST /api/shift-assignments dan me-refetch', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))
    const before = calls.filter((c) => c.method === 'GET' && c.url.includes('/api/shift-assignments')).length

    // Row 0 (Budi) day 5 (Sabtu) is Libur → no existing assignment → POST path.
    const day5 = grid.querySelectorAll('tbody tr')[0].querySelectorAll('td select')[5] as HTMLSelectElement
    expect(day5.value).toBe('')
    fireEvent.change(day5, { target: { value: 's-siang' } })

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.includes('/api/shift-assignments'))
      expect(post).toBeTruthy()
      expect(post?.body).toMatchObject({
        employee_id: '1',
        shift_id: 's-siang',
        tanggal: dayIso(getWeekStart(), 5),
      })
      expect(calls.filter((c) => c.method === 'GET' && c.url.includes('/api/shift-assignments')).length).toBeGreaterThan(
        before,
      )
    })
    await waitFor(() => {
      expect(day5.value).toBe('s-siang')
      expect(screen.getByTestId('cell-status-0-5').getAttribute('aria-label')).toBe('Tersimpan')
    })
  })

  it('mengubah sel yang sudah berpenugasan memanggil PATCH /api/shift-assignments/:id', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))

    // Row 0 day 0 = Pagi (as-0) → change to Malam → PATCH as-0.
    const day0 = grid.querySelectorAll('tbody tr')[0].querySelectorAll('td select')[0] as HTMLSelectElement
    fireEvent.change(day0, { target: { value: 's-malam' } })

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/api/shift-assignments/as-0'))
      expect(patch).toBeTruthy()
      expect(patch?.body).toMatchObject({ shift_id: 's-malam' })
      expect(day0.value).toBe('s-malam')
    })
  })

  it('memilih Libur menghapus penugasan via DELETE /api/shift-assignments/:id', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))

    const day0 = grid.querySelectorAll('tbody tr')[0].querySelectorAll('td select')[0] as HTMLSelectElement
    fireEvent.change(day0, { target: { value: '' } })

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/api/shift-assignments/as-0'))).toBe(true)
      expect(day0.value).toBe('')
    })
  })

  it('gagal menyimpan mengembalikan nilai sel sebelumnya (tanpa UI optimistik)', async () => {
    const { calls, fetchMock } = createStub({ fail: { postAssignments: true } })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))

    const day5 = grid.querySelectorAll('tbody tr')[0].querySelectorAll('td select')[5] as HTMLSelectElement
    expect(day5.value).toBe('')
    fireEvent.change(day5, { target: { value: 's-pagi' } })

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/api/shift-assignments'))).toBe(true)
      // Reverted: back to Libur, error indicator shown.
      expect(day5.value).toBe('')
      expect(screen.getByTestId('cell-status-0-5').getAttribute('aria-label')).toBe('Gagal menyimpan')
    })
  })

  it('navigasi prev/next memperbarui rentang minggu', async () => {
    const { fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
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

  it('refresh halaman mempertahankan penugasan (data dari BE, bukan lokal)', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    const first = render(<ShiftsPage />)
    const grid = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid.querySelector('tbody tr td select'))
    const day5 = grid.querySelectorAll('tbody tr')[0].querySelectorAll('td select')[5] as HTMLSelectElement
    fireEvent.change(day5, { target: { value: 's-siang' } })
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/api/shift-assignments'))).toBe(true)
    })
    first.unmount()

    const second = render(<ShiftsPage />)
    const grid2 = await waitFor(() => screen.getByTestId('shift-grid'))
    await waitFor(() => grid2.querySelector('tbody tr td select'))
    const day5b = grid2.querySelectorAll('tbody tr')[0].querySelectorAll('td select')[5] as HTMLSelectElement
    expect(day5b.value).toBe('s-siang')
    second.unmount()
  })
})

describe('Shifts Page — roster publish', () => {
  it('tombol publish memanggil POST /api/roster/publish dan mengubah status', async () => {
    const { calls, fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => screen.getByText('Draft'))

    fireEvent.click(screen.getByRole('button', { name: 'Publikasikan Jadwal' }))

    await waitFor(() => {
      const pub = calls.find((c) => c.method === 'POST' && c.url.includes('/api/roster/publish'))
      expect(pub).toBeTruthy()
      expect(pub?.body).toMatchObject({ start: getWeekStart(), end: weekEndIso(getWeekStart()) })
      expect(screen.getByText('Dipublikasikan')).toBeInTheDocument()
      expect(screen.queryByText('Draft')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Telah Dipublikasikan' })).toBeDisabled()
    })
  })

  it('gagal publish membiarkan status draft', async () => {
    const { fetchMock } = createStub({ fail: { publish: true } })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => screen.getByText('Draft'))
    fireEvent.click(screen.getByRole('button', { name: 'Publikasikan Jadwal' }))
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
      expect(screen.queryByText('Dipublikasikan')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Publikasikan Jadwal' })).toBeInTheDocument()
    })
  })
})

describe('Shifts Page — capability gating', () => {
  it('owner melihat tombol publish', async () => {
    const { fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('shift-grid'))
    expect(screen.getByRole('button', { name: 'Publikasikan Jadwal' })).toBeInTheDocument()
  })

  it('manager melihat tombol publish', async () => {
    const { fetchMock } = createStub()
    vi.stubGlobal('fetch', fetchMock)
    setSession('manager')
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('shift-grid'))
    expect(screen.getByRole('button', { name: 'Publikasikan Jadwal' })).toBeInTheDocument()
  })

  it('employee tidak melihat tombol publish (grid read-only)', async () => {
    const { fetchMock } = createStub({ publishAssignments: true })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(null, '', '/?role=employee')
    render(<ShiftsPage />)
    await waitFor(() => screen.getByTestId('my-shifts'))
    expect(screen.queryByRole('button', { name: 'Publikasikan Jadwal' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('shift-grid')).not.toBeInTheDocument()
    expect(screen.queryByText('Terapkan pola ke semua')).not.toBeInTheDocument()
  })
})

describe('Shifts Page — Employee view', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?role=employee')
  })

  it('menampilkan hanya shift miliknya sendiri (7 hari, bukan grid penuh)', async () => {
    const { calls, fetchMock } = createStub({ publishAssignments: true })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const list = await waitFor(() => screen.getByTestId('my-shifts'))
    await waitFor(() => {
      expect(list.querySelectorAll('li')).toHaveLength(7)
      // Karyawan demo = Siti Nurhaliza (id 2), Senin (idx 0) = Siang.
      const firstBadge = list.querySelector('li span')
      expect(firstBadge?.textContent).toContain('Siang')
      // Employee-scoped request passes employee_id.
      expect(
        calls.some((c) => c.method === 'GET' && c.url.includes('/api/shift-assignments') && c.url.includes('employee_id=2')),
      ).toBe(true)
    })
  })

  it('minggu belum dipublikasikan menampilkan empty state (tidak ada shift)', async () => {
    const { full, fetchMock } = createStub()
    full.assignments = []
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    await waitFor(() => {
      expect(screen.getByText('Tidak ada shift terjadwal minggu ini')).toBeInTheDocument()
      expect(screen.queryByTestId('my-shifts')).not.toBeInTheDocument()
    })
  })

  it('menampilkan badge Libur untuk hari tanpa penugasan', async () => {
    const { full, fetchMock } = createStub({ publishAssignments: true })
    // Remove Siti's Saturday (day 5) assignment.
    full.assignments = full.assignments.filter(
      (a) => !(a.employee_id === '2' && a.tanggal === dayIso(getWeekStart(), 5)),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ShiftsPage />)
    const list = await waitFor(() => screen.getByTestId('my-shifts'))
    await waitFor(() => {
      const day5 = list.querySelectorAll('li')[5]
      expect(day5.querySelector('span')?.textContent).toContain('Libur')
    })
  })
})
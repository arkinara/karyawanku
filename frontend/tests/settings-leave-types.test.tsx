import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'
import type { BeLeaveTypeListResponse } from '@/lib/leave-adapter'

type BeLeaveTypeFixture = {
  id: string
  nama_jenis_cuti: string
  default_kuota_hari: number
  kebijakan_sisa: 'hangus' | 'carry-over'
  carry_over_max_days: number | null
  aktif: boolean
}

const initialLeaveTypes: BeLeaveTypeFixture[] = [
  { id: 'lt-1', nama_jenis_cuti: 'Cuti Tahunan', default_kuota_hari: 12, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
  { id: 'lt-2', nama_jenis_cuti: 'Cuti Sakit', default_kuota_hari: 5, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
  { id: 'lt-3', nama_jenis_cuti: 'Cuti Izin', default_kuota_hari: 3, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
  { id: 'lt-4', nama_jenis_cuti: 'Cuti Menikah', default_kuota_hari: 5, kebijakan_sisa: 'carry-over', carry_over_max_days: 5, aktif: true },
]

let leaveTypesState = [...initialLeaveTypes]
let requests: { method: string; url: string; body?: Record<string, unknown> }[] = []

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined
      requests.push({ method, url, body })

      if (url.includes('/api/leave-types') && method === 'POST') {
        const newLt: BeLeaveTypeFixture = {
          id: `lt-${Date.now()}`,
          nama_jenis_cuti: (body?.nama_jenis_cuti as string) ?? '',
          default_kuota_hari: (body?.default_kuota_hari as number) ?? 0,
          kebijakan_sisa: (body?.kebijakan_sisa as 'hangus' | 'carry-over') ?? 'hangus',
          carry_over_max_days: (body?.carry_over_max_days as number | null) ?? null,
          aktif: true,
        }
        leaveTypesState = [...leaveTypesState, newLt]
        return json({ leave_type: newLt })
      }
      if (url.includes('/api/leave-types') && method === 'PATCH') {
        const id = url.split('/').pop()
        leaveTypesState = leaveTypesState.map((lt) =>
          lt.id === id ? { ...lt, ...(body as Partial<BeLeaveTypeFixture>) } : lt,
        )
        return json({ leave_type: leaveTypesState.find((lt) => lt.id === id) })
      }
      if (url.includes('/api/leave-types') && method === 'DELETE') {
        const id = url.split('/').pop()
        leaveTypesState = leaveTypesState.map((lt) =>
          lt.id === id ? { ...lt, aktif: false } : lt,
        )
        return json({ ok: true })
      }
      if (url.includes('/api/leave-types')) {
        const active = leaveTypesState.filter((lt) => lt.aktif)
        return json({ leave_types: active } as BeLeaveTypeListResponse)
      }

      return json({})
    }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('kk-token', 'test-token')
  window.localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
  leaveTypesState = [...initialLeaveTypes]
  requests = []
  stubFetch()
})

function renderLeaveTab() {
  render(<SettingsPage />)
  fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Settings — Jenis Cuti wiring (ticket #52)', () => {
  it('memuat daftar jenis cuti dari GET /api/leave-types dan menampilkan di tabel', async () => {
    const { container } = render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
    await waitFor(() => expect(rowCount(container)).toBe(4))
    expect(requests.some((r) => r.method === 'GET' && r.url.includes('/api/leave-types'))).toBe(true)
    expect(screen.getByText('Cuti Tahunan')).toBeInTheDocument()
    expect(screen.getByText('Cuti Sakit')).toBeInTheDocument()
    expect(screen.getByText('Cuti Izin')).toBeInTheDocument()
    expect(screen.getByText('Cuti Menikah')).toBeInTheDocument()
    expect(screen.getByText('Carry-over max 5 hari')).toBeInTheDocument()
  })

  it('dialog tambah jenis cuti mengirim POST dan melakukan refetch', async () => {
    const { container } = render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
    await waitFor(() => expect(rowCount(container)).toBe(4))

    fireEvent.click(screen.getByRole('button', { name: /Tambah Jenis Cuti/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Nama jenis cuti/), { target: { value: 'Cuti Ibadah' } })
    fireEvent.change(within(dialog).getByLabelText(/Default Kuota/), { target: { value: '3' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))

    await waitFor(() => {
      expect(requests.some((r) => r.method === 'POST' && r.url.includes('/api/leave-types'))).toBe(true)
    })
    const post = requests.find((r) => r.method === 'POST' && r.url.includes('/api/leave-types'))
    expect(post?.body).toMatchObject({
      nama_jenis_cuti: 'Cuti Ibadah',
      default_kuota_hari: 3,
      kebijakan_sisa: 'hangus',
    })

    await waitFor(() => expect(rowCount(container)).toBe(5))
    expect(screen.getByText('Cuti Ibadah')).toBeInTheDocument()
  })

  it('carry-over: input maksimal muncul hanya saat kebijakan carry-over dan wajib diisi', async () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
    await waitFor(() => screen.getByRole('button', { name: /Tambah Jenis Cuti/ }))

    fireEvent.click(screen.getByRole('button', { name: /Tambah Jenis Cuti/ }))
    const dialog = await screen.findByRole('dialog')

    // Default policy is hangus — carry-over cap input must NOT be shown.
    expect(within(dialog).queryByLabelText(/Maksimal carry-over/)).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Carry-over' }))
    const capInput = within(dialog).getByLabelText(/Maksimal carry-over/)
    expect(capInput).toBeInTheDocument()

    // Required: leaving it empty blocks submission with a message.
    fireEvent.change(within(dialog).getByLabelText(/Nama jenis cuti/), { target: { value: 'Cuti Ibadah' } })
    fireEvent.change(within(dialog).getByLabelText(/Default Kuota/), { target: { value: '3' } })
    fireEvent.change(capInput, { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Maksimal carry-over wajib diisi')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST')).toBe(false)
  })

  it('menonaktifkan jenis cuti via konfirmasi → DELETE → refetch', async () => {
    const { container } = render(<SettingsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
    await waitFor(() => expect(rowCount(container)).toBe(4))

    fireEvent.click(screen.getByRole('button', { name: 'Hapus Cuti Tahunan' }))
    const confirmDialog = await screen.findByRole('dialog')
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Hapus' }))

    await waitFor(() => {
      expect(requests.some((r) => r.method === 'DELETE' && r.url.includes('/api/leave-types/lt-1'))).toBe(true)
    })
    await waitFor(() => expect(rowCount(container)).toBe(3))
    expect(screen.queryByText('Cuti Tahunan')).not.toBeInTheDocument()
  })
})

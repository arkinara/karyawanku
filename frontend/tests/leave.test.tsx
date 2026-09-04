import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LeavePage from '@/app/leave/page'

// BE-shaped payloads — the page maps these into its camelCase FE shapes.
const requestsPayload = {
  items: [
    // 2 pending: Budi (id 1) + Siti (id 2)
    {
      id: 'lrv-01',
      employee_id: '1',
      employee_name: 'Budi Santoso',
      leave_type_id: 'lt-tahunan',
      leave_type_name: 'Cuti Tahunan',
      tanggal_mulai: '2026-08-25',
      tanggal_selesai: '2026-08-25',
      alasan: 'Perayaan keluarga di luar kota',
      status: 'pending',
      approver_user_id: null,
      catatan_approver: null,
      created_at: '2026-08-20T00:00:00Z',
      decided_at: null,
    },
    {
      id: 'lrv-02',
      employee_id: '2',
      employee_name: 'Siti Nurhaliza',
      leave_type_id: 'lt-tahunan',
      leave_type_name: 'Cuti Tahunan',
      tanggal_mulai: '2026-09-14',
      tanggal_selesai: '2026-09-18',
      alasan: 'Liburan keluarga ke Yogyakarta',
      status: 'pending',
      approver_user_id: null,
      catatan_approver: null,
      created_at: '2026-08-20T00:00:00Z',
      decided_at: null,
    },
    // 5 approved this month
    {
      id: 'lrv-03',
      employee_id: '3',
      employee_name: 'Ahmad Fauzi',
      leave_type_id: 'lt-tahunan',
      leave_type_name: 'Cuti Tahunan',
      tanggal_mulai: '2026-08-03',
      tanggal_selesai: '2026-08-05',
      alasan: 'Kebutuhan pribadi',
      status: 'disetujui',
      approver_user_id: 'u',
      catatan_approver: 'Disetujui. Pengganti shift diatur.',
      created_at: '2026-08-01T00:00:00Z',
      decided_at: '2026-08-02T00:00:00Z',
    },
    {
      id: 'lrv-04',
      employee_id: '4',
      employee_name: 'Dewi Lestari',
      leave_type_id: 'lt-izin',
      leave_type_name: 'Cuti Izin',
      tanggal_mulai: '2026-08-10',
      tanggal_selesai: '2026-08-10',
      alasan: 'Keperluan keluarga',
      status: 'disetujui',
      approver_user_id: 'u',
      catatan_approver: 'Disetujui.',
      created_at: '2026-08-01T00:00:00Z',
      decided_at: '2026-08-02T00:00:00Z',
    },
    {
      id: 'lrv-05',
      employee_id: '5',
      employee_name: 'Rudi Hermawan',
      leave_type_id: 'lt-sakit',
      leave_type_name: 'Cuti Sakit',
      tanggal_mulai: '2026-08-12',
      tanggal_selesai: '2026-08-14',
      alasan: 'Demam dan butuh istirahat',
      status: 'disetujui',
      approver_user_id: 'u',
      catatan_approver: 'Disetujui. Surat keterangan diterima.',
      created_at: '2026-08-01T00:00:00Z',
      decided_at: '2026-08-02T00:00:00Z',
    },
    {
      id: 'lrv-06',
      employee_id: '6',
      employee_name: 'Maya Sari',
      leave_type_id: 'lt-melahirkan',
      leave_type_name: 'Cuti Melahirkan',
      tanggal_mulai: '2026-08-17',
      tanggal_selesai: '2026-08-21',
      alasan: 'Cuti melahirkan',
      status: 'disetujui',
      approver_user_id: 'u',
      catatan_approver: 'Disetujui sesuai ketentuan.',
      created_at: '2026-08-01T00:00:00Z',
      decided_at: '2026-08-02T00:00:00Z',
    },
    {
      id: 'lrv-07',
      employee_id: '7',
      employee_name: 'Fajar Nugraha',
      leave_type_id: 'lt-penting',
      leave_type_name: 'Cuti Penting',
      tanggal_mulai: '2026-08-19',
      tanggal_selesai: '2026-08-20',
      alasan: 'Urusan penting keluarga',
      status: 'disetujui',
      approver_user_id: 'u',
      catatan_approver: 'Disetujui.',
      created_at: '2026-08-01T00:00:00Z',
      decided_at: '2026-08-02T00:00:00Z',
    },
    // 1 rejected this month
    {
      id: 'lrv-08',
      employee_id: '9',
      employee_name: 'Indra Permadi',
      leave_type_id: 'lt-tahunan',
      leave_type_name: 'Cuti Tahunan',
      tanggal_mulai: '2026-08-20',
      tanggal_selesai: '2026-08-22',
      alasan: 'Liburan mendadak',
      status: 'ditolak',
      approver_user_id: 'u',
      catatan_approver: 'Ditolak: bentrok dengan jadwal rekap bulanan.',
      created_at: '2026-08-01T00:00:00Z',
      decided_at: '2026-08-02T00:00:00Z',
    },
    // 2 processed last month (Sitinya)
    {
      id: 'lrv-09',
      employee_id: '2',
      employee_name: 'Siti Nurhaliza',
      leave_type_id: 'lt-penting',
      leave_type_name: 'Cuti Penting',
      tanggal_mulai: '2026-07-06',
      tanggal_selesai: '2026-07-07',
      alasan: 'Acara keluarga',
      status: 'disetujui',
      approver_user_id: 'u',
      catatan_approver: 'Pengganti shift diatur oleh supervisor.',
      created_at: '2026-07-01T00:00:00Z',
      decided_at: '2026-07-02T00:00:00Z',
    },
    {
      id: 'lrv-10',
      employee_id: '2',
      employee_name: 'Siti Nurhaliza',
      leave_type_id: 'lt-izin',
      leave_type_name: 'Cuti Izin',
      tanggal_mulai: '2026-07-02',
      tanggal_selesai: '2026-07-02',
      alasan: 'Urusan administrasi bank',
      status: 'ditolak',
      approver_user_id: 'u',
      catatan_approver: 'Ditolak: jadwal kasir tidak bisa diganti.',
      created_at: '2026-07-01T00:00:00Z',
      decided_at: '2026-07-02T00:00:00Z',
    },
  ],
}

const leaveTypesPayload = {
  leave_types: [
    { id: 'lt-tahunan', nama_jenis_cuti: 'Cuti Tahunan', default_kuota_hari: 12, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-sakit', nama_jenis_cuti: 'Cuti Sakit', default_kuota_hari: 5, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-izin', nama_jenis_cuti: 'Cuti Izin', default_kuota_hari: 3, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-melahirkan', nama_jenis_cuti: 'Cuti Melahirkan', default_kuota_hari: 0, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
    { id: 'lt-penting', nama_jenis_cuti: 'Cuti Penting', default_kuota_hari: 0, kebijakan_sisa: 'hangus', carry_over_max_days: null, aktif: true },
  ],
}

const balancesPayload = {
  employee_id: '2',
  tahun: 2026,
  balances: [
    { id: 'b1', employee_id: '2', leave_type_id: 'lt-tahunan', nama_jenis_cuti: 'Cuti Tahunan', tahun: 2026, kuota_hari: 12, terpakai_hari: 0, sisa_hari: 12 },
    { id: 'b2', employee_id: '2', leave_type_id: 'lt-sakit', nama_jenis_cuti: 'Cuti Sakit', tahun: 2026, kuota_hari: 5, terpakai_hari: 0, sisa_hari: 5 },
    { id: 'b3', employee_id: '2', leave_type_id: 'lt-izin', nama_jenis_cuti: 'Cuti Izin', tahun: 2026, kuota_hari: 3, terpakai_hari: 0, sisa_hari: 3 },
  ],
}

function stubOwnerFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/leave-requests')) {
        return new Response(JSON.stringify(requestsPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

let postedRequests: typeof requestsPayload.items = []
function stubEmployeeFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.includes('/api/leave-requests') && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        const newEntry = {
          id: 'lrv-new',
          employee_id: '2',
          employee_name: 'Siti Nurhaliza',
          leave_type_id: body.leave_type_id ?? 'lt-tahunan',
          leave_type_name: 'Cuti Tahunan',
          tanggal_mulai: body.tanggal_mulai ?? '2026-09-01',
          tanggal_selesai: body.tanggal_selesai ?? '2026-09-02',
          alasan: body.alasan ?? 'Urusan keluarga mendadak',
          status: 'pending',
          approver_user_id: null,
          catatan_approver: null,
          created_at: new Date().toISOString(),
          decided_at: null,
        }
        postedRequests.push(newEntry)
        return new Response(JSON.stringify(newEntry), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/leave-requests')) {
        const merged = { items: [...requestsPayload.items, ...postedRequests] }
        return new Response(JSON.stringify(merged), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/leave-balances')) {
        return new Response(JSON.stringify(balancesPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/leave-types')) {
        return new Response(JSON.stringify(leaveTypesPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as never,
  )
}

// The fixtures above are all August 2026, and the page's "Bulan Ini" metrics
// plus the "tanggal mulai >= hari ini" form rule both read the wall clock — so
// without a frozen clock these tests silently started failing on 1 Sep 2026.
// Only Date is faked; setTimeout stays real so waitFor/findBy still work.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-20T09:00:00'))
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  window.localStorage.setItem('kk-token', 'test-token')
  window.localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Leave Page — Owner view', () => {
  beforeEach(() => stubOwnerFetch())

  it('merender summary metrics 2 / 5 / 1', async () => {
    render(<LeavePage />)
    const summary = await waitFor(() => screen.getByTestId('leave-summary'))
    await waitFor(() => {
      expect(within(summary).getByText('Total Menunggu')).toBeInTheDocument()
      expect(within(summary).getByText('2')).toBeInTheDocument()
      expect(within(summary).getByText('Disetujui Bulan Ini')).toBeInTheDocument()
      expect(within(summary).getByText('5')).toBeInTheDocument()
      expect(within(summary).getByText('Ditolak Bulan Ini')).toBeInTheDocument()
      expect(within(summary).getByText('1')).toBeInTheDocument()
    })
  })

  it('merender approval queue dengan 2 pending + tombol Setujui/Tolak', async () => {
    render(<LeavePage />)
    const queue = await waitFor(() => screen.getByTestId('approval-queue'))
    await waitFor(() => {
      expect(within(queue).getByText('Cuti Menunggu Persetujuan')).toBeInTheDocument()
      expect(within(queue).getAllByRole('button', { name: 'Setujui' })).toHaveLength(2)
      expect(within(queue).getAllByRole('button', { name: 'Tolak' })).toHaveLength(2)
      expect(within(queue).getByText('Budi Santoso')).toBeInTheDocument()
      expect(within(queue).getByText('Siti Nurhaliza')).toBeInTheDocument()
    })
  })

  it('filter status "Menunggu" menyaring tabel semua pengajuan', async () => {
    render(<LeavePage />)
    await waitFor(() => {
      expect(screen.getByTestId('all-requests').querySelectorAll('tbody tr').length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Menunggu' }))
    await waitFor(() => {
      expect(screen.getByTestId('all-requests').querySelectorAll('tbody tr')).toHaveLength(2)
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Disetujui' }))
    await waitFor(() => {
      expect(screen.getByTestId('all-requests').querySelectorAll('tbody tr')).toHaveLength(6)
    })
  })

  it('approve mengubah status pending menjadi approved dan menghapus dari queue', async () => {
    render(<LeavePage />)
    const queue = await waitFor(() => screen.getByTestId('approval-queue'))
    await waitFor(() => within(queue).getAllByRole('button', { name: 'Setujui' }))
    fireEvent.click(within(queue).getAllByRole('button', { name: 'Setujui' })[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Setujui Cuti')).toBeInTheDocument()
    expect(within(dialog).getByText('Budi Santoso')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Setujui' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(within(queue).getAllByRole('button', { name: 'Setujui' })).toHaveLength(1)
      expect(within(queue).queryByText('Budi Santoso')).not.toBeInTheDocument()
    })
  })

  it('reject dengan catatan menampilkan catatan di tabel semua pengajuan', async () => {
    render(<LeavePage />)
    const queue = await waitFor(() => screen.getByTestId('approval-queue'))
    await waitFor(() => within(queue).getAllByRole('button', { name: 'Tolak' }))
    fireEvent.click(within(queue).getAllByRole('button', { name: 'Tolak' })[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tolak Cuti')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Catatan'), { target: { value: 'Kebutuhan operasional' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tolak' }))

    await waitFor(() => {
      expect(screen.getByText('Kebutuhan operasional')).toBeInTheDocument()
      expect(within(queue).getAllByRole('button', { name: 'Tolak' })).toHaveLength(1)
    })
  })

  it('gagal approve dari API → status dirollback ke pending dan tetap di queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/leave-requests') && (init?.method ?? 'GET') !== 'GET') {
          return new Response(
            JSON.stringify({ error: { message: 'Server sedang sibuk' } }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (url.includes('/api/leave-requests')) {
          return new Response(JSON.stringify(requestsPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    render(<LeavePage />)
    const queue = await waitFor(() => screen.getByTestId('approval-queue'))
    await waitFor(() => within(queue).getAllByRole('button', { name: 'Setujui' }))

    fireEvent.click(within(queue).getAllByRole('button', { name: 'Setujui' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Setujui' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    // Rollback: Budi tetap pending, queue tetap 2 entri.
    await waitFor(() => {
      expect(within(queue).getAllByRole('button', { name: 'Setujui' })).toHaveLength(2)
      expect(within(queue).getByText('Budi Santoso')).toBeInTheDocument()
    })
  })
})

describe('Leave Page — Employee view', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?role=employee')
    stubEmployeeFetch()
  })

  it('merender kartu saldo cuti 12/12, 5/5, 3/3', async () => {
    render(<LeavePage />)
    const balance = await waitFor(() => screen.getByTestId('leave-balance'))
    await waitFor(() => {
      expect(within(balance).getByText('Cuti Tahunan')).toBeInTheDocument()
      expect(within(balance).getByText('12/12 hari')).toBeInTheDocument()
      expect(within(balance).getByText('Cuti Sakit')).toBeInTheDocument()
      expect(within(balance).getByText('5/5 hari')).toBeInTheDocument()
      expect(within(balance).getByText('Cuti Izin')).toBeInTheDocument()
      expect(within(balance).getByText('3/3 hari')).toBeInTheDocument()
    })
  })

  it('merender histori pengajuan milik sendiri dengan semua status', async () => {
    render(<LeavePage />)
    await waitFor(() => {
      expect(screen.getByText('Histori Pengajuan')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getAllByText('Cuti Tahunan').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('Menunggu').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Disetujui').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Ditolak').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Pengganti shift diatur oleh supervisor/)).toBeInTheDocument()
    })
  })

  it('membuka dialog Ajukan Cuti dan memvalidasi field wajib', async () => {
    render(<LeavePage />)
    await waitFor(() => screen.getByRole('button', { name: /Ajukan Cuti/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Ajukan Cuti')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Kirim Pengajuan' }))

    await waitFor(() => {
      expect(screen.getByText('Tanggal mulai wajib diisi')).toBeInTheDocument()
      expect(screen.getByText('Tanggal selesai wajib diisi')).toBeInTheDocument()
      expect(screen.getByText('Alasan wajib diisi')).toBeInTheDocument()
    })
  })

  it('tanggal_selesai sebelum tanggal_mulai menampilkan error', async () => {
    render(<LeavePage />)
    await waitFor(() => screen.getByRole('button', { name: /Ajukan Cuti/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))

    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/), { target: { value: '2026-08-24' } })
    fireEvent.change(screen.getByLabelText(/Tanggal Selesai/), { target: { value: '2026-08-20' } })

    await waitFor(() => {
      expect(
        screen.getByText('Tanggal selesai harus setelah atau sama dengan tanggal mulai'),
      ).toBeInTheDocument()
    })
  })

  it('pengajuan melebihi saldo menampilkan peringatan kuota tidak cukup', async () => {
    render(<LeavePage />)
    await waitFor(() => screen.getByRole('button', { name: /Ajukan Cuti/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))

    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/), { target: { value: '2026-08-24' } })
    fireEvent.change(screen.getByLabelText(/Tanggal Selesai/), { target: { value: '2026-09-06' } })

    await waitFor(() => {
      expect(
        screen.getByText(/Sisa saldo Cuti Tahunan tidak cukup/),
      ).toBeInTheDocument()
    })
  })

  it('submit valid menambahkan entri pending ke histori', async () => {
    render(<LeavePage />)
    await waitFor(() => screen.getByRole('button', { name: /Ajukan Cuti/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ajukan Cuti/ }))

    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/Tanggal Selesai/), { target: { value: '2026-09-02' } })
    fireEvent.change(screen.getByLabelText(/Alasan/), {
      target: { value: 'Urusan keluarga mendadak' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Urusan keluarga mendadak')).toBeInTheDocument()
      const pendingChips = screen.getAllByText('Menunggu')
      expect(pendingChips.length).toBeGreaterThanOrEqual(2)
    })
  })
})

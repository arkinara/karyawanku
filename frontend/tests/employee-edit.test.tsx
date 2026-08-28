import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditEmployeePage from '@/app/employees/[id]/edit/page'

let mockId = '1'
const mockPush = vi.fn()
const notFoundMock = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: mockPush, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/mock-path',
  notFound: () => notFoundMock(),
}))

const employeeBudi = {
  employee: {
    id: '1',
    business_id: 'b',
    nama_lengkap: 'Budi Santoso',
    no_ktp: '3201234567890001',
    npwp: '01.234.567.8-901.000',
    tanggal_lahir: '1995-04-12',
    jenis_kelamin: 'L',
    alamat: 'Jl. Melati No. 12, Jakarta Selatan',
    kontak_darurat: '+62 812-3456-7890',
    tanggal_masuk: '2023-01-12',
    jenis_kontrak: 'pkwtt',
    status: 'aktif',
    ptkp_status: null,
    custom_fields: {},
  },
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('kk-token', 'test-token')
  localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
  mockId = '1'
  mockPush.mockClear()
  notFoundMock.mockClear()
  fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    if (url.includes('/api/employees/') && method === 'GET') {
      if (mockId === '1') return json(employeeBudi)
      return json({ error: { message: 'Karyawan tidak ditemukan' } }, 404)
    }
    return json({})
  })
  vi.stubGlobal('fetch', fetchImpl)
})

function renderPage(id: string = '1') {
  mockId = id
  return render(<EditEmployeePage />)
}

async function waitForForm() {
  await screen.findByLabelText(/Nama Lengkap/)
}

describe('Employee Edit — wiring (ticket #53)', () => {
  it('mengisi form dari GET /api/employees/:id (bukan mock)', async () => {
    renderPage('1')
    await waitForForm()

    expect(screen.getByLabelText(/Nama Lengkap/)).toHaveValue('Budi Santoso')
    expect(screen.getByLabelText(/Tanggal Lahir/)).toHaveValue('1995-04-12')
    expect(screen.getByLabelText(/Jenis Kontrak/)).toHaveValue('PKWTT')
    expect(screen.getByLabelText(/Tanggal Masuk/)).toHaveValue('2023-01-12')
    expect(screen.getByLabelText(/Alamat/)).toHaveValue('Jl. Melati No. 12, Jakarta Selatan')
    expect(screen.getByLabelText(/Kontak Darurat/)).toHaveValue('+62 812-3456-7890')
    expect(screen.getByLabelText(/Nomor KTP/)).toHaveValue('3201234567890001')
    expect(screen.getByLabelText(/NPWP/)).toHaveValue('01.234.567.8-901.000')
  })

  it('submit memanggil PATCH /api/employees/:id lalu redirect ke detail', async () => {
    renderPage('1')
    await waitForForm()

    const patchBodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/') && init?.method === 'PATCH') {
          patchBodies.push(init?.body)
          return json({ employee: { ...employeeBudi.employee, nama_lengkap: 'Budi Santoso Baru' } })
        }
        return json({})
      }),
    )

    fireEvent.change(screen.getByLabelText(/Nama Lengkap/), {
      target: { value: 'Budi Santoso Baru' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(patchBodies).toHaveLength(1))
    const body = JSON.parse(String(patchBodies[0])) as Record<string, unknown>
    expect(body.nama_lengkap).toBe('Budi Santoso Baru')
    expect(body.jenis_kontrak).toBe('pkwtt')
    expect(body.no_ktp).toBe('3201234567890001')
    expect(body.npwp).toBe('01.234.567.8-901.000')

    await waitFor(
      () => expect(mockPush).toHaveBeenCalledWith('/employees/1'),
      { timeout: 2000 },
    )
  })

  it('mengisi ulang nilai form jika PATCH gagal (error server tetap di form)', async () => {
    renderPage('1')
    await waitForForm()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/') && init?.method === 'PATCH') {
          return json(
            {
              error: {
                message: 'Gagal menyimpan',
                details: { fieldErrors: {}, formErrors: [] },
              },
            },
            422,
          )
        }
        return json({})
      }),
    )

    fireEvent.change(screen.getByLabelText(/Nama Lengkap/), {
      target: { value: 'Budi Santoso Baru' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Gagal menyimpan'),
    )
    // User's entered values survive a failed save.
    expect(screen.getByLabelText(/Nama Lengkap/)).toHaveValue('Budi Santoso Baru')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('memetakan error validasi 422 ke field yang sesuai', async () => {
    renderPage('1')
    await waitForForm()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/') && init?.method === 'PATCH') {
          return json(
            {
              error: {
                message: 'Data karyawan tidak valid',
                details: {
                  fieldErrors: {
                    no_ktp: ['No KTP sudah terdaftar dalam bisnis ini'],
                    npwp: ['NPWP harus 15 digit angka'],
                    tanggal_lahir: ['Umur minimal 17 tahun'],
                  },
                  formErrors: [],
                },
              },
            },
            422,
          )
        }
        return json({})
      }),
    )

    // Prefilled values are client-valid, so the submit reaches the BE.
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() =>
      expect(screen.getByText('No KTP sudah terdaftar dalam bisnis ini')).toBeInTheDocument(),
    )
    expect(screen.getByText('NPWP harus 15 digit angka')).toBeInTheDocument()
    expect(screen.getByText('Umur minimal 17 tahun')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('409 (KTP duplikat) memetakan error ke field no_ktp', async () => {
    renderPage('1')
    await waitForForm()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/') && init?.method === 'PATCH') {
          return json({ error: { message: 'No KTP sudah terdaftar dalam bisnis ini' } }, 409)
        }
        return json({})
      }),
    )

    fireEvent.change(screen.getByLabelText(/Nomor KTP/), {
      target: { value: '3299999999999999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() =>
      expect(
        screen.getByText('No KTP sudah terdaftar dalam bisnis ini'),
      ).toBeInTheDocument(),
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('menampilkan not-found saat GET /api/employees/:id mengembalikan 404', async () => {
    renderPage('999')
    await waitFor(() => expect(notFoundMock).toHaveBeenCalled())
  })
})
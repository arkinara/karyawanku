import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EmployeeDetailPage from '@/app/employees/[id]/page'

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
    custom_fields: { 'Ukuran Seragam': 'M', 'Nomor SIM': '1234567890' },
  },
}

const employeeSiti = {
  employee: {
    id: '2',
    nama_lengkap: 'Siti Nurhaliza',
    no_ktp: '3201234567890002',
    npwp: null,
    tanggal_lahir: '1992-02-02',
    jenis_kelamin: 'P',
    alamat: 'Jl. Mawar No. 5',
    kontak_darurat: '+62 813-2222-3333',
    tanggal_masuk: '2023-03-03',
    jenis_kontrak: 'pkwtt',
    status: 'aktif',
    ptkp_status: null,
    custom_fields: null,
  },
}

const employeeNonaktif = {
  employee: { ...employeeBudi.employee, id: '5', nama_lengkap: 'Rudi Hermawan', status: 'nonaktif' },
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('kk-token', 'test-token')
  localStorage.setItem(
    'kk-user',
    JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }),
  )
  mockPush.mockClear()
  notFoundMock.mockClear()

  const lookup: Record<string, unknown> = {
    '1': employeeBudi,
    '2': employeeSiti,
    '5': employeeNonaktif,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      if (url.includes('/api/employees/') && method === 'GET') {
        const id = url.split('/').pop()?.split('?')[0] ?? ''
        const payload = lookup[id]
        if (!payload) {
          return new Response(JSON.stringify({ error: { message: 'tidak ditemukan' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/employees/') && method === 'PATCH') {
        const payload = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ employee: { ...employeeBudi.employee, ...payload } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

function renderPage(id: string = '1') {
  mockId = id
  return render(<EmployeeDetailPage />)
}

describe('Employee Detail', () => {
  it('merender karyawan berdasarkan id dari BE', async () => {
    renderPage('1')
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Budi Santoso' }),
      ).toBeInTheDocument(),
    )

    mockId = '2'
    render(<EmployeeDetailPage key="second" />)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Siti Nurhaliza' }),
      ).toBeInTheDocument(),
    )
  })

  it('merender 4 section card (Data Pribadi, Dokumen Legal, Kontrak, Custom Fields)', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0))
    expect(screen.getByText('Data Pribadi')).toBeInTheDocument()
    expect(screen.getByText('Dokumen Legal')).toBeInTheDocument()
    expect(screen.getByText('Kontrak')).toBeInTheDocument()
    expect(screen.getByText('Custom Fields')).toBeInTheDocument()
  })

  it('menampilkan chip status yang sesuai', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0))
    expect(screen.getByText('Aktif')).toBeInTheDocument()
    expect(screen.getAllByText('PKWTT').length).toBeGreaterThan(0)
  })

  it('tombol Edit mengaktifkan mode edit (field menjadi bisa diedit)', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    expect(screen.queryByLabelText('Nama Lengkap')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Nama Lengkap')).toBeInTheDocument()
    expect(screen.getByLabelText('Nomor KTP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument()
  })

  it('mode edit dibatalkan (Batal) mengembalikan nilai semula', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const nama = screen.getByLabelText('Nama Lengkap')
    fireEvent.change(nama, { target: { value: 'Budi X' } })

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Budi Santoso' }),
    ).toBeInTheDocument()
  })

  it('Simpan Perubahan mengirim PATCH ke BE dan memperbarui state', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Nama Lengkap'), {
      target: { value: 'Budi Santoso Baru' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Budi Santoso Baru' }),
      ).toBeInTheDocument(),
    )
  })

  it('validasi memblokir simpan untuk no_ktp tidak valid', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Nomor KTP'), { target: { value: '123' } })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    expect(screen.getByText('Nomor KTP harus 16 digit')).toBeInTheDocument()
    expect(screen.getByLabelText('Nomor KTP')).toBeInTheDocument()
  })

  it('validasi memblokir simpan untuk tanggal lahir di bawah 17 tahun', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Tanggal Lahir'), { target: { value: '2015-01-01' } })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    expect(
      screen.getByText('Tanggal lahir tidak valid atau usia di bawah 17 tahun'),
    ).toBeInTheDocument()
  })

  it('custom fields merender dari BE', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    expect(screen.getByText('Ukuran Seragam')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('Nomor SIM')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('(spesifik bisnis Anda)')).toBeInTheDocument()
  })

  it('menambahkan custom field baru lewat dialog memperbarui state', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Tambah Field/ }))

    fireEvent.change(screen.getByLabelText('Nama field'), { target: { value: 'Tipe Sepatu' } })
    fireEvent.change(screen.getByLabelText('Nilai'), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Tipe Sepatu')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('toggle status mengubah badge status tanpa reload', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    expect(screen.getByText('Aktif')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Status kepegawaian' }))
    await waitFor(() => expect(screen.getByText('Nonaktif')).toBeInTheDocument())
  })

  it('tombol kembali mengarah ke /employees', async () => {
    renderPage('1')
    await waitFor(() => expect(screen.getAllByText('Budi Santoso')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke daftar karyawan' }))
    expect(mockPush).toHaveBeenCalledWith('/employees')
  })
})
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ImportEmployeesPage from '@/app/employees/import/page'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/mock-path',
}))

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Header auto-maps to every field; rows are otherwise valid. */
const VALID_CSV = `nama_lengkap,no_ktp,npwp,jenis_kontrak,tanggal_masuk
Budi Santoso,3201234567890001,01.234.567.8-901.000,PKWTT,2023-01-12
Siti Nurhaliza,3273011234567890,02.345.678.9-012.000,PKWT,2023-03-03
Ahmad Fauzi,3578010987654321,,PKWT,2024-07-17
`

function makeFile(content: string, name = 'karyawan.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

/** Render, drop a CSV into the drop zone, wait for the mapping step. */
async function upload(content: string, name = 'karyawan.csv') {
  const input = screen.getByLabelText(/Tarik file CSV di sini/)
  fireEvent.change(input, { target: { files: [makeFile(content, name)] } })
  await screen.findByRole('heading', { name: 'Pemetaan Kolom' })
}

/** Full journey to the preview table, where the chips + summary live. */
async function goToPreview(content: string) {
  render(<ImportEmployeesPage />)
  await upload(content)
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke Preview' }))
  await screen.findByRole('heading', { name: 'Preview & Import' })
}

describe('CSV import — upload', () => {
  it('menerima file .csv dan lanjut ke pemetaan kolom', async () => {
    render(<ImportEmployeesPage />)
    await upload(VALID_CSV)

    expect(screen.getByRole('heading', { name: 'Pemetaan Kolom' })).toBeInTheDocument()
    expect(screen.getByText(/3 baris data/)).toBeInTheDocument()
  })

  it('menolak file non-CSV (.txt)', async () => {
    render(<ImportEmployeesPage />)
    const input = screen.getByLabelText(/Tarik file CSV di sini/)
    fireEvent.change(input, { target: { files: [makeFile('x', 'data.txt')] } })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Format file tidak didukung')
    expect(screen.getByRole('heading', { name: 'Upload File CSV' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pemetaan Kolom' })).not.toBeInTheDocument()
  })
})

describe('CSV import — column mapping', () => {
  it('auto-map kolom CSV yang cocok dengan nama field (case-insensitive)', async () => {
    render(<ImportEmployeesPage />)
    await upload(VALID_CSV)

    expect(screen.getByLabelText('Kolom nama_lengkap')).toHaveValue('nama_lengkap')
    expect(screen.getByLabelText('Kolom no_ktp')).toHaveValue('no_ktp')
    expect(screen.getByLabelText('Kolom jenis_kontrak')).toHaveValue('jenis_kontrak')
  })

  it('perubahan mapping manual tersimpan dan dipakai di preview', async () => {
    const csv =
      'Nama,no_ktp,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,3201234567890001,PKWTT,2023-01-12\n'
    render(<ImportEmployeesPage />)
    await upload(csv)

    const select = screen.getByLabelText('Kolom Nama')
    expect(select).toHaveValue('ignore')

    fireEvent.change(select, { target: { value: 'nama_lengkap' } })
    expect(select).toHaveValue('nama_lengkap')

    fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke Preview' }))
    await screen.findByRole('heading', { name: 'Preview & Import' })
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  })
})

describe('CSV import — validation & preview', () => {
  it('menandai nama_lengkap kosong sebagai error', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
      ',3201234567890001,L,PKWTT,2023-01-12\n'
    await goToPreview(csv)

    expect(screen.getByText('Nama kosong')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toContain('0 baris valid, 1 baris error')
  })

  it('menandai format KTP tidak valid', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,123,L,PKWTT,2023-01-12\n'
    await goToPreview(csv)

    expect(screen.getByText('Format KTP salah (16 digit)')).toBeInTheDocument()
  })

  it('menandai KTP duplikat dengan nomor baris pertama', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,3201234567890001,L,PKWTT,2023-01-12\n' +
      'Siti Nurhaliza,3201234567890001,P,PKWT,2023-03-03\n'
    await goToPreview(csv)

    expect(screen.getByText('KTP duplikat baris 2')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toContain('1 baris valid, 1 baris error')
  })

  it('ringkasan preview menampilkan jumlah valid dan error yang akurat', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,3201234567890001,L,PKWTT,2023-01-12\n' +
      'Siti Nurhaliza,3273011234567890,P,PKWT,2023-03-03\n' +
      'Ahmad Fauzi,3578010987654321,L,PKWT,\n'
    await goToPreview(csv)

    expect(screen.getByRole('status').textContent).toContain('2 baris valid, 1 baris error')
  })

  it('tombol import nonaktif saat 0 baris valid', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,123,L,PKWTT,2023-01-12\n'
    await goToPreview(csv)

    expect(screen.getByRole('button', { name: 'Import 0 Karyawan' })).toBeDisabled()
  })
})

describe('CSV import — API wiring (ticket #53)', () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it('preview memakai endpoint upload dan menyemai mapping dari server', async () => {
    const previewCalls: Array<RequestInfo | URL> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/import/preview')) {
          previewCalls.push(input)
          return json({
            detectedHeaders: ['Nama', 'no_ktp'],
            suggestedMapping: { Nama: 'nama_lengkap', no_ktp: 'no_ktp' },
            rows: [['Budi Santoso', '3201234567890001']],
            totalRows: 1,
            requiredMapped: true,
          })
        }
        return json({})
      }),
    )

    render(<ImportEmployeesPage />)
    const input = screen.getByLabelText(/Tarik file CSV di sini/)
    fireEvent.change(input, {
      target: {
        files: [makeFile('Nama,no_ktp\nBudi Santoso,3201234567890001\n')],
      },
    })
    await screen.findByRole('heading', { name: 'Pemetaan Kolom' })

    expect(previewCalls).toHaveLength(1)
    // Server suggestion maps 'Nama' → nama_lengkap (client heuristic would ignore it).
    expect(screen.getByLabelText('Kolom Nama')).toHaveValue('nama_lengkap')
    expect(screen.getByLabelText('Kolom no_ktp')).toHaveValue('no_ktp')
  })

  it('commit mengirim baris ke endpoint commit lalu redirect ke /employees', async () => {
    const commitBodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/import/preview')) {
          return json({
            detectedHeaders: ['nama_lengkap', 'no_ktp', 'jenis_kelamin', 'jenis_kontrak', 'tanggal_masuk'],
            suggestedMapping: {
              nama_lengkap: 'nama_lengkap',
              no_ktp: 'no_ktp',
              jenis_kelamin: 'jenis_kelamin',
              jenis_kontrak: 'jenis_kontrak',
              tanggal_masuk: 'tanggal_masuk',
            },
            rows: [['Budi Santoso', '3201234567890001', 'L', 'PKWTT', '2023-01-12']],
            totalRows: 1,
            requiredMapped: true,
          })
        }
        if (url.includes('/api/employees/import/commit')) {
          commitBodies.push(init?.body)
          return json({ created: 1, skipped: 0, errors: [] })
        }
        return json({})
      }),
    )

    render(<ImportEmployeesPage />)
    const input = screen.getByLabelText(/Tarik file CSV di sini/)
    fireEvent.change(input, {
      target: {
        files: [
          makeFile(
            'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
              'Budi Santoso,3201234567890001,L,PKWTT,2023-01-12\n',
          ),
        ],
      },
    })
    await screen.findByRole('heading', { name: 'Pemetaan Kolom' })
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke Preview' }))
    await screen.findByRole('heading', { name: 'Preview & Import' })

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Karyawan' }))

    await waitFor(() => expect(commitBodies).toHaveLength(1))
    const body = JSON.parse(String(commitBodies[0])) as {
      rows: Array<Record<string, string>>
      columnMapping: Record<string, string>
    }
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0]).toMatchObject({
      nama_lengkap: 'Budi Santoso',
      no_ktp: '3201234567890001',
      jenis_kelamin: 'L',
      jenis_kontrak: 'pkwtt',
    })
    expect(body.columnMapping).toMatchObject({ no_ktp: 'no_ktp', jenis_kelamin: 'jenis_kelamin' })

    await waitFor(
      () => expect(pushMock).toHaveBeenCalledWith('/employees'),
      { timeout: 2000 },
    )
    expect(screen.getByText('Berhasil mengimpor 1 karyawan')).toBeInTheDocument()
  })

  it('commit dengan baris error server tetap di halaman dan tidak klaim sukses penuh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/employees/import/preview')) {
          return json({
            detectedHeaders: ['nama_lengkap', 'no_ktp', 'jenis_kelamin', 'jenis_kontrak', 'tanggal_masuk'],
            suggestedMapping: {
              nama_lengkap: 'nama_lengkap',
              no_ktp: 'no_ktp',
              jenis_kelamin: 'jenis_kelamin',
              jenis_kontrak: 'jenis_kontrak',
              tanggal_masuk: 'tanggal_masuk',
            },
            rows: [['Budi Santoso', '3201234567890001', 'L', 'PKWTT', '2023-01-12']],
            totalRows: 1,
            requiredMapped: true,
          })
        }
        if (url.includes('/api/employees/import/commit')) {
          return json({
            created: 0,
            skipped: 1,
            errors: [{ rowIndex: 2, errors: ['No KTP sudah terdaftar (duplikat)'] }],
          })
        }
        return json({})
      }),
    )

    render(<ImportEmployeesPage />)
    const input = screen.getByLabelText(/Tarik file CSV di sini/)
    fireEvent.change(input, {
      target: {
        files: [
          makeFile(
            'nama_lengkap,no_ktp,jenis_kelamin,jenis_kontrak,tanggal_masuk\n' +
              'Budi Santoso,3201234567890001,L,PKWTT,2023-01-12\n',
          ),
        ],
      },
    })
    await screen.findByRole('heading', { name: 'Pemetaan Kolom' })
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke Preview' }))
    await screen.findByRole('heading', { name: 'Preview & Import' })

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Karyawan' }))

    // Server error surfaces against the originating row.
    await screen.findByText('No KTP sudah terdaftar (duplikat)')
    expect(screen.getByText(/0 karyawan berhasil diimport/)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
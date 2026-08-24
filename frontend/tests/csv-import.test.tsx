import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ImportEmployeesPage from '@/app/employees/import/page'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

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
      'nama_lengkap,no_ktp,jenis_kontrak,tanggal_masuk\n' +
      ',3201234567890001,PKWTT,2023-01-12\n'
    await goToPreview(csv)

    expect(screen.getByText('Nama kosong')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toContain('0 baris valid, 1 baris error')
  })

  it('menandai format KTP tidak valid', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,123,PKWTT,2023-01-12\n'
    await goToPreview(csv)

    expect(screen.getByText('Format KTP salah (16 digit)')).toBeInTheDocument()
  })

  it('menandai KTP duplikat dengan nomor baris pertama', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,3201234567890001,PKWTT,2023-01-12\n' +
      'Siti Nurhaliza,3201234567890001,PKWT,2023-03-03\n'
    await goToPreview(csv)

    expect(screen.getByText('KTP duplikat baris 2')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toContain('1 baris valid, 1 baris error')
  })

  it('ringkasan preview menampilkan jumlah valid dan error yang akurat', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,3201234567890001,PKWTT,2023-01-12\n' +
      'Siti Nurhaliza,3273011234567890,PKWT,2023-03-03\n' +
      'Ahmad Fauzi,3578010987654321,PKWT,\n'
    await goToPreview(csv)

    expect(screen.getByRole('status').textContent).toContain('2 baris valid, 1 baris error')
  })

  it('tombol import nonaktif saat 0 baris valid', async () => {
    const csv =
      'nama_lengkap,no_ktp,jenis_kontrak,tanggal_masuk\n' +
      'Budi Santoso,123,PKWTT,2023-01-12\n'
    await goToPreview(csv)

    expect(screen.getByRole('button', { name: 'Import 0 Karyawan' })).toBeDisabled()
  })
})
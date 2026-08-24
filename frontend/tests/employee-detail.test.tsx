import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EmployeeDetailPage from '@/app/employees/[id]/page'

let mockId = '1'
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: mockPush }),
  notFound: vi.fn(),
}))

function renderPage(id: string = '1') {
  mockId = id
  return render(<EmployeeDetailPage />)
}

describe('Employee Detail', () => {
  it('merender karyawan berdasarkan id dari mock data', () => {
    renderPage('1')
    expect(screen.getByRole('heading', { level: 1, name: 'Budi Santoso' })).toBeInTheDocument()

    renderPage('2')
    expect(screen.getByRole('heading', { level: 1, name: 'Siti Nurhaliza' })).toBeInTheDocument()
  })

  it('merender 3 section card (Data Pribadi, Dokumen Legal, Kontrak)', () => {
    renderPage('1')
    expect(screen.getByText('Data Pribadi')).toBeInTheDocument()
    expect(screen.getByText('Dokumen Legal')).toBeInTheDocument()
    expect(screen.getByText('Kontrak')).toBeInTheDocument()
    expect(screen.getByText('Custom Fields')).toBeInTheDocument()
  })

  it('menampilkan chip status yang sesuai', () => {
    renderPage('1')
    expect(screen.getByText('Aktif')).toBeInTheDocument()
    expect(screen.getAllByText('PKWTT').length).toBeGreaterThan(0)

    renderPage('5')
    expect(screen.getByText('Nonaktif')).toBeInTheDocument()
  })

  it('tombol Edit mengaktifkan mode edit (field menjadi bisa diedit)', () => {
    renderPage('1')
    expect(screen.queryByLabelText('Nama Lengkap')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Nama Lengkap')).toBeInTheDocument()
    expect(screen.getByLabelText('Nomor KTP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument()
  })

  it('mode edit dibatalkan (Batal) mengembalikan nilai semula', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const nama = screen.getByLabelText('Nama Lengkap')
    fireEvent.change(nama, { target: { value: 'Budi X' } })

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Budi Santoso' })).toBeInTheDocument()
  })

  it('Simpan Perubahan menyimpan ke state lokal', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: 'Budi Santoso Baru' } })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Budi Santoso Baru' })).toBeInTheDocument()
    expect(screen.getAllByText('Budi Santoso Baru').length).toBeGreaterThan(0)
  })

  it('validasi memblokir simpan untuk no_ktp tidak valid', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Nomor KTP'), { target: { value: '123' } })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    expect(screen.getByText('Nomor KTP harus 16 digit')).toBeInTheDocument()
    expect(screen.getByLabelText('Nomor KTP')).toBeInTheDocument()
  })

  it('validasi memblokir simpan untuk tanggal lahir di bawah 17 tahun', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Tanggal Lahir'), { target: { value: '2015-01-01' } })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    expect(
      screen.getByText('Tanggal lahir tidak valid atau usia di bawah 17 tahun'),
    ).toBeInTheDocument()
  })

  it('custom fields merender dari mock config', () => {
    renderPage('1')
    expect(screen.getByText('Ukuran Seragam')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('Nomor SIM')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('(spesifik bisnis Anda)')).toBeInTheDocument()
  })

  it('menambahkan custom field baru lewat dialog memperbarui state', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: /Tambah Field/ }))

    fireEvent.change(screen.getByLabelText('Nama field'), { target: { value: 'Tipe Sepatu' } })
    fireEvent.change(screen.getByLabelText('Nilai'), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Tipe Sepatu')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('toggle status mengubah badge status tanpa reload', () => {
    renderPage('1')
    expect(screen.getByText('Aktif')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Status kepegawaian' }))
    expect(screen.getByText('Nonaktif')).toBeInTheDocument()
    expect(screen.queryByText('Aktif')).not.toBeInTheDocument()
  })

  it('tombol kembali mengarah ke /employees', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke daftar karyawan' }))
    expect(mockPush).toHaveBeenCalledWith('/employees')
  })
})
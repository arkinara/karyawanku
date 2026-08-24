import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import EmployeesPage from '@/app/employees/page'

const employeesPayload = {
  total: 12,
  limit: 200,
  offset: 0,
  employees: [
    { id: '1', nama_lengkap: 'Budi Santoso', no_ktp: '3201234567890001', jenis_kontrak: 'pkwtt', status: 'aktif', tanggal_masuk: '2023-01-12', jenis_kelamin: 'L', tanggal_lahir: '1990-01-01', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '2', nama_lengkap: 'Siti Nurhaliza', no_ktp: '3201234567890002', jenis_kontrak: 'pkwtt', status: 'aktif', tanggal_masuk: '2023-03-03', jenis_kelamin: 'P', tanggal_lahir: '1992-02-02', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '3', nama_lengkap: 'Ahmad Fauzi', no_ktp: '3201234567890003', jenis_kontrak: 'pkwt', status: 'aktif', tanggal_masuk: '2024-07-17', jenis_kelamin: 'L', tanggal_lahir: '1995-05-05', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '4', nama_lengkap: 'Dewi Lestari', no_ktp: '3201234567890004', jenis_kontrak: 'pkl', status: 'aktif', tanggal_masuk: '2026-02-02', jenis_kelamin: 'P', tanggal_lahir: '1998-06-06', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '5', nama_lengkap: 'Rudi Hermawan', no_ktp: '3201234567890005', jenis_kontrak: 'pkwtt', status: 'nonaktif', tanggal_masuk: '2022-09-08', jenis_kelamin: 'L', tanggal_lahir: '1988-09-09', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '6', nama_lengkap: 'Maya Sari', no_ktp: '3201234567890006', jenis_kontrak: 'pkwt', status: 'aktif', tanggal_masuk: '2025-11-21', jenis_kelamin: 'P', tanggal_lahir: '1993-10-10', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '7', nama_lengkap: 'Fajar Nugraha', no_ktp: '3201234567890007', jenis_kontrak: 'pkwt', status: 'aktif', tanggal_masuk: '2025-04-14', jenis_kelamin: 'L', tanggal_lahir: '1996-04-04', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '8', nama_lengkap: 'Lestari Wulandari', no_ktp: '3201234567890008', jenis_kontrak: 'pkwtt', status: 'nonaktif', tanggal_masuk: '2022-06-20', jenis_kelamin: 'P', tanggal_lahir: '1991-07-07', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '9', nama_lengkap: 'Indra Permadi', no_ktp: '3201234567890009', jenis_kontrak: 'harian', status: 'aktif', tanggal_masuk: '2026-01-05', jenis_kelamin: 'L', tanggal_lahir: '1999-08-08', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '10', nama_lengkap: 'Ratna Sari', no_ktp: '3201234567890010', jenis_kontrak: 'pkwt', status: 'aktif', tanggal_masuk: '2024-12-01', jenis_kelamin: 'P', tanggal_lahir: '1994-11-11', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '11', nama_lengkap: 'Hendro Wibowo', no_ktp: '3201234567890011', jenis_kontrak: 'harian', status: 'aktif', tanggal_masuk: '2026-05-11', jenis_kelamin: 'L', tanggal_lahir: '2000-12-12', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
    { id: '12', nama_lengkap: 'Ani Rahmawati', no_ktp: '3201234567890012', jenis_kontrak: 'magang', status: 'aktif', tanggal_masuk: '2026-03-30', jenis_kelamin: 'P', tanggal_lahir: '2002-03-03', business_id: 'b', npwp: null, alamat: null, kontak_darurat: null, ptkp_status: null, custom_fields: null, created_at: 0 },
  ],
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('kk-token', 'test-token')
  localStorage.setItem('kk-user', JSON.stringify({ id: 'u', business_id: 'b', nama: 'Owner', email: 'o@x', role: 'owner' }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/employees')) {
        return new Response(JSON.stringify(employeesPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

function renderPage() {
  return render(<EmployeesPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Employee Directory', () => {
  it('merender 12 baris karyawan', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    expect(rowCount(container)).toBe(12)
    expect(screen.getByText('Ani Rahmawati')).toBeInTheDocument()
    expect(screen.getByText('12 karyawan terdaftar')).toBeInTheDocument()
  })

  it('pencarian memfilter list secara case-insensitive', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })

    fireEvent.change(search, { target: { value: 'budi' } })
    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'SITI NURHALIZA' } })
    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('pencarian tanpa hasil menampilkan empty state', async () => {
    const { findByText } = renderPage()
    await findByText('Budi Santoso')
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })
    fireEvent.change(search, { target: { value: 'zzzz' } })

    expect(screen.getByText('Tidak ada karyawan yang cocok')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Bersihkan pencarian & filter' }),
    ).toBeInTheDocument()
  })

  it('filter status Aktif menyembunyikan karyawan nonaktif', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    fireEvent.click(screen.getByRole('tab', { name: /^Aktif/ }))

    expect(rowCount(container)).toBe(10)
    expect(screen.queryByText('Rudi Hermawan')).not.toBeInTheDocument()
    expect(screen.queryByText('Lestari Wulandari')).not.toBeInTheDocument()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  })

  it('filter jenis kontrak menampilkan hanya yang cocok', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    const select = screen.getByLabelText('Jenis kontrak')

    fireEvent.change(select, { target: { value: 'PKWT' } })
    expect(rowCount(container)).toBe(4)
    expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument()
    expect(screen.getByText('Ratna Sari')).toBeInTheDocument()
    expect(screen.queryByText('Budi Santoso')).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'Magang' } })
    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Ani Rahmawati')).toBeInTheDocument()
  })

  it('filter kombinasi (status + kontrak + search) bekerja bersama', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })
    const select = screen.getByLabelText('Jenis kontrak')

    fireEvent.click(screen.getByRole('tab', { name: /^Aktif/ }))
    fireEvent.change(select, { target: { value: 'PKWTT' } })
    fireEvent.change(search, { target: { value: 'siti' } })

    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('kombinasi tanpa hasil menampilkan empty state, bukan error', async () => {
    const { findByText } = renderPage()
    await findByText('Budi Santoso')
    const select = screen.getByLabelText('Jenis kontrak')

    fireEvent.click(screen.getByRole('tab', { name: /^Nonaktif/ }))
    fireEvent.change(select, { target: { value: 'Magang' } })

    expect(screen.getByText('Tidak ada karyawan yang cocok')).toBeInTheDocument()
  })

  it('reset filter mengembalikan seluruh karyawan', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })
    const select = screen.getByLabelText('Jenis kontrak')

    fireEvent.click(screen.getByRole('tab', { name: /^Nonaktif/ }))
    fireEvent.change(select, { target: { value: 'PKWTT' } })
    fireEvent.change(search, { target: { value: 'rudi' } })
    expect(rowCount(container)).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Reset filter' }))
    expect(rowCount(container)).toBe(12)
    expect(screen.queryByRole('button', { name: 'Reset filter' })).not.toBeInTheDocument()
  })

  it('menampilkan aksi edit & hapus untuk setiap baris', async () => {
    const { container, findByText } = renderPage()
    await findByText('Budi Santoso')
    const firstRow = container.querySelector('tbody tr')! as HTMLElement
    expect(within(firstRow).getByRole('button', { name: 'Edit Budi Santoso' })).toBeInTheDocument()
    expect(within(firstRow).getByRole('button', { name: 'Hapus Budi Santoso' })).toBeInTheDocument()
  })
})
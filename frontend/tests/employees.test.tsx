import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import EmployeesPage from '@/app/employees/page'

function renderPage() {
  return render(<EmployeesPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Employee Directory', () => {
  it('merender 12 baris karyawan', () => {
    const { container } = renderPage()
    expect(rowCount(container)).toBe(12)
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Ani Rahmawati')).toBeInTheDocument()
    expect(screen.getByText('12 karyawan terdaftar')).toBeInTheDocument()
  })

  it('pencarian memfilter list secara case-insensitive', () => {
    const { container } = renderPage()
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })

    fireEvent.change(search, { target: { value: 'budi' } })
    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'SITI NURHALIZA' } })
    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('pencarian tanpa hasil menampilkan empty state', () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })
    fireEvent.change(search, { target: { value: 'zzzz' } })

    expect(screen.getByText('Tidak ada karyawan yang cocok')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bersihkan pencarian & filter' })).toBeInTheDocument()
  })

  it('filter status Aktif menyembunyikan karyawan nonaktif', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /^Aktif/ }))

    expect(rowCount(container)).toBe(10)
    expect(screen.queryByText('Rudi Hermawan')).not.toBeInTheDocument()
    expect(screen.queryByText('Lestari Wulandari')).not.toBeInTheDocument()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  })

  it('filter jenis kontrak menampilkan hanya yang cocok', () => {
    const { container } = renderPage()
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

  it('filter kombinasi (status + kontrak + search) bekerja bersama', () => {
    const { container } = renderPage()
    const search = screen.getByRole('searchbox', { name: 'Cari karyawan' })
    const select = screen.getByLabelText('Jenis kontrak')

    fireEvent.click(screen.getByRole('tab', { name: /^Aktif/ }))
    fireEvent.change(select, { target: { value: 'PKWTT' } })
    fireEvent.change(search, { target: { value: 'siti' } })

    expect(rowCount(container)).toBe(1)
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
  })

  it('kombinasi tanpa hasil menampilkan empty state, bukan error', () => {
    renderPage()
    const select = screen.getByLabelText('Jenis kontrak')

    fireEvent.click(screen.getByRole('tab', { name: /^Nonaktif/ }))
    fireEvent.change(select, { target: { value: 'Magang' } })

    expect(screen.getByText('Tidak ada karyawan yang cocok')).toBeInTheDocument()
  })

  it('reset filter mengembalikan seluruh karyawan', () => {
    const { container } = renderPage()
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

  it('menampilkan aksi edit & hapus untuk setiap baris', () => {
    const { container } = renderPage()
    const firstRow = container.querySelector('tbody tr')! as HTMLElement
    expect(within(firstRow).getByRole('button', { name: 'Edit Budi Santoso' })).toBeInTheDocument()
    expect(within(firstRow).getByRole('button', { name: 'Hapus Budi Santoso' })).toBeInTheDocument()
  })
})
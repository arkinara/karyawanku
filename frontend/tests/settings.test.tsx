import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'

function renderPage() {
  return render(<SettingsPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

const TAB_NAMES = ['Profil Bisnis', 'Jenis Cuti', 'Komponen Gaji', 'Pengguna']

describe('Settings Page', () => {
  it('merender 4 item tab navigasi', () => {
    renderPage()
    for (const name of TAB_NAMES) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
  })

  it('tab navigasi berpindah panel', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
    expect(screen.getByRole('button', { name: /Tambah Jenis Cuti/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
    expect(screen.getByRole('button', { name: /Undang Pengguna/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Komponen Gaji' }))
    expect(screen.getByRole('link', { name: /Kelola Komponen Gaji/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Profil Bisnis' }))
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeInTheDocument()
  })

  describe('Profil Bisnis', () => {
    it('form terisi data awal dan simpan memperbarui state + toast', () => {
      renderPage()
      const namaInput = screen.getByLabelText(/Nama bisnis/)
      expect(namaInput).toHaveValue('Warung Kopi Nusantara')
      expect(screen.getByLabelText(/Jenis usaha/)).toHaveValue('fnb')
      expect(screen.getByLabelText(/Alamat/)).toHaveValue('Jl. Melati No. 12, Jakarta Selatan')

      fireEvent.change(namaInput, { target: { value: 'Kopi Kita' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))

      expect(screen.getByRole('status')).toHaveTextContent(/tersimpan/)
      expect(namaInput).toHaveValue('Kopi Kita')
    })

    it('validasi: nama bisnis kosong menahan simpan', () => {
      renderPage()
      fireEvent.change(screen.getByLabelText(/Nama bisnis/), { target: { value: '' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
      expect(screen.getByText('Nama bisnis wajib diisi')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('Jenis Cuti', () => {
    it('merender 4 jenis cuti default', () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
      expect(rowCount(container)).toBe(4)
      expect(screen.getByText('Cuti Tahunan')).toBeInTheDocument()
      expect(screen.getByText('Cuti Sakit')).toBeInTheDocument()
      expect(screen.getByText('Cuti Izin')).toBeInTheDocument()
      expect(screen.getByText('Cuti Melahirkan')).toBeInTheDocument()
      expect(screen.getByText('Carry-over max 5 hari')).toBeInTheDocument()
      expect(screen.getAllByText('Hangus').length).toBeGreaterThanOrEqual(1)
    })

    it('dialog tambah jenis cuti memvalidasi field wajib', () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Jenis Cuti' }))
      fireEvent.click(screen.getByRole('button', { name: /Tambah Jenis Cuti/ }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
      expect(screen.getByText('Nama jenis cuti wajib diisi')).toBeInTheDocument()
      expect(screen.getByText('Kuota harus angka minimal 0')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/Nama jenis cuti/), { target: { value: 'Cuti Menikah' } })
      fireEvent.change(screen.getByLabelText(/Default Kuota/), { target: { value: '3' } })
      fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

      expect(rowCount(container)).toBe(5)
      expect(screen.getByText('Cuti Menikah')).toBeInTheDocument()
    })
  })

  describe('Komponen Gaji', () => {
    it('menampilkan jumlah komponen aktif dan tautan ke /salary-components', () => {
      renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Komponen Gaji' }))
      expect(screen.getByText(/7 komponen aktif/)).toBeInTheDocument()
      expect(screen.getByText(/Atur komponen gaji default di halaman Komponen Gaji/)).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /Kelola Komponen Gaji/ })
      expect(link).toHaveAttribute('href', '/salary-components')
    })
  })

  describe('Pengguna & Role', () => {
    it('merender 6 pengguna dengan role dan status', () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
      expect(rowCount(container)).toBe(6)
      expect(screen.getByText('darmawan@warungkopi.id')).toBeInTheDocument()
      expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Nonaktif')).toBeInTheDocument()
    })

    it('ubah role mengubah state', () => {
      renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
      const select = screen.getByLabelText(/Ubah role Siti Nurhaliza/)
      expect(select).toHaveValue('employee')
      fireEvent.change(select, { target: { value: 'owner' } })
      expect(select).toHaveValue('owner')
    })

    it('dialog undang pengguna menambah user dengan role terpilih', () => {
      const { container } = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'Pengguna' }))
      fireEvent.click(screen.getByRole('button', { name: /Undang Pengguna/ }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'baru@warungkopi.id' } })
      fireEvent.change(screen.getByLabelText(/Role/), { target: { value: 'owner' } })
      fireEvent.click(screen.getByRole('button', { name: 'Undang' }))

      expect(rowCount(container)).toBe(7)
      expect(screen.getByText('baru@warungkopi.id')).toBeInTheDocument()
    })
  })
})

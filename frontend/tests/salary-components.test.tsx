import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SalaryComponentsPage from '@/app/salary-components/page'

function renderPage() {
  return render(<SalaryComponentsPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

describe('Salary Components Builder', () => {
  it('merender 8 komponen mock di tabel', () => {
    const { container } = renderPage()
    expect(rowCount(container)).toBe(8)
    expect(screen.getByText('8 komponen terdaftar')).toBeInTheDocument()
    expect(screen.getByText('Gaji Pokok')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Transport')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Makan')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Jabatan')).toBeInTheDocument()
    expect(screen.getByText('Lembur per Jam')).toBeInTheDocument()
    expect(screen.getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(screen.getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(screen.getByText('PPh 21')).toBeInTheDocument()
  })

  it('filter Pendapatan hanya menampilkan komponen earning', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /^Pendapatan/ }))

    expect(rowCount(container)).toBe(5)
    expect(screen.getByText('Gaji Pokok')).toBeInTheDocument()
    expect(screen.getByText('Lembur per Jam')).toBeInTheDocument()
    expect(screen.queryByText('BPJS Kesehatan')).not.toBeInTheDocument()
    expect(screen.queryByText('PPh 21')).not.toBeInTheDocument()
  })

  it('filter Potongan hanya menampilkan komponen deduction', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('tab', { name: /^Potongan/ }))

    expect(rowCount(container)).toBe(3)
    expect(screen.getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(screen.getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(screen.getByText('PPh 21')).toBeInTheDocument()
    expect(screen.queryByText('Gaji Pokok')).not.toBeInTheDocument()
    expect(screen.queryByText('Tunjangan Makan')).not.toBeInTheDocument()
  })

  it('dialog Tambah Komponen terbuka dan memvalidasi field wajib', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tambah Komponen/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(screen.getByText('Nama komponen wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Tipe komponen wajib dipilih')).toBeInTheDocument()
    expect(screen.getByText('Nominal wajib diisi')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Nama Komponen/), { target: { value: 'Uang Lembur' } })
    fireEvent.change(screen.getByLabelText(/Tipe/), { target: { value: 'earning' } })
    fireEvent.change(screen.getByLabelText(/Nominal/), { target: { value: '150000' } })

    expect(screen.getByText('Pratinjau: Rp 150.000')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(rowCount(container)).toBe(9)
    expect(screen.getByText('Uang Lembur')).toBeInTheDocument()
  })

  it('dialog Edit mengisi nilai awal komponen', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gaji Pokok' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit Komponen')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nama Komponen/)).toHaveValue('Gaji Pokok')
    expect(screen.getByLabelText(/Tipe/)).toHaveValue('earning')
    expect(screen.getByLabelText(/Nominal/)).toHaveValue('3500000')
  })

  it('dialog Hapus menampilkan nama komponen pada konfirmasi', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Hapus Gaji Pokok' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hapus komponen Gaji Pokok? Tindakan ini tidak bisa dibatalkan.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
    expect(rowCount(container)).toBe(7)
    expect(screen.queryByText('Gaji Pokok')).not.toBeInTheDocument()
  })

  it('mode Formula menampilkan kalkulator preview', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tambah Komponen/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Formula' }))

    expect(screen.getByRole('button', { name: /Hitung Preview/ })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Formula/), { target: { value: 'jam_kerja * tarif_lembur' } })
    fireEvent.click(screen.getByRole('button', { name: /Hitung Preview/ }))

    expect(screen.getByText('Hasil: Rp 200.000')).toBeInTheDocument()
  })
})
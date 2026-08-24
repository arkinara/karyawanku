import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EmployeeSalaryPage from '@/app/employees/[id]/salary/page'
import { evaluateFormula, evaluateFormulaResult } from '@/lib/formula'

let mockId = '1'
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: mockPush }),
  notFound: vi.fn(),
}))

function renderPage(id: string = '1') {
  mockId = id
  return render(<EmployeeSalaryPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

/** Footer lines render label + value as separate text nodes; match on full textContent. */
function footerLine(text: string) {
  return screen.getByText((_content: string, el: Element | null) => el?.textContent === text)
}

describe('Employee Salary Assignment', () => {
  it('merender tabel assignment untuk Budi Santoso (id=1)', () => {
    const { container } = renderPage('1')
    expect(screen.getByRole('heading', { level: 1, name: 'Budi Santoso' })).toBeInTheDocument()
    expect(screen.getByText('Setup gaji untuk Budi Santoso')).toBeInTheDocument()

    expect(rowCount(container)).toBe(4)
    expect(screen.getByText('Gaji Pokok')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan Makan')).toBeInTheDocument()
    expect(screen.getByText('Lembur per Jam')).toBeInTheDocument()
    expect(screen.getByText('BPJS Kesehatan')).toBeInTheDocument()
  })

  it('merender tabel assignment untuk Siti Nurhaliza (id=2)', () => {
    const { container } = renderPage('2')
    expect(screen.getByRole('heading', { level: 1, name: 'Siti Nurhaliza' })).toBeInTheDocument()
    expect(rowCount(container)).toBe(4)
  })

  it('merender tabel assignment untuk Ahmad Fauzi (id=3)', () => {
    const { container } = renderPage('3')
    expect(screen.getByRole('heading', { level: 1, name: 'Ahmad Fauzi' })).toBeInTheDocument()
    expect(rowCount(container)).toBe(3)
  })

  it('footer total menghitung take-home dengan benar', () => {
    renderPage('1')
    // Gaji pokok 3.500.000 + tunjangan (Makan override 400.000 + Lembur 200.000)
    // − potongan (BPJS Kesehatan 35.000) = 4.065.000
    expect(footerLine('Total gaji pokok: Rp 3.500.000')).toBeInTheDocument()
    expect(footerLine('Total tunjangan: Rp 600.000')).toBeInTheDocument()
    expect(footerLine('Total potongan: Rp 35.000')).toBeInTheDocument()
    expect(footerLine('Take-home: Rp 4.065.000')).toBeInTheDocument()
  })

  it('dialog Tambah hanya menawarkan komponen yang belum di-assign', () => {
    const { container } = renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: /Tambah Komponen/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const select = screen.getByRole('combobox', { name: /Komponen/ })
    expect(select).toBeInTheDocument()

    // Budi sudah assign sc-1, sc-3, sc-5, sc-6 → tersisa sc-2, sc-4, sc-7.
    const enabled = Array.from(
      container.querySelectorAll('#asg-component option:not(:disabled)'),
    ).map((o) => o.textContent)

    expect(enabled).toContain('Tunjangan Transport')
    expect(enabled).toContain('Tunjangan Jabatan')
    expect(enabled).toContain('BPJS Ketenagakerjaan')
    expect(enabled).not.toContain('Gaji Pokok')
    expect(enabled).not.toContain('Tunjangan Makan')

    expect(screen.getByRole('option', { name: /Gaji Pokok/ })).toBeDisabled()
    // Komponen builder yang nonaktif (PPh 21) tidak muncul sama sekali.
    expect(screen.queryByRole('option', { name: /PPh 21/ })).not.toBeInTheDocument()
  })

  it('override nominal memperbarui nominal efektif', () => {
    const { container } = renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: /Tambah Komponen/ }))

    fireEvent.change(screen.getByRole('combobox', { name: /Komponen/ }), {
      target: { value: 'sc-2' },
    })
    // Default terisi nominal komponen: Rp 400.000.
    expect(screen.getByLabelText('Override Nominal')).toHaveValue('400000')
    expect(screen.getByText('Pratinjau: Rp 400.000')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Override Nominal'), { target: { value: '500000' } })
    expect(screen.getByText('Pratinjau: Rp 500.000')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(rowCount(container)).toBe(5)
    expect(screen.getByText('Rp 500.000')).toBeInTheDocument()
    // Sumber chip menjadi Override (Makan yang sudah ada + Transport baru).
    expect(screen.getAllByText('Override').length).toBe(2)
  })

  it('preview formula memperbarui saat input diubah', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lembur per Jam' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Formula tampil di preview dialog dan di kolom tabel (subtext).
    expect(screen.getAllByText('jam_kerja * tarif_lembur').length).toBeGreaterThan(0)

    // Gaji pokok & jam kerja terisi dari data karyawan.
    expect(screen.getByLabelText('Gaji Pokok')).toHaveValue('3500000')
    expect(screen.getByLabelText('Jam Kerja')).toHaveValue('8')
    expect(screen.getByText('→ Rp 200.000')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Jam Kerja'), { target: { value: '10' } })
    expect(screen.getByText('→ Rp 250.000')).toBeInTheDocument()
  })

  it('aksi Nonaktifkan menyembunyikan assignment dari daftar aktif', () => {
    const { container } = renderPage('1')
    expect(screen.getByText('BPJS Kesehatan')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan BPJS Kesehatan' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText('Nonaktifkan BPJS Kesehatan untuk Budi Santoso? Data historis tetap tersimpan.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan' }))
    expect(rowCount(container)).toBe(3)
    expect(screen.queryByText('BPJS Kesehatan')).not.toBeInTheDocument()
  })

  it('tombol kembali mengarah ke profil karyawan', () => {
    renderPage('1')
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke profil karyawan' }))
    expect(mockPush).toHaveBeenCalledWith('/employees/1')
  })
})

describe('Formula evaluator', () => {
  it('mengevaluasi formula valid', () => {
    expect(evaluateFormula('jam_kerja * tarif_lembur', { jam_kerja: 8, tarif_lembur: 25000 })).toBe(
      200000,
    )
    expect(evaluateFormula('gaji_pokok * 0.01', { gaji_pokok: 3500000 })).toBe(35000)
    expect(evaluateFormula('gaji_pokok * 0.02', { gaji_pokok: 3000000 })).toBe(60000)
    expect(evaluateFormula('(gaji_pokok + jam_lembur) / 2', { gaji_pokok: 100, jam_lembur: 20 })).toBe(
      60,
    )
    expect(evaluateFormula('-gaji_pokok + 5', { gaji_pokok: 10 })).toBe(-5)
  })

  it('menolak formula tidak valid', () => {
    expect(evaluateFormula('jam_kerja **', { jam_kerja: 8 })).toBeNaN()
    expect(evaluateFormula('8 +', {})).toBeNaN()
    expect(evaluateFormula('8 / 0', {})).toBeNaN()
    expect(evaluateFormula('(jam_kerja', { jam_kerja: 8 })).toBeNaN()
    expect(evaluateFormula('foo * 2', {})).toBeNaN()
    expect(evaluateFormula('', {})).toBeNaN()

    const bad = evaluateFormulaResult('8 / 0', {})
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toBe('Pembagian dengan nol')
  })
})
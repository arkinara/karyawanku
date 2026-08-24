import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import PayrollPage from '@/app/payroll/page'

function renderPage() {
  return render(<PayrollPage />)
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody tr').length
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr')
  if (!row) throw new Error(`Baris untuk ${name} tidak ditemukan`)
  return row
}

describe('Payroll Run Page', () => {
  it('merender 12 baris breakdown + baris total di footer', () => {
    const { container } = renderPage()

    expect(rowCount(container)).toBe(12)
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Ani Rahmawati')).toBeInTheDocument()

    const foot = container.querySelector('tfoot')
    expect(foot).not.toBeNull()
    expect(foot!.textContent).toContain('Total')
    expect(foot!.textContent).toContain('Rp 26.000.000')
    expect(foot!.textContent).toContain('Rp 2.500.000')
    expect(foot!.textContent).toContain('Rp 4.200.000')
    expect(foot!.textContent).toContain('Rp 24.300.000')
  })

  it('menampilkan ringkasan metric card sesuai spesifikasi', () => {
    renderPage()
    expect(screen.getByText('Total Karyawan')).toBeInTheDocument()
    expect(screen.getByText('Total Gaji')).toBeInTheDocument()
    expect(screen.getByText('Total Potongan')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 28.500.000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rp 24.300.000').length).toBeGreaterThan(0)
  })

  it('kolom mata uang rata kanan dan memakai tabular-nums', () => {
    const { container } = renderPage()

    const takeHomeHeader = screen.getByRole('columnheader', { name: 'Take-Home' })
    expect(takeHomeHeader).toHaveClass('text-right')

    const gajiPokokCell = within(rowOf('Budi Santoso')).getByText('Rp 2.600.000')
    expect(gajiPokokCell).toHaveClass('tabular-nums')

    const currencyCells = container.querySelectorAll('td.tabular-nums')
    expect(currencyCells.length).toBeGreaterThanOrEqual(4 * 12)
  })

  it('dialog Edit Koreksi memperbarui take-home baris', () => {
    const { container } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Budi Santoso' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit Koreksi')).toBeInTheDocument()
    expect(screen.getByLabelText(/Penyesuaian/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Catatan/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Penyesuaian/), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText(/Catatan/), {
      target: { value: 'lembur 2 jam belum tercatat' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(rowOf('Budi Santoso')).getByText('Rp 2.520.000')).toBeInTheDocument()
    expect(rowCount(container)).toBe(12)
  })

  it('ekspansi Detail menampilkan breakdown komponen per karyawan', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Detail Budi Santoso' }))

    const expanded = screen.getByText('Pendapatan').closest('tr')
    expect(expanded).not.toBeNull()
    expect(within(expanded!).getByText('Gaji Pokok')).toBeInTheDocument()
    expect(within(expanded!).getByText('Tunjangan Transport')).toBeInTheDocument()
    expect(within(expanded!).getByText('Potongan')).toBeInTheDocument()
    expect(within(expanded!).getByText('BPJS Kesehatan')).toBeInTheDocument()
    expect(within(expanded!).getByText('BPJS Ketenagakerjaan')).toBeInTheDocument()
    expect(within(expanded!).getByText('PPh 21')).toBeInTheDocument()
    expect(within(expanded!).getByText('Rp 2.420.000')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Detail Budi Santoso' }))
    expect(screen.queryByText('Pendapatan')).not.toBeInTheDocument()
  })

  it('dialog Setujui menampilkan ringkasan total dan peringatan', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Setujui Payroll?')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent?.replace(/\s+/g, ' ').trim() ===
            '12 karyawan · Take-home total Rp 24.300.000',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Setelah disetujui, payroll tidak bisa diedit lagi'),
    ).toBeInTheDocument()
  })

  it('aksi Setujui mengubah status menjadi Disetujui', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))

    expect(screen.getByText('Disetujui')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Setujui Payroll' })).not.toBeInTheDocument()
    expect(screen.queryByText('Draft — Belum disetujui')).not.toBeInTheDocument()
  })

  it('setelah approve, tombol edit terkunci', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Setujui Payroll' }))
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))

    expect(screen.getByRole('button', { name: 'Edit Budi Santoso' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit Ani Rahmawati' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Detail Budi Santoso' })).toBeEnabled()
  })

  it('Ekspor CSV memicu unduhan dan menampilkan toast', () => {
    let downloaded: HTMLAnchorElement | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this
      })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-payroll'),
      revokeObjectURL: vi.fn(),
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Ekspor CSV/ }))

    expect(clickSpy).toHaveBeenCalled()
    expect(downloaded).not.toBeNull()
    expect(downloaded!.download).toBe('payroll-agustus-2026.csv')
    expect(downloaded!.href).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent('File CSV berhasil diunduh')

    vi.unstubAllGlobals()
    clickSpy.mockRestore()
  })
})
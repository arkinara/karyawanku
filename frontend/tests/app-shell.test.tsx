import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AppShell } from '@/components/ui/app-shell'

function renderOwnerShell() {
  return render(
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Ringkasan hari ini"
      subtitle="Warung Kopi Nusantara · Rabu, 19 Agustus 2026"
    >
      <p>Konten halaman</p>
    </AppShell>,
  )
}

describe('AppShell', () => {
  it('merender title dan subtitle', () => {
    renderOwnerShell()
    expect(screen.getByText('Ringkasan hari ini')).toBeInTheDocument()
    expect(screen.getByText('Warung Kopi Nusantara · Rabu, 19 Agustus 2026')).toBeInTheDocument()
  })

  it('menampilkan 5 nav item primary owner di rail', () => {
    renderOwnerShell()
    const rail = screen.getByRole('navigation', { name: 'Navigasi utama' })
    const labels = ['Ringkasan', 'Karyawan', 'Absensi', 'Cuti', 'Payroll']
    for (const label of labels) {
      expect(within(rail).getByText(label)).toBeInTheDocument()
    }
    // Nav sekunder ("Pengaturan") juga tampil di rail.
    expect(within(rail).getByText('Pengaturan')).toBeInTheDocument()
  })

  it('menandai nav item aktif dengan aria-current="page"', () => {
    renderOwnerShell()
    const rail = screen.getByRole('navigation', { name: 'Navigasi utama' })
    const active = within(rail).getByText('Karyawan').closest('a')
    expect(active).toHaveAttribute('aria-current', 'page')
    const inactive = within(rail).getByText('Payroll').closest('a')
    expect(inactive).not.toHaveAttribute('aria-current')
  })

  it('skip-link adalah elemen focusable pertama', () => {
    const { container } = renderOwnerShell()
    const skip = container.querySelector('a.skip-link')
    expect(skip).not.toBeNull()
    const focusables = container.querySelectorAll('a[href], button:not([disabled])')
    expect(focusables.length).toBeGreaterThan(0)
    expect(focusables[0]).toBe(skip)
  })

  it('drawer tertutup secara default', () => {
    const { container } = renderOwnerShell()
    const drawer = container.querySelector('#kk-drawer')
    expect(drawer).not.toBeNull()
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(drawer).not.toHaveAttribute('data-open')
  })
})
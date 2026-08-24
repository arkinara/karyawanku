import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

describe('Quick Dashboard (Owner)', () => {
  it('menampilkan judul halaman yang menyapa Pak Darmawan', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Selamat pagi, Pak Darmawan')).toBeInTheDocument()
    expect(screen.getByText('Ringkasan hari ini')).toBeInTheDocument()
  })

  it('merender 4 metric card dengan nilai yang benar', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Total karyawan')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Hadir hari ini')).toBeInTheDocument()
    expect(screen.getByText('/12')).toBeInTheDocument()
    expect(screen.getByText('Cuti menunggu')).toBeInTheDocument()
    expect(screen.getByText('Gaji bulan ini')).toBeInTheDocument()
    expect(screen.getByText('Rp 28.500.000')).toBeInTheDocument()
  })

  it('merender priority banner dengan judul dan tombol aksi', () => {
    render(<DashboardPage />)
    expect(
      screen.getByText('2 pengajuan cuti menunggu keputusan Anda'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tinjau' })).toBeInTheDocument()
  })

  it('merender ringkasan kehadiran dengan 4 statistik', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Kehadiran Hari Ini')).toBeInTheDocument()
    expect(screen.getByText('Hadir')).toBeInTheDocument()
    expect(screen.getByText('Telat')).toBeInTheDocument()
    expect(screen.getByText('Absen')).toBeInTheDocument()
    expect(screen.getByText('Izin')).toBeInTheDocument()
  })

  it('merender daftar cuti menunggu dengan 2 item', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Cuti Menunggu Persetujuan')).toBeInTheDocument()
    expect(screen.getByText('Siti Nurhaliza')).toBeInTheDocument()
    expect(screen.getByText('Budi Prasetyo')).toBeInTheDocument()
    expect(screen.getByText('Cuti Tahunan')).toBeInTheDocument()
    expect(screen.getByText('Izin Sakit')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Setujui' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Tolak' })).toHaveLength(2)
  })

  it('merender 3 kartu aksi cepat', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Rekap absensi')).toBeInTheDocument()
    expect(screen.getByText('Tambah karyawan')).toBeInTheDocument()
    expect(screen.getByText('Jalankan payroll')).toBeInTheDocument()
  })
})

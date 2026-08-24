import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import OnboardingPage from '@/app/onboarding/page'
import { WIZARD_STORAGE_KEY } from '@/app/onboarding/use-wizard'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  pushMock.mockClear()
})

function fillStep1() {
  fireEvent.change(screen.getByLabelText(/Nama bisnis/), {
    target: { value: 'Warung Kopi Nusantara' },
  })
  fireEvent.change(screen.getByLabelText(/Jenis usaha/), { target: { value: 'fnb' } })
  fireEvent.change(screen.getByLabelText(/Alamat/), {
    target: { value: 'Jl. Melati No. 12, Jakarta Selatan' },
  })
}

async function goToStep2() {
  fillStep1()
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
  await screen.findByRole('heading', { name: /Komponen gaji standar/ })
}

describe('OnboardingPage', () => {
  it('merender field step 1 (profil usaha)', () => {
    render(<OnboardingPage />)
    expect(screen.getByLabelText(/Nama bisnis/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Jenis usaha/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Alamat/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Ceritakan tentang usaha Anda/ })).toBeInTheDocument()
  })

  it('tombol Lanjut nonaktif saat nama_bisnis kosong', () => {
    render(<OnboardingPage />)
    const next = screen.getByRole('button', { name: 'Lanjut' })
    expect(next).toBeDisabled()
    // Mengisi jenis + alamat saja tidak cukup — nama bisnis masih wajib.
    fireEvent.change(screen.getByLabelText(/Jenis usaha/), { target: { value: 'fnb' } })
    fireEvent.change(screen.getByLabelText(/Alamat/), { target: { value: 'Jl. Test' } })
    expect(next).toBeDisabled()
  })

  it('isi step 1 lalu klik Lanjut menampilkan step 2', async () => {
    render(<OnboardingPage />)
    const next = screen.getByRole('button', { name: 'Lanjut' })
    expect(next).toBeDisabled()
    fillStep1()
    expect(next).not.toBeDisabled()
    fireEvent.click(next)
    await screen.findByRole('heading', { name: /Komponen gaji standar/ })
  })

  it('toggle komponen di step 2 mengubah state', async () => {
    render(<OnboardingPage />)
    await goToStep2()

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(6)

    const transport = screen.getByRole('switch', { name: /Tunjangan transport/ })
    expect(transport).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(transport)
    expect(transport).toHaveAttribute('aria-checked', 'false')
  })

  it('tombol Skip di step 2 langsung ke konfirmasi', async () => {
    render(<OnboardingPage />)
    await goToStep2()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByRole('heading', { name: /Periksa kembali/ })
  })

  it('step 3 menampilkan ringkasan data step 1 + step 2', async () => {
    render(<OnboardingPage />)
    await goToStep2()

    // Nonaktifkan tunjangan jabatan — harus tidak muncul di ringkasan.
    fireEvent.click(screen.getByRole('switch', { name: /Tunjangan jabatan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
    await screen.findByRole('heading', { name: /Periksa kembali/ })

    expect(screen.getByText('Warung Kopi Nusantara')).toBeInTheDocument()
    expect(screen.getByText('F&B')).toBeInTheDocument()
    expect(screen.getByText('Jl. Melati No. 12, Jakarta Selatan')).toBeInTheDocument()

    expect(screen.getByText('Gaji pokok')).toBeInTheDocument()
    expect(screen.getByText('Tunjangan makan')).toBeInTheDocument()
    expect(screen.queryByText('Tunjangan jabatan')).not.toBeInTheDocument()
  })

  it('localStorage menyimpan data wizard saat reload', async () => {
    const { unmount } = render(<OnboardingPage />)
    await goToStep2()

    fireEvent.click(screen.getByRole('switch', { name: /Tunjangan makan/ }))
    expect(localStorage.getItem(WIZARD_STORAGE_KEY)).not.toBeNull()

    unmount()
    render(<OnboardingPage />)

    // Step 2 langsung terbuka kembali dengan toggle yang tersimpan.
    await screen.findByRole('heading', { name: /Komponen gaji standar/ })
    expect(screen.getByRole('switch', { name: /Tunjangan makan/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('Selesaikan Setup menghapus draft, tampilkan toast, dan redirect ke /dashboard', async () => {
    render(<OnboardingPage />)
    await goToStep2()
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
    await screen.findByRole('heading', { name: /Periksa kembali/ })

    expect(localStorage.getItem(WIZARD_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan Setup' }))

    expect(screen.getByRole('status')).toHaveTextContent(/Setup selesai/)
    expect(localStorage.getItem(WIZARD_STORAGE_KEY)).toBeNull()

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'), { timeout: 2000 })
  })
})
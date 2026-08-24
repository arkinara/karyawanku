import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SignInPage from '@/app/signin/page'
import SignUpPage from '@/app/signup/page'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  pushMock.mockClear()
})

describe('SignInPage', () => {
  it('merender field email + kata sandi + tombol Masuk', () => {
    render(<SignInPage />)
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Kata sandi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('submit dengan email kosong menampilkan error validasi', () => {
    render(<SignInPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(screen.getByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByText('Kata sandi wajib diisi.')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('submit dengan kredensial mock valid redirect ke /dashboard', async () => {
    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'owner@usaha.com' } })
    fireEvent.change(screen.getByLabelText(/^Kata sandi/), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'), { timeout: 3000 })
  })

  it('toggle show/hide mengubah tipe input tanpa mengubah value', () => {
    render(<SignInPage />)
    const password = screen.getByLabelText(/^Kata sandi/) as HTMLInputElement
    fireEvent.change(password, { target: { value: 'rahasia123' } })

    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan kata sandi' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('rahasia123')

    fireEvent.click(screen.getByRole('button', { name: 'Sembunyikan kata sandi' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue('rahasia123')
  })
})

describe('SignUpPage', () => {
  it('merender field nama, email, kata sandi, dan konfirmasi', () => {
    render(<SignUpPage />)
    expect(screen.getByLabelText(/^Nama/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Kata sandi/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Konfirmasi kata sandi/)).toBeInTheDocument()
  })

  it('password tidak cocok menampilkan error', () => {
    render(<SignUpPage />)
    fireEvent.change(screen.getByLabelText(/^Kata sandi/), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/^Konfirmasi kata sandi/), {
      target: { value: 'different1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }))

    expect(screen.getByText('Konfirmasi kata sandi tidak cocok.')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('submit form valid redirect ke /onboarding', async () => {
    render(<SignUpPage />)
    fireEvent.change(screen.getByLabelText(/^Nama/), { target: { value: 'Pak Darmawan' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'owner@usaha.com' } })
    fireEvent.change(screen.getByLabelText(/^Kata sandi/), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/^Konfirmasi kata sandi/), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/onboarding'), { timeout: 3000 })
  })
})

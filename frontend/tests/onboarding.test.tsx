import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import OnboardingPage from '@/app/onboarding/page'
import { WIZARD_STORAGE_KEY } from '@/app/onboarding/use-wizard'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

/** Captured requests for assertions (path → body). */
const { posts, puts } = vi.hoisted(() => ({ posts: [] as Array<Record<string, unknown>>, puts: [] as Array<Record<string, unknown>> }))

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let createdComponentId = 0

function stubFetch() {
  createdComponentId = 0
  posts.length = 0
  puts.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      const u = new URL(url, 'http://localhost')
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined

      // Step 2 defaults fetch — return an empty set so the wizard keeps its
      // local defaults (which are then created via POST salary-components).
      if (u.pathname === '/api/salary-components' && method === 'GET') {
        return json({ components: [] })
      }

      if (u.pathname === '/api/businesses' && method === 'POST') {
        if (body) posts.push({ path: u.pathname, ...body })
        return json({
          user: { id: 'u-1', business_id: 'b-1', nama: 'Pak Darmawan', email: 'darmawan@usaha.id', role: 'owner' },
          token: 'jwt-token',
          business: { id: 'b-1' },
        })
      }

      if (u.pathname === '/api/salary-components' && method === 'POST') {
        if (body) posts.push({ path: u.pathname, ...body })
        createdComponentId += 1
        return json({ component: { id: `sc-${createdComponentId}` } })
      }

      if (u.pathname.endsWith('/default-salary-components') && method === 'PUT') {
        if (body) puts.push({ path: u.pathname, ...body })
        return json({ components: [] })
      }

      return json({})
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  pushMock.mockClear()
  stubFetch()
})

function fillStep1() {
  fireEvent.change(screen.getByLabelText(/Nama bisnis/), {
    target: { value: 'Warung Kopi Nusantara' },
  })
  fireEvent.change(screen.getByLabelText(/Jenis usaha/), { target: { value: 'fnb' } })
  fireEvent.change(screen.getByLabelText(/Alamat/), {
    target: { value: 'Jl. Melati No. 12, Jakarta Selatan' },
  })
  fireEvent.change(screen.getByLabelText(/Nama lengkap/), { target: { value: 'Pak Darmawan' } })
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'darmawan@usaha.id' } })
  fireEvent.change(screen.getByLabelText(/Kata sandi/), { target: { value: 'rahasia123' } })
}

async function goToStep2() {
  fillStep1()
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
  await screen.findByRole('heading', { name: /Komponen gaji standar/ })
}

describe('OnboardingPage', () => {
  it('merender field step 1 (profil usaha + akun owner)', () => {
    render(<OnboardingPage />)
    expect(screen.getByLabelText(/Nama bisnis/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Jenis usaha/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Alamat/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nama lengkap/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Kata sandi/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Ceritakan tentang usaha Anda/ })).toBeInTheDocument()
  })

  it('tombol Lanjut nonaktif saat nama_bisnis atau akun owner belum lengkap', () => {
    render(<OnboardingPage />)
    const next = screen.getByRole('button', { name: 'Lanjut' })
    expect(next).toBeDisabled()
    // Mengisi jenis + alamat saja tidak cukup.
    fireEvent.change(screen.getByLabelText(/Jenis usaha/), { target: { value: 'fnb' } })
    fireEvent.change(screen.getByLabelText(/Alamat/), { target: { value: 'Jl. Test' } })
    expect(next).toBeDisabled()
    // Akun owner lengkap → tombol aktif.
    fireEvent.change(screen.getByLabelText(/Nama lengkap/), { target: { value: 'Owner' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'o@x.id' } })
    fireEvent.change(screen.getByLabelText(/Kata sandi/), { target: { value: 'rahasia123' } })
    fireEvent.change(screen.getByLabelText(/Nama bisnis/), { target: { value: 'Warung' } })
    expect(next).not.toBeDisabled()
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

  it('step 2 mengambil komponen default dari BE (GET ?defaults=true)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const u = new URL(url, 'http://localhost')
        if (u.pathname === '/api/salary-components' && (init?.method ?? 'GET') === 'GET') {
          return json({
            components: [
              { id: 'sc-gaji', nama_komponen: 'Gaji Pokok', tipe: 'earning', nominal: 3000000, formula: null, aktif: true, is_default: true },
              { id: 'sc-transport', nama_komponen: 'Tunjangan Transport', tipe: 'earning', nominal: 400000, formula: null, aktif: true, is_default: true },
              { id: 'sc-bpjs', nama_komponen: 'BPJS Kesehatan', tipe: 'deduction', nominal: null, formula: 'gaji_pokok * 0.01', aktif: true, is_default: true },
            ],
          })
        }
        return json({})
      }),
    )
    render(<OnboardingPage />)
    await goToStep2()

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /Gaji Pokok/ })).toBeInTheDocument()
    })
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(screen.getByRole('switch', { name: /Tunjangan Transport/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
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

    fireEvent.click(screen.getByRole('switch', { name: /Tunjangan jabatan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
    await screen.findByRole('heading', { name: /Periksa kembali/ })

    expect(screen.getByText('Warung Kopi Nusantara')).toBeInTheDocument()
    expect(screen.getByText('F&B')).toBeInTheDocument()
    expect(screen.getByText('Jl. Melati No. 12, Jakarta Selatan')).toBeInTheDocument()
    expect(screen.getByText('darmawan@usaha.id')).toBeInTheDocument()

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

    await screen.findByRole('heading', { name: /Komponen gaji standar/ })
    expect(screen.getByRole('switch', { name: /Tunjangan makan/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('Selesaikan Setup memanggil POST /api/businesses dengan payload benar lalu redirect', async () => {
    render(<OnboardingPage />)
    await goToStep2()
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
    await screen.findByRole('heading', { name: /Periksa kembali/ })

    expect(localStorage.getItem(WIZARD_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan Setup' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Setup selesai/)
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'), { timeout: 2000 })

    const businessPost = posts.find((p) => p.path === '/api/businesses')
    expect(businessPost).toBeDefined()
    expect(businessPost).toMatchObject({
      nama_bisnis: 'Warung Kopi Nusantara',
      jenis_usaha: 'fnb',
      alamat: 'Jl. Melati No. 12, Jakarta Selatan',
      owner: { nama: 'Pak Darmawan', email: 'darmawan@usaha.id', password: 'rahasia123' },
    })

    // Sesi baru disimpan agar bisa masuk kembali.
    expect(localStorage.getItem('kk-token')).toBe('jwt-token')
    const storedUser = JSON.parse(localStorage.getItem('kk-user') ?? 'null') as { business_id: string }
    expect(storedUser.business_id).toBe('b-1')

    // Komponen aktif dipilih → dibuat lalu ditandai default lewat PUT.
    const salaryPosts = posts.filter((p) => p.path === '/api/salary-components')
    expect(salaryPosts.length).toBeGreaterThan(0)
    const defaultPut = puts[0]
    expect(defaultPut?.component_ids).toHaveLength(salaryPosts.length)

    expect(localStorage.getItem(WIZARD_STORAGE_KEY)).toBeNull()
  })

  it('POST bisnis gagal (email terpakai) → error surface, draft tetap, tanpa redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method ?? 'GET'
        const u = new URL(url, 'http://localhost')
        if (u.pathname === '/api/salary-components' && method === 'GET') return json({ components: [] })
        if (u.pathname === '/api/businesses' && method === 'POST') {
          return json({ error: { message: 'Email sudah terdaftar' } }, 409)
        }
        return json({})
      }),
    )
    render(<OnboardingPage />)
    await goToStep2()
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }))
    await screen.findByRole('heading', { name: /Periksa kembali/ })

    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan Setup' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Email sudah terdaftar/)
    })
    expect(screen.getByText('Gagal membuat workspace')).toBeInTheDocument()
    expect(localStorage.getItem(WIZARD_STORAGE_KEY)).not.toBeNull()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
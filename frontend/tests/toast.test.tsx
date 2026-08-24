import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/toast'
import { api } from '@/lib/api-client'

function Trigger() {
  return (
    <button
      type="button"
      onClick={() => {
        api.post('/api/boom').catch(() => {
          // toast handles the error display
        })
      }}
    >
      boom
    </button>
  )
}

function renderTrigger() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('menampilkan pesan error Bahasa saat request 500 dan auto-dismiss 4 detik', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Internal' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    renderTrigger()
    fireEvent.click(screen.getByRole('button', { name: 'boom' }))

    // The fetch rejection + error-bus notification resolve via microtasks; flush
    // them under act so the toast renders (waitFor can't poll on fake timers).
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Gagal memuat data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tutup notifikasi' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Gagal memuat data')).not.toBeInTheDocument()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('menampilkan "Tidak terhubung ke server" saat network error (status 0)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    renderTrigger()
    fireEvent.click(screen.getByRole('button', { name: 'boom' }))

    await waitFor(() =>
      expect(screen.getByText('Tidak terhubung ke server')).toBeInTheDocument(),
    )
    vi.unstubAllGlobals()
  })

  it('tidak render toast saat tidak ada error', () => {
    renderTrigger()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

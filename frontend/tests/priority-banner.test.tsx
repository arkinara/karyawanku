import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertTriangle } from 'lucide-react'
import { PriorityBanner } from '@/components/ui/priority-banner'

describe('PriorityBanner', () => {
  it('merender title, description, dan action button', () => {
    render(
      <PriorityBanner
        variant="warning"
        title="2 pengajuan cuti menunggu keputusan Anda"
        description="Paling lama menunggu 2 hari."
        icon={AlertTriangle}
        action={{ label: 'Tinjau' }}
      />,
    )
    expect(screen.getByText('2 pengajuan cuti menunggu keputusan Anda')).toBeInTheDocument()
    expect(screen.getByText('Paling lama menunggu 2 hari.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tinjau' })).toBeInTheDocument()
  })

  it('menerapkan class variant warning', () => {
    const { container } = render(
      <PriorityBanner variant="warning" title="Perlu keputusan" />,
    )
    expect(container.querySelector('[role="status"]')).toHaveClass('bg-warning-container')
    expect(container.querySelector('[role="status"]')).toHaveClass('border-l-warning')
  })

  it('ganti variant ke danger mengganti token container', () => {
    const { container } = render(<PriorityBanner variant="danger" title="Gawat" />)
    const banner = container.querySelector('[role="status"]')!
    expect(banner).toHaveClass('bg-danger-container')
    expect(banner).toHaveClass('border-l-danger')
    expect(banner).not.toHaveClass('bg-warning-container')
  })

  it('menggunakan href bila action berisi href', () => {
    render(
      <PriorityBanner
        title="Ada tindakan"
        action={{ label: 'Buka', href: '/cuti' }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Buka' })).toHaveAttribute('href', '/cuti')
  })
})

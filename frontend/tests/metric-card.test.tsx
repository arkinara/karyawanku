import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { MetricGrid } from '@/components/dashboard/metric-grid'

describe('MetricCard', () => {
  it('merender value, label, dan icon', () => {
    render(
      <MetricCard label="Total Karyawan" value={12} icon={Users} />,
    )
    expect(screen.getByText('Total Karyawan')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('menerapkan tabular-nums pada value', () => {
    const { container } = render(<MetricCard label="Gaji" value={1200000} />)
    const value = container.querySelector('p[class*="tabular-nums"]')!
    expect(value).not.toBeNull()
    expect(value.textContent).toContain('1200000')
  })

  it('delta up berwarna success (hijau)', () => {
    const { container } = render(
      <MetricCard label="Hadir" value={10} delta={{ value: '+12%', trend: 'up' }} />,
    )
    expect(screen.getByText('+12%')).toHaveClass('text-success')
  })

  it('delta flat memakai warna netral', () => {
    const { container } = render(
      <MetricCard label="Cuti" value={2} delta={{ value: '0', trend: 'flat' }} />,
    )
    expect(screen.getByText('0')).toHaveClass('text-onsurface-variant')
  })

  it('unit dirender setelah value', () => {
    render(<MetricCard label="Hadir" value={10} unit="/12" />)
    expect(screen.getByText('/12')).toBeInTheDocument()
  })
})

describe('MetricGrid', () => {
  it('merender anak dalam grid 4-up di desktop', () => {
    const { container } = render(
      <MetricGrid>
        <MetricCard label="A" value={1} />
        <MetricCard label="B" value={2} />
        <MetricCard label="C" value={3} />
        <MetricCard label="D" value={4} />
      </MetricGrid>,
    )
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveClass('xl:grid-cols-4')
    expect(screen.getAllByText(/A|B|C|D/)).toHaveLength(4)
  })
})

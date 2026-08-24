import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from '@/components/ui/segmented-control'

const options = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: '7 hari', count: 5 },
  { value: 'month', label: '30 hari' },
]

describe('SegmentedControl', () => {
  it('menandai option aktif dengan aria-selected + bg primary', () => {
    const onChange = () => {}
    const { container } = render(
      <SegmentedControl options={options} value="today" onChange={onChange} />,
    )
    const today = screen.getByRole('tab', { name: /Hari ini/i })
    expect(today).toHaveAttribute('aria-selected', 'true')
    expect(today).toHaveClass('bg-primary', 'text-primary-on')
    const week = screen.getByRole('tab', { name: /7 hari/i })
    expect(week).toHaveAttribute('aria-selected', 'false')
  })

  it('klik option memindahkan selection dan panggil onChange', () => {
    const onChange = (v: string) => {
      value = v
    }
    let value = 'today'
    const { rerender } = render(
      <SegmentedControl options={options} value={value} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /7 hari/i }))
    expect(value).toBe('week')
    rerender(<SegmentedControl options={options} value={value} onChange={onChange} />)
    const week = screen.getByRole('tab', { name: /7 hari/i })
    expect(week).toHaveAttribute('aria-selected', 'true')
  })

  it('merender count sebagai chip setelah label', () => {
    render(<SegmentedControl options={options} value="today" onChange={() => {}} />)
    const week = screen.getByRole('tab', { name: /7 hari/i })
    expect(week.textContent).toContain('5')
  })

  it('navigasi arrow key memindahkan focus + selection', () => {
    let value = 'today'
    const onChange = (v: string) => {
      value = v
    }
    const { container } = render(
      <SegmentedControl options={options} value={value} onChange={onChange} />,
    )
    const list = container.querySelector('[role="tablist"]')!
    screen.getByRole('tab', { name: /Hari ini/i }).focus()
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(value).toBe('week')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(value).toBe('month')
  })

  it('satu option saja tidak crash dan tetap aktif', () => {
    const { container } = render(
      <SegmentedControl
        options={[{ value: 'only', label: 'Satu' }]}
        value="only"
        onChange={() => {}}
      />,
    )
    const only = screen.getByRole('tab', { name: 'Satu' })
    expect(only).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1)
  })
})

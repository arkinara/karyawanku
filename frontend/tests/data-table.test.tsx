import { describe, expect, it } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { DataTable } from '@/components/ui/data-table'
import type { DataTableColumn } from '@/components/ui/data-table'

interface Row {
  id: string
  nama: string
  gaji: number
}

const columns: Array<DataTableColumn<Row>> = [
  { key: 'nama', label: 'Nama' },
  { key: 'gaji', label: 'Gaji', numeric: true, sortable: true },
]

const rows: Row[] = [
  { id: '1', nama: 'Budi', gaji: 5000 },
  { id: '2', nama: 'Ani', gaji: 3000 },
]

function renderTable(overrides?: { empty?: boolean }) {
  return render(
    <DataTable
      columns={columns}
      rows={overrides?.empty ? [] : rows}
      rowKey={(r) => r.id}
      footer={
        <tr>
          <td>Total</td>
          <td>8000</td>
        </tr>
      }
    />,
  )
}

describe('DataTable', () => {
  it('merender baris data dan header', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: /Nama/i })).toBeInTheDocument()
    expect(screen.getByText('Budi')).toBeInTheDocument()
    expect(screen.getByText('Ani')).toBeInTheDocument()
  })

  it('kolom numerik memakai tabular-nums + rata kanan', () => {
    const { container } = renderTable()
    const cell = within(container).getByText('5000')
    expect(cell).toHaveClass('tabular-nums', 'text-right')
  })

  it('render footer totals row', () => {
    const { container } = renderTable()
    const foot = container.querySelector('tfoot')!
    expect(foot.textContent).toContain('Total')
    expect(foot.textContent).toContain('8000')
  })

  it('menampilkan empty state saat tidak ada baris', () => {
    renderTable({ empty: true })
    expect(screen.getByText('Tidak ada data')).toBeInTheDocument()
  })

  it('mengurutkan naik/turun saat header diklik', () => {
    const { container } = renderTable()
    const header = screen.getByRole('columnheader', { name: /Gaji/i })
    const before = Array.from(container.querySelectorAll('tbody td:last-child')).map(
      (td) => td.textContent,
    )
    expect(before).toEqual(['5000', '3000'])

    const sortBtn = within(header).getByRole('button')
    fireEvent.click(sortBtn)
    const asc = Array.from(container.querySelectorAll('tbody td:last-child')).map(
      (td) => td.textContent,
    )
    expect(asc).toEqual(['3000', '5000'])

    fireEvent.click(sortBtn)
    const desc = Array.from(container.querySelectorAll('tbody td:last-child')).map(
      (td) => td.textContent,
    )
    expect(desc).toEqual(['5000', '3000'])
  })
})

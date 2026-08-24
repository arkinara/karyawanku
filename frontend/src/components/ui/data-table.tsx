'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ColumnAlign = 'left' | 'right' | 'center'

export interface DataTableColumn<T> {
  key: string
  /** Bahasa Indonesia header label. */
  label: string
  align?: ColumnAlign
  sortable?: boolean
  /** Numeric: right-aligned + tabular-nums. */
  numeric?: boolean
  /** Custom cell renderer. Falls back to the raw row value. */
  render?: (row: T) => ReactNode
  /** Width utility class, e.g. 'w-32'. */
  width?: string
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
  rowKey: (row: T) => string
  caption?: string
  /** Shown when `rows` is empty. Defaults to a "Tidak ada data" empty state. */
  emptyState?: ReactNode
  /** Totals row, e.g. a `<tr>` with `<td>` cells. */
  footer?: ReactNode
  className?: string
}

const alignClass: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

function SortArrow({ direction }: { direction: 'asc' | 'desc' | 'none' }) {
  if (direction === 'asc') return <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
  if (direction === 'desc') return <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
  return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyState,
  footer,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    const valueOf = (row: T): unknown => {
      const r = row as Record<string, unknown>
      return r[sort.key]
    }
    const next = [...rows]
    next.sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av
      }
      const sa = String(av ?? '')
      const sb = String(bv ?? '')
      const cmp = sa.localeCompare(sb, 'id', { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
    // Custom render() has no comparable key; skip (col is just for presence check).
    void col
    return next
  }, [rows, sort, columns])

  const onToggle = (key: string) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-outline-variant bg-surface shadow-e1', className)}>
      {caption && (
        <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-onsurface-variant">
          {caption}
        </p>
      )}

      {rows.length === 0 ? (
        emptyState ?? (
          <div className="px-6 py-12 text-center text-sm text-onsurface-variant">
            Tidak ada data
          </div>
        )
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key
                const dir = active ? sort!.dir : 'none'
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'sticky top-0 z-10 whitespace-nowrap border-b border-outline-variant bg-surface-1 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-onsurface-variant',
                      alignClass[col.align ?? (col.numeric ? 'right' : 'left')],
                      col.width,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onToggle(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 focus-visible:outline-none',
                          active && 'text-primary',
                        )}
                      >
                        {col.label}
                        <SortArrow direction={dir} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className="transition-colors duration-fast ease-standard hover:bg-surface-1"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'border-b border-outline-variant px-4 py-3 align-middle',
                      col.numeric && 'tabular-nums',
                      alignClass[col.align ?? (col.numeric ? 'right' : 'left')],
                      col.width,
                    )}
                  >
                    {col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      )}
    </div>
  )
}

DataTable.displayName = 'DataTable'

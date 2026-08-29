import { z } from 'zod'

/**
 * Kontrak pagination bersama untuk semua list endpoint (ticket #58).
 * Page-based: `page` (1-indexed) + `limit`. Default limit 20, hard max 100.
 * Nilai invalid (negatif, nol, non-numerik) di-fallback ke default.
 */

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
})

export function parsePagination(query: Record<string, unknown> | undefined): PaginationParams {
  const parsed = paginationSchema.safeParse(query ?? {})
  if (!parsed.success) return { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT }
  const page = parsed.data.page ?? DEFAULT_PAGE
  const limit = Math.min(parsed.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  return { page, limit }
}

export function offsetOf({ page, limit }: PaginationParams): number {
  return (page - 1) * limit
}

export function paginateResult<T>(items: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  const { page, limit } = params
  return {
    items,
    total,
    page,
    limit,
    has_more: page * limit < total,
  }
}
/**
 * KaryawanKu — minimal client-side CSV parser (ticket #7).
 *
 * RFC 4180-lite: double-quoted fields may contain commas, escaped quotes
 * (`""`), and newlines. Deliberately dependency-free and tiny; it only needs
 * to handle the import template + realistic exports.
 */

export interface ParsedCsv {
  /** First record, trimmed, treated as the header row. */
  headers: string[]
  /** Remaining records; each row has the same length as `headers` (padded). */
  rows: string[][]
}

/** `File.text()` is missing in jsdom — FileReader works everywhere. */
export function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file'))
    reader.readAsText(file)
  })
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }

  const pushRow = () => {
    pushField()
    records.push(row)
    row = []
  }

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }

    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      pushField()
      i += 1
      continue
    }
    if (c === '\n') {
      pushRow()
      i += 1
      continue
    }
    if (c === '\r') {
      // CRLF — swallow the CR, let the LF close the record.
      i += 1
      continue
    }
    field += c
    i += 1
  }

  if (field !== '' || row.length > 0) pushRow()

  // Drop trailing blank records (stray newlines at EOF).
  while (records.length > 0 && records[records.length - 1].every((cell) => cell.trim() === '')) {
    records.pop()
  }

  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0].map((h) => h.trim())
  const rows = records
    .slice(1)
    .map((r) => Array.from({ length: headers.length }, (_, ci) => r[ci] ?? ''))
  return { headers, rows }
}
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Download, FileUp, XCircle } from 'lucide-react'
import { AppShell, Button, DataTable, StatusChip, Stepper } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { parseCsv, readFileAsText } from '@/lib/csv'
import {
  autoMapping,
  buildTemplateCsv,
  EMPLOYEE_FIELDS,
  FIELD_LABELS,
  mapRows,
  MAX_FILE_SIZE,
  REQUIRED_FIELDS,
  suggestField,
  TEMPLATE_FILENAME,
} from '@/lib/csv-import'
import type { EmployeeField, MappedRow, Mapping } from '@/lib/csv-import'
import { cn } from '@/lib/cn'

/**
 * /employees/import — import karyawan via CSV (ticket #7).
 *
 * 3-step wizard: (1) upload a .csv (max 5 MB) with a template download,
 * (2) map CSV columns to employee fields (auto-suggested, manually editable),
 * (3) preview every parsed row with per-row validation chips, then mock-commit
 * only the valid rows. FE-only — no API call.
 */

const STEPS = [
  { key: 'upload', name: 'Upload' },
  { key: 'mapping', name: 'Pemetaan Kolom' },
  { key: 'preview', name: 'Preview & Import' },
]

const selectClass =
  'h-11 w-full rounded-xl border border-outline-variant bg-surface-1 px-4 text-sm text-onsurface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export default function ImportEmployeesPage() {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ReturnType<typeof parseCsv> | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [skipErrors, setSkipErrors] = useState(true)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  const rows = useMemo(
    () => (parsed && mapping ? mapRows(parsed, mapping) : []),
    [parsed, mapping],
  )

  const validCount = rows.filter((r) => r.valid).length
  const errorCount = rows.length - validCount
  const importCount = skipErrors ? validCount : rows.length

  const missingRequired = useMemo(() => {
    const mapped = new Set(Object.values(mapping ?? {}) as string[])
    return REQUIRED_FIELDS.filter((f) => !mapped.has(f))
  }, [mapping])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragActive(false)
    void handleFiles(e.dataTransfer.files)
  }

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setFileError(null)

    if (!/\.csv$/i.test(file.name)) {
      setFileError('Format file tidak didukung. Gunakan file .csv.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('Ukuran file melebihi batas maksimal 5 MB.')
      return
    }

    const text = await readFileAsText(file)
    const result = parseCsv(text)
    if (result.headers.length === 0) {
      setFileError('File CSV kosong atau tidak memiliki header.')
      return
    }

    setFileName(file.name)
    setParsed(result)
    setMapping(autoMapping(result.headers))
    setStep(1)
  }

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = TEMPLATE_FILENAME
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (validCount === 0 || importing) return
    setImporting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setImporting(false)
    setToast(`${importCount} karyawan berhasil diimport.`)
    redirectTimer.current = setTimeout(() => router.push('/employees'), 800)
  }

  const columns: Array<DataTableColumn<MappedRow>> = [
    {
      key: 'rowNumber',
      label: 'No.',
      numeric: true,
      render: (r) => <span className="text-onsurface-variant">{r.rowNumber}</span>,
    },
    {
      key: 'nama',
      label: 'Nama',
      render: (r) => (
        <span className="font-medium text-onsurface">{r.values.nama_lengkap || '-'}</span>
      ),
    },
    {
      key: 'no_ktp',
      label: 'No. KTP',
      numeric: true,
      render: (r) => <span className="text-onsurface-variant">{r.values.no_ktp || '-'}</span>,
    },
    {
      key: 'jenis_kontrak',
      label: 'Jenis Kontrak',
      render: (r) => (
        <span className="text-onsurface-variant">{r.values.jenis_kontrak || '-'}</span>
      ),
    },
    {
      key: 'tanggal_masuk',
      label: 'Tanggal Masuk',
      render: (r) => (
        <span className="text-onsurface-variant">{r.values.tanggal_masuk || '-'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) =>
        r.valid ? (
          <StatusChip variant="success" icon={CheckCircle2} label="Valid" />
        ) : (
          <span title={r.errors.join('\n')}>
            <StatusChip
              variant="danger"
              icon={XCircle}
              label={r.errors[0] + (r.errors.length > 1 ? ` +${r.errors.length - 1}` : '')}
            />
          </span>
        ),
    },
  ]

  return (
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Import Karyawan"
      subtitle="Upload file CSV"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Stepper steps={STEPS} currentStep={step} />

        {step === 0 && (
          <section aria-label="Upload file CSV" className="space-y-4">
            <div>
              <h1 className="t-h1">Upload File CSV</h1>
              <p className="t-caption mt-1">
                Unggah file CSV berisi data karyawan. Maksimal 5 MB, hanya format .csv.
              </p>
            </div>

            <label
              htmlFor="csv-file-input"
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-surface-1 px-6 py-14 text-center transition-colors duration-fast',
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-outline hover:border-primary hover:bg-primary/5',
              )}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFileChange}
              />
              <span className="grid size-14 place-items-center rounded-full bg-primary-container text-primary-oncontainer">
                <FileUp className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="text-body font-medium text-onsurface">
                Tarik file CSV di sini atau klik untuk pilih
              </span>
              <span className="t-caption text-onsurface-variant">
                Format: .csv · Maksimal 5 MB
              </span>
            </label>

            {fileError && (
              <p role="alert" className="text-sm text-danger">
                {fileError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Unduh template CSV
              </button>

              <Button variant="text" onClick={() => router.push('/employees')}>
                Batal
              </Button>
            </div>
          </section>
        )}

        {step === 1 && parsed && mapping && (
          <section aria-label="Pemetaan kolom" className="space-y-4">
            <div>
              <h1 className="t-h1">Pemetaan Kolom</h1>
              <p className="t-caption mt-1 tabular-nums">
                {fileName} · {parsed.headers.length} kolom terdeteksi, {parsed.rows.length} baris
                data. Cocokkan kolom CSV ke field karyawan.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-e1">
              <div className="grid gap-px bg-outline-variant sm:grid-cols-2">
                <div className="bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-onsurface-variant">
                  Kolom CSV
                </div>
                <div className="hidden bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-onsurface-variant sm:block">
                  Field Karyawan
                </div>
              </div>
              {parsed.headers.map((header, i) => {
                const suggested = suggestField(header)
                return (
                  <div
                    key={i}
                    className="grid gap-2 border-b border-outline-variant px-4 py-3 last:border-b-0 sm:grid-cols-2 sm:items-center"
                  >
                    <div>
                      <p className="font-medium text-onsurface">{header}</p>
                      {suggested !== 'ignore' && (
                        <p className="text-xs text-success">Tersarankan: {FIELD_LABELS[suggested]}</p>
                      )}
                    </div>
                    <select
                      value={mapping[i]}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m!, [i]: e.target.value as EmployeeField | 'ignore' }))
                      }
                      aria-label={`Kolom ${header}`}
                      className={selectClass}
                    >
                      <option value="ignore">Abaikan</option>
                      {EMPLOYEE_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>

            {missingRequired.length > 0 && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-accent-container bg-accent-container p-4 text-sm text-accent-oncontainer"
              >
                <span aria-hidden="true">⚠</span>
                <p>
                  Kolom wajib belum dipetakan:{' '}
                  <span className="font-medium">
                    {missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}
                  </span>
                  . Pilih field untuk kolom tersebut agar bisa lanjut ke preview.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="text" onClick={() => setStep(0)} disabled={importing}>
                Kembali
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={missingRequired.length > 0}
              >
                Lanjut ke Preview
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Preview dan import" className="space-y-4">
            <div>
              <h1 className="t-h1">Preview & Import</h1>
              <p className="t-caption mt-1">
                Periksa hasil validasi setiap baris sebelum diimport. Baris error tidak
                akan di-commit.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-1 px-4 py-3">
              <p role="status" className="text-sm text-onsurface">
                <span className="font-semibold text-success tabular-nums">{validCount} baris valid</span>
                <span className="text-onsurface-variant">
                  , {errorCount} baris error{skipErrors && errorCount > 0 ? ' (akan dilewati)' : ''}
                </span>
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-onsurface">
                <input
                  type="checkbox"
                  checked={skipErrors}
                  onChange={(e) => setSkipErrors(e.target.checked)}
                  className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
                />
                Lewati baris error
              </label>
            </div>

            {validCount === 0 && (
              <div
                role="alert"
                className="rounded-xl border border-danger-container bg-danger-container px-4 py-3 text-sm text-danger-on"
              >
                Tidak ada data yang bisa diimport. Perbaiki file CSV dan ulangi.
              </div>
            )}

            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => String(r.rowNumber)}
              caption="Hasil validasi"
            />

            <div className="flex items-center justify-between gap-2">
              <Button variant="text" onClick={() => setStep(1)} disabled={importing}>
                Kembali
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                aria-busy={importing}
              >
                {importing
                  ? 'Mengimport...'
                  : `Import ${importCount} Karyawan`}
              </Button>
            </div>
          </section>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full bg-success px-5 py-3 text-sm font-medium text-success-on shadow-e4"
        >
          {toast}
        </div>
      )}
    </AppShell>
  )
}
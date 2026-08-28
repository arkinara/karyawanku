'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calculator, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AppShell,
  Button,
  DataTable,
  Dialog,
  ErrorSurface,
  LoadingSurface,
  SegmentedControl,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { cn } from '@/lib/cn'
import { apiRequest } from '@/lib/api-client'
import { AuthGuard, OWNER_ONLY } from '@/lib/route-guard'
import { formatIDR } from '@/lib/format'

type ComponentType = 'earning' | 'deduction'
type ComponentStatus = 'aktif' | 'nonaktif'
type ValueMode = 'fixed' | 'formula'

interface SalaryComponent {
  id: string
  business_id?: string
  nama_komponen: string
  tipe: ComponentType
  mode: ValueMode
  /** Fixed nominal in IDR, or the base rate for formula components. */
  nominal: number | null
  formula: string | null
  aktif: boolean
}

/** Sample values the formula preview calculator evaluates against (mock). */
const SAMPLE_VARIABLES: Array<{ key: string; label: string; value: number }> = [
  { key: 'gaji_pokok', label: 'Gaji Pokok', value: 3500000 },
  { key: 'tarif_lembur', label: 'Tarif Lembur', value: 25000 },
  { key: 'jam_kerja', label: 'Jam Kerja', value: 8 },
  { key: 'ptkp', label: 'PTKP Tahunan', value: 54000000 },
]

const SAMPLE_VAR_MAP = Object.fromEntries(SAMPLE_VARIABLES.map((v) => [v.key, v.value]))

type FormulaOp = '+' | '-' | '*' | '/' | '%'

type FormulaToken =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: FormulaOp }
  | { type: 'paren'; value: '(' | ')' }

function tokenizeFormula(src: string): { tokens: FormulaToken[] | null; error?: string } {
  const tokens: FormulaToken[] = []
  let index = 0
  while (index < src.length) {
    const ch = src[index]
    if (/\s/.test(ch)) {
      index += 1
      continue
    }
    const rest = src.slice(index)
    const num = /^\d+(?:\.\d+)?/.exec(rest)
    if (num) {
      tokens.push({ type: 'number', value: parseFloat(num[0]) })
      index += num[0].length
      continue
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest)
    if (ident) {
      tokens.push({ type: 'ident', value: ident[0] })
      index += ident[0].length
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      index += 1
      continue
    }
    if ('+-*/%'.includes(ch)) {
      tokens.push({ type: 'op', value: ch as FormulaOp })
      index += 1
      continue
    }
    return { tokens: null, error: `Karakter tidak dikenal: "${ch}"` }
  }
  return { tokens }
}

class FormulaParser {
  private pos = 0

  constructor(
    private readonly tokens: FormulaToken[],
    private readonly vars: Record<string, number>,
  ) {}

  private peek(): FormulaToken | undefined {
    return this.tokens[this.pos]
  }

  private next(): FormulaToken | undefined {
    return this.tokens[this.pos++]
  }

  parse(): number {
    const value = this.expr()
    if (this.pos !== this.tokens.length) throw new Error('Formula tidak valid')
    return value
  }

  private expr(): number {
    let value = this.term()
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = (this.next() as { type: 'op'; value: '+' | '-' }).value
      const rhs = this.term()
      value = op === '+' ? value + rhs : value - rhs
    }
    return value
  }

  private term(): number {
    let value = this.factor()
    for (;;) {
      const op = this.peek()
      if (op?.type !== 'op' || (op.value !== '*' && op.value !== '/' && op.value !== '%')) break
      this.next()
      const rhs = this.factor()
      if (op.value === '*') value *= rhs
      else if (op.value === '/') {
        if (rhs === 0) throw new Error('Pembagian dengan nol')
        value /= rhs
      } else {
        if (rhs === 0) throw new Error('Pembagian dengan nol')
        value %= rhs
      }
    }
    return value
  }

  private factor(): number {
    const token = this.next()
    if (!token) throw new Error('Formula tidak lengkap')
    if (token.type === 'number') return token.value
    if (token.type === 'ident') {
      const value = this.vars[token.value]
      if (typeof value !== 'number') throw new Error(`Variabel tidak dikenal: ${token.value}`)
      return value
    }
    if (token.type === 'op' && token.value === '-') return -this.factor()
    if (token.type === 'paren' && token.value === '(') {
      const inner = this.expr()
      const close = this.next()
      if (!close || close.type !== 'paren' || close.value !== ')') {
        throw new Error('Tanda kurung tidak seimbang')
      }
      return inner
    }
    throw new Error('Formula tidak valid')
  }
}

function evaluateFormula(
  src: string,
  vars: Record<string, number>,
): { ok: true; value: number } | { ok: false; error: string } {
  const { tokens, error } = tokenizeFormula(src)
  if (error) return { ok: false, error }
  if (!tokens || tokens.length === 0) return { ok: false, error: 'Formula wajib diisi' }
  const unknown = Array.from(
    new Set(
      tokens
        .filter((t): t is Extract<FormulaToken, { type: 'ident' }> => t.type === 'ident')
        .filter((t) => !(t.value in vars))
        .map((t) => t.value),
    ),
  )
  if (unknown.length > 0) {
    return { ok: false, error: `Referensi variabel tidak dikenal: ${unknown.join(', ')}` }
  }
  try {
    return { ok: true, value: new FormulaParser(tokens, vars).parse() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Formula tidak valid' }
  }
}

/** Accepts thousands-separated input ("3.500.000") and comma decimals. */
function parseNominalInput(s: string): number | null {
  const cleaned = s.replace(/\./g, '').replace(',', '.')
  if (cleaned.trim() === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function StatusToggle({
  value,
  onChange,
}: {
  value: ComponentStatus
  onChange: (s: ComponentStatus) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Status komponen"
      className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface p-1"
    >
      {(['aktif', 'nonaktif'] as const).map((s) => {
        const active = value === s
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s)}
            className={cn(
              'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active ? 'bg-primary text-primary-on' : 'text-onsurface-variant hover:bg-surface-2',
            )}
          >
            {s === 'aktif' ? 'Aktif' : 'Nonaktif'}
          </button>
        )
      })}
    </div>
  )
}

interface SalaryComponentDialogProps {
  open: boolean
  initial: SalaryComponent | null
  existingNames: string[]
  onClose: () => void
  onSave: (component: SalaryComponent) => void
}

function SalaryComponentDialog({
  open,
  initial,
  existingNames,
  onClose,
  onSave,
}: SalaryComponentDialogProps) {
  const [nama, setNama] = useState('')
  const [tipe, setTipe] = useState<'' | ComponentType>('')
  const [mode, setMode] = useState<ValueMode>('fixed')
  const [nominal, setNominal] = useState('')
  const [formula, setFormula] = useState('')
  const [status, setStatus] = useState<ComponentStatus>('aktif')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ ok: boolean; value?: number; error?: string } | null>(null)
  const [previewRun, setPreviewRun] = useState(false)

  useEffect(() => {
    if (!open) return
    setNama(initial?.nama_komponen ?? '')
    setTipe(initial?.tipe ?? '')
    setMode(initial?.mode ?? 'fixed')
    setNominal(initial && initial.mode === 'fixed' ? String(initial.nominal ?? '') : '')
    setFormula(initial?.formula ?? '')
    setStatus(initial?.aktif === false ? 'nonaktif' : 'aktif')
    setErrors({})
    setPreview(null)
    setPreviewRun(false)
  }, [open, initial])

  const parsedNominal = parseNominalInput(nominal)

  const validate = () => {
    const errs: Record<string, string> = {}
    const trimmedNama = nama.trim()
    if (!trimmedNama) {
      errs.nama = 'Nama komponen wajib diisi'
    } else {
      const nameTaken = existingNames.some((n) => n.toLowerCase() === trimmedNama.toLowerCase())
      const selfName = initial?.nama_komponen.toLowerCase() === trimmedNama.toLowerCase()
      if (nameTaken && !selfName) errs.nama = 'Komponen dengan nama tersebut sudah ada'
    }
    if (!tipe) errs.tipe = 'Tipe komponen wajib dipilih'

    if (mode === 'fixed') {
      if (!nominal.trim()) errs.nominal = 'Nominal wajib diisi'
      else if (parsedNominal === null) errs.nominal = 'Nominal harus angka minimal 0'
    } else {
      if (!formula.trim()) {
        errs.formula = 'Formula wajib diisi'
      } else {
        const result = evaluateFormula(formula.trim(), SAMPLE_VAR_MAP)
        if (!result.ok) errs.formula = result.error
        else if (!previewRun) errs.formula = 'Jalankan preview formula terlebih dahulu'
      }
    }
    return errs
  }

  const handlePreview = () => {
    const src = formula.trim()
    if (!src) {
      setPreview({ ok: false, error: 'Formula wajib diisi' })
      setPreviewRun(false)
      return
    }
    const result = evaluateFormula(src, SAMPLE_VAR_MAP)
    setPreview(result)
    setPreviewRun(result.ok)
  }

  const handleSubmit = () => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSave({
      id: initial?.id ?? `sc-${Date.now()}`,
      nama_komponen: nama.trim(),
      tipe: tipe as ComponentType,
      mode,
      nominal: mode === 'fixed' ? parsedNominal : initial?.nominal ?? null,
      formula: mode === 'formula' ? formula.trim() : null,
      aktif: status === 'aktif',
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Komponen' : 'Tambah Komponen'}
      description={
        initial
          ? 'Perbarui detail komponen gaji.'
          : 'Tambahkan komponen pendapatan atau potongan baru.'
      }
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          id="sc-nama"
          label="Nama Komponen"
          required
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          error={errors.nama}
          placeholder="Contoh: Tunjangan Makan"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="sc-tipe" className="t-label text-onsurface">
            Tipe
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="sc-tipe"
            value={tipe}
            onChange={(e) => setTipe(e.target.value as ComponentType)}
            aria-invalid={Boolean(errors.tipe) || undefined}
            aria-describedby={errors.tipe ? 'sc-tipe-message' : undefined}
            className={cn(
              'h-11 w-full rounded-xl border bg-surface-1 px-4 text-sm text-onsurface',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              errors.tipe ? 'border-danger bg-danger/5' : 'border-outline-variant',
            )}
          >
            <option value="">Pilih tipe…</option>
            <option value="earning">Pendapatan</option>
            <option value="deduction">Potongan</option>
          </select>
          {errors.tipe && (
            <p id="sc-tipe-message" className="text-body-sm text-danger">
              {errors.tipe}
            </p>
          )}
        </div>

        <SegmentedControl
          aria-label="Mode nilai"
          options={[
            { value: 'fixed', label: 'Nominal Tetap' },
            { value: 'formula', label: 'Formula' },
          ]}
          value={mode}
          onChange={(value) => {
            setMode(value as ValueMode)
            setPreview(null)
            setPreviewRun(false)
          }}
        />

        {mode === 'fixed' ? (
          <div className="flex flex-col gap-1.5">
            <TextField
              id="sc-nominal"
              label="Nominal"
              required
              type="text"
              inputMode="numeric"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              error={errors.nominal}
              helperText="Gunakan angka, contoh: 3.500.000"
              placeholder="0"
            />
            {parsedNominal !== null && (
              <p className="text-body-sm text-onsurface-variant tabular-nums">
                Pratinjau: {formatIDR(parsedNominal)}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <TextField
              id="sc-formula"
              label="Formula"
              required
              value={formula}
              onChange={(e) => {
                setFormula(e.target.value)
                setPreview(null)
                setPreviewRun(false)
              }}
              error={errors.formula}
              helperText="Contoh: jam_kerja * tarif_lembur"
              placeholder="jam_kerja * tarif_lembur"
            />
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_VARIABLES.map((v) => (
                <span
                  key={v.key}
                  title={v.label}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-onsurface-variant"
                >
                  <code className="font-mono text-onsurface">{v.key}</code>
                  <span className="tabular-nums">{v.value}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handlePreview}>
                <Calculator className="h-4 w-4" aria-hidden="true" />
                Hitung Preview
              </Button>
              {preview && (
                <p
                  className={cn(
                    'text-body-sm font-medium tabular-nums',
                    preview.ok ? 'text-onsurface' : 'text-danger',
                  )}
                >
                  {preview.ok ? `Hasil: ${formatIDR(preview.value ?? 0)}` : preview.error}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="t-label text-onsurface">Status</span>
          <StatusToggle value={status} onChange={setStatus} />
        </div>
      </div>
    </Dialog>
  )
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'earning', label: 'Pendapatan' },
  { value: 'deduction', label: 'Potongan' },
]

export default function SalaryComponentsPage() {
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [filter, setFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryComponent | null>(null)
  const [deleting, setDeleting] = useState<SalaryComponent | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<{ components: SalaryComponent[] }>('/api/salary-components')
      setComponents(res.components)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((o) => ({
        ...o,
        count: o.value === 'all' ? components.length : components.filter((c) => c.tipe === o.value).length,
      })),
    [components],
  )

  const filtered = useMemo(() => {
    if (filter === 'all') return components
    return components.filter((c) => c.tipe === filter)
  }, [components, filter])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (component: SalaryComponent) => {
    setEditing(component)
    setDialogOpen(true)
  }

  const save = async (component: SalaryComponent) => {
    setSaving(true)
    try {
      const body = {
        nama_komponen: component.nama_komponen,
        tipe: component.tipe,
        nominal: component.mode === 'fixed' ? component.nominal : null,
        formula: component.mode === 'formula' ? component.formula : null,
        aktif: component.aktif,
      }
      if (component.id.startsWith('sc-') && component.id.length < 16) {
        await apiRequest('/api/salary-components', { method: 'POST', body })
      } else {
        await apiRequest(`/api/salary-components/${component.id}`, { method: 'PATCH', body })
      }
      setDialogOpen(false)
      setEditing(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await apiRequest(`/api/salary-components/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const columns: Array<DataTableColumn<SalaryComponent>> = [
    {
      key: 'nama',
      label: 'Nama Komponen',
      sortable: true,
      render: (c) => (
        <div>
          <p className="font-medium text-onsurface">{c.nama_komponen}</p>
          {c.mode === 'formula' && (
            <p className="text-xs text-onsurface-variant">Komponen formula</p>
          )}
        </div>
      ),
    },
    {
      key: 'tipe',
      label: 'Tipe',
      render: (c) =>
        c.tipe === 'earning' ? (
          <StatusChip variant="success" label="Pendapatan" />
        ) : (
          <StatusChip variant="danger" label="Potongan" />
        ),
    },
    {
      key: 'nominal',
      label: 'Nominal',
      numeric: true,
      render: (c) => (
        <div className="text-right">
          <p className="tabular-nums text-onsurface">
            {c.nominal !== null ? formatIDR(c.nominal) : '—'}
          </p>
          {c.mode === 'formula' && c.formula && (
            <p className="text-xs text-onsurface-variant">{c.formula}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (c) =>
        c.aktif === true ? (
          <StatusChip variant="success" label="Aktif" />
        ) : (
          <StatusChip variant="neutral" label="Nonaktif" />
        ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="icon" size="sm" aria-label={`Edit ${c.nama_komponen}`} onClick={() => openEdit(c)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            aria-label={`Hapus ${c.nama_komponen}`}
            onClick={() => setDeleting(c)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AuthGuard requiredRoles={OWNER_ONLY}>
      <AppShell
        userRole="owner"
        activeNav="payroll"
        title="Komponen Gaji"
        subtitle="Kelola komponen gaji (pendapatan & potongan) untuk seluruh karyawan"
      >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">Komponen Gaji</h1>
          <p className="t-caption mt-1 tabular-nums">{components.length} komponen terdaftar</p>
        </div>
        <Button onClick={openCreate} disabled={loading}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Komponen
        </Button>
      </div>

      {loading && <div className="mt-4"><LoadingSurface label="Memuat komponen…" /></div>}
      {error && (
        <div className="mt-4">
          <ErrorSurface error={error} onRetry={reload} />
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4 space-y-3">
          <SegmentedControl
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            aria-label="Filter tipe komponen"
          />

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(c) => c.id}
            caption="Daftar komponen gaji"
            emptyState={
              <div className="px-6 py-12 text-center text-sm text-onsurface-variant">
                Tidak ada komponen untuk filter ini.
              </div>
            }
          />
        </div>
      )}

      <SalaryComponentDialog
        open={dialogOpen}
        initial={editing}
        existingNames={components.map((c) => c.nama_komponen)}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSave={save}
      />

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Hapus Komponen"
        description={`Hapus komponen ${deleting?.nama_komponen}? Tindakan ini tidak bisa dibatalkan.`}
        footer={
          <>
            <Button variant="text" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Hapus
            </Button>
          </>
        }
      />
      </AppShell>
    </AuthGuard>
  )
}
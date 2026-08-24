'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { ChevronLeft, Coins, Pencil, Plus, Power } from 'lucide-react'
import {
  AppShell,
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  EmptyState,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatIDR } from '@/lib/format'
import { evaluateFormulaResult } from '@/lib/formula'
import { getEmployeeById } from '@/lib/employees-mock'
import {
  SALARY_COMPONENTS,
  buildAssignmentView,
  getAssignmentsForEmployee,
  getComponentById,
  getEmployeeSalaryInputs,
} from '@/lib/salary-assignments-mock'
import type {
  AssignmentStatus,
  AssignmentView,
  EmployeeSalaryAssignment,
  SalaryComponent,
  SalaryInputs,
} from '@/lib/salary-assignments-mock'

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
  value: AssignmentStatus
  onChange: (s: AssignmentStatus) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Status assignment"
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

interface AssignmentDialogProps {
  open: boolean
  employeeName: string
  employeeInputs: SalaryInputs | undefined
  /** Eligible components (nonaktif component builder entries are excluded). */
  components: SalaryComponent[]
  /** Component ids already assigned (rendered disabled in the picker). */
  assignedComponentIds: string[]
  initial: EmployeeSalaryAssignment | null
  onClose: () => void
  onSave: (data: {
    componentId: string
    overrideNominal: number | null
    status: AssignmentStatus
  }) => void
}

function AssignmentDialog({
  open,
  employeeName,
  employeeInputs,
  components,
  assignedComponentIds,
  initial,
  onClose,
  onSave,
}: AssignmentDialogProps) {
  const [componentId, setComponentId] = useState('')
  const [overrideNominal, setOverrideNominal] = useState('')
  const [gajiPokok, setGajiPokok] = useState('')
  const [jamKerja, setJamKerja] = useState('')
  const [status, setStatus] = useState<AssignmentStatus>('aktif')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    const id = initial?.componentId ?? ''
    setComponentId(id)
    const component = getComponentById(id)
    setOverrideNominal(initial && component ? String(initial.overrideNominal ?? component.nominal ?? '') : '')
    setGajiPokok(employeeInputs ? String(employeeInputs.gajiPokok) : '')
    setJamKerja(employeeInputs ? String(employeeInputs.jamKerja) : '')
    setStatus(initial?.status ?? 'aktif')
    setErrors({})
  }, [open, initial, employeeInputs])

  const selectedComponent = getComponentById(componentId)
  const isFormula = selectedComponent?.mode === 'formula'

  const parsedOverride = parseNominalInput(overrideNominal)
  const parsedGajiPokok = parseNominalInput(gajiPokok)
  const parsedJamKerja = parseNominalInput(jamKerja)

  const formulaPreview = useMemo(() => {
    if (!selectedComponent || selectedComponent.mode !== 'formula') return null
    if (parsedGajiPokok === null || parsedJamKerja === null) {
      return { ok: false as const, error: 'Isi gaji pokok dan jam kerja untuk menghitung preview' }
    }
    const inputs: Record<string, number> = {
      gaji_pokok: parsedGajiPokok,
      jam_kerja: parsedJamKerja,
      tarif_lembur: employeeInputs?.tarifLembur ?? 0,
      jam_lembur: employeeInputs?.jamLembur ?? 0,
    }
    return evaluateFormulaResult(selectedComponent.formula ?? '', inputs)
  }, [selectedComponent, parsedGajiPokok, parsedJamKerja, employeeInputs])

  const handleSelect = (value: string) => {
    setComponentId(value)
    const component = getComponentById(value)
    setOverrideNominal(component && component.mode === 'fixed' ? String(component.nominal ?? '') : '')
    setErrors({})
  }

  const handleSave = () => {
    const errs: Record<string, string> = {}
    if (!componentId) errs.component = 'Komponen wajib dipilih'
    if (!isFormula) {
      if (overrideNominal.trim() !== '' && parsedOverride === null) {
        errs.overrideNominal = 'Override harus angka minimal 0'
      }
    } else {
      if (parsedGajiPokok === null) errs.gajiPokok = 'Gaji pokok wajib diisi angka'
      if (parsedJamKerja === null) errs.jamKerja = 'Jam kerja wajib diisi angka'
      if (formulaPreview && !formulaPreview.ok) errs.formula = formulaPreview.error
      else if (formulaPreview && formulaPreview.ok && formulaPreview.value < 0) {
        errs.formula = 'Hasil kalkulasi bernilai negatif, periksa kembali formula'
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    onSave({
      componentId,
      overrideNominal: isFormula ? initial?.overrideNominal ?? null : parsedOverride,
      status,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Assignment' : 'Tambah Komponen'}
      description={
        initial
          ? `Perbarui komponen gaji ${employeeName}.`
          : `Assign komponen gaji untuk ${employeeName}.`
      }
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="asg-component" className="t-label text-onsurface">
            Komponen
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="asg-component"
            value={componentId}
            disabled={Boolean(initial)}
            onChange={(e) => handleSelect(e.target.value)}
            aria-invalid={Boolean(errors.component) || undefined}
            aria-describedby={errors.component ? 'asg-component-message' : undefined}
            className={cn(
              'h-11 w-full rounded-xl border bg-surface-1 px-4 text-sm text-onsurface',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              errors.component ? 'border-danger bg-danger/5' : 'border-outline-variant',
              initial && 'opacity-50 cursor-not-allowed',
            )}
          >
            <option value="">Pilih komponen…</option>
            {components.map((c) => {
              const assigned = !initial && assignedComponentIds.includes(c.id)
              return (
                <option key={c.id} value={c.id} disabled={assigned}>
                  {c.nama}
                  {assigned ? ' (sudah di-assign)' : ''}
                </option>
              )
            })}
          </select>
          {errors.component && (
            <p id="asg-component-message" className="text-body-sm text-danger">
              {errors.component}
            </p>
          )}
        </div>

        {selectedComponent && !isFormula && (
          <div className="flex flex-col gap-2">
            <TextField
              id="asg-override"
              label="Override Nominal"
              type="text"
              inputMode="numeric"
              value={overrideNominal}
              onChange={(e) => setOverrideNominal(e.target.value)}
              error={errors.overrideNominal}
              helperText={`Kosongkan untuk memakai nominal default: ${formatIDR(selectedComponent.nominal ?? 0)}`}
              placeholder="0"
            />
            {overrideNominal.trim() !== '' && parsedOverride !== null && (
              <p className="text-body-sm text-onsurface-variant tabular-nums">
                Pratinjau: {formatIDR(parsedOverride)}
              </p>
            )}
          </div>
        )}

        {selectedComponent && isFormula && (
          <div className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-1 p-4">
            <p className="t-label text-onsurface">Preview Formula</p>
            <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-onsurface">
              {selectedComponent.formula}
            </code>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                id="asg-gaji-pokok"
                label="Gaji Pokok"
                type="text"
                inputMode="numeric"
                value={gajiPokok}
                onChange={(e) => setGajiPokok(e.target.value)}
                error={errors.gajiPokok}
                placeholder="0"
              />
              <TextField
                id="asg-jam-kerja"
                label="Jam Kerja"
                type="text"
                inputMode="numeric"
                value={jamKerja}
                onChange={(e) => setJamKerja(e.target.value)}
                error={errors.jamKerja}
                placeholder="0"
              />
            </div>
            {formulaPreview && (
              <p
                className={cn(
                  'text-body-sm font-medium tabular-nums',
                  formulaPreview.ok ? 'text-onsurface' : 'text-danger',
                )}
              >
                {formulaPreview.ok
                  ? `→ ${formatIDR(formulaPreview.value)}`
                  : formulaPreview.error}
              </p>
            )}
            {errors.formula && (
              <p className="text-body-sm text-danger">{errors.formula}</p>
            )}
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

export default function EmployeeSalaryPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const employee = getEmployeeById(id)

  const [assignments, setAssignments] = useState<EmployeeSalaryAssignment[]>(() =>
    employee ? getAssignmentsForEmployee(employee.id) : [],
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeSalaryAssignment | null>(null)
  const [deactivating, setDeactivating] = useState<EmployeeSalaryAssignment | null>(null)

  useEffect(() => {
    if (employee) setAssignments(getAssignmentsForEmployee(employee.id))
  }, [employee])

  if (!employee) return notFound()

  const employeeInputs = getEmployeeSalaryInputs(employee.id)
  const activeAssignments = assignments.filter((a) => a.status === 'aktif')
  const views = activeAssignments.map((a) => buildAssignmentView(a, employeeInputs))
  const activeComponentIds = activeAssignments.map((a) => a.componentId)

  const totalGajiPokok =
    views.find((v) => v.component.id === 'sc-1')?.effectiveNominal ?? employeeInputs?.gajiPokok ?? 0
  const totalTunjangan = views
    .filter((v) => v.component.tipe === 'earning' && v.component.id !== 'sc-1')
    .reduce((sum, v) => sum + (v.effectiveNominal ?? 0), 0)
  const totalPotongan = views
    .filter((v) => v.component.tipe === 'deduction')
    .reduce((sum, v) => sum + (v.effectiveNominal ?? 0), 0)
  const takeHome = totalGajiPokok + totalTunjangan - totalPotongan

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (assignment: EmployeeSalaryAssignment) => {
    setEditing(assignment)
    setDialogOpen(true)
  }

  const saveAssignment = (data: {
    componentId: string
    overrideNominal: number | null
    status: AssignmentStatus
  }) => {
    setAssignments((prev) => {
      if (editing) {
        return prev.map((a) =>
          a.id === editing.id
            ? { ...a, overrideNominal: data.overrideNominal, status: data.status }
            : a,
        )
      }
      return [
        ...prev,
        {
          id: `asg-${Date.now()}`,
          employeeId: employee.id,
          componentId: data.componentId,
          overrideNominal: data.overrideNominal,
          status: data.status,
        },
      ]
    })
    setDialogOpen(false)
    setEditing(null)
  }

  const confirmDeactivate = () => {
    if (!deactivating) return
    setAssignments((prev) =>
      prev.map((a) => (a.id === deactivating.id ? { ...a, status: 'nonaktif' } : a)),
    )
    setDeactivating(null)
  }

  const deactivatingName = deactivating ? getComponentById(deactivating.componentId)?.nama : undefined

  const columns: Array<DataTableColumn<AssignmentView>> = [
    {
      key: 'nama',
      label: 'Komponen',
      render: (v) => (
        <div>
          <p className="font-medium text-onsurface">{v.component.nama}</p>
          <StatusChip
            variant={v.component.tipe === 'earning' ? 'success' : 'danger'}
            label={v.component.tipe === 'earning' ? 'Pendapatan' : 'Potongan'}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      key: 'nominal',
      label: 'Nominal Efektif',
      numeric: true,
      render: (v) => (
        <div className="text-right">
          <p className="tabular-nums text-onsurface">
            {v.effectiveNominal !== null ? formatIDR(v.effectiveNominal) : '—'}
          </p>
          {v.component.mode === 'formula' && v.component.formula && (
            <p className="text-xs text-onsurface-variant">{v.component.formula}</p>
          )}
          {v.formulaError && <p className="text-xs text-danger">{v.formulaError}</p>}
        </div>
      ),
    },
    {
      key: 'sumber',
      label: 'Sumber',
      render: (v) =>
        v.source === 'override' ? (
          <StatusChip variant="info" label="Override" />
        ) : (
          <StatusChip variant="neutral" label="Default" />
        ),
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (v) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="icon"
            size="sm"
            aria-label={`Edit ${v.component.nama}`}
            onClick={() => openEdit(v.assignment)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            aria-label={`Nonaktifkan ${v.component.nama}`}
            onClick={() => setDeactivating(v.assignment)}
          >
            <Power className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Komponen Gaji Karyawan"
      subtitle={employee.nama}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="icon"
            size="sm"
            aria-label="Kembali ke profil karyawan"
            onClick={() => router.push(`/employees/${employee.id}`)}
            className="mt-1 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Avatar name={employee.nama} size="sm" className="mt-0.5" />
          <div>
            <h1 className="t-h1">{employee.nama}</h1>
            <p className="t-caption mt-1">Setup gaji untuk {employee.nama}</p>
          </div>
        </div>

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Komponen
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Komponen Aktif</CardTitle>
          <CardDescription>
            {activeAssignments.length} komponen gaji di-assign untuk {employee.nama}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={views}
            rowKey={(v) => v.assignment.id}
            caption="Daftar komponen gaji aktif"
            className="border-0 shadow-none"
            emptyState={
              <EmptyState
                icon={Coins}
                title="Belum ada komponen gaji di-assign"
                description={`Belum ada komponen gaji yang di-assign untuk ${employee.nama}.`}
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Tambah Komponen
                  </Button>
                }
              />
            }
            footer={
              <tr>
                <td colSpan={columns.length} className="border-t border-outline-variant bg-surface-1 px-4 py-3">
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm text-onsurface-variant">
                      Total gaji pokok:{' '}
                      <span className="tabular-nums font-medium text-onsurface">
                        {formatIDR(totalGajiPokok)}
                      </span>
                    </p>
                    <p className="text-sm text-onsurface-variant">
                      Total tunjangan:{' '}
                      <span className="tabular-nums font-medium text-onsurface">
                        {formatIDR(totalTunjangan)}
                      </span>
                    </p>
                    <p className="text-sm text-onsurface-variant">
                      Total potongan:{' '}
                      <span className="tabular-nums font-medium text-onsurface">
                        {formatIDR(totalPotongan)}
                      </span>
                    </p>
                    <p className="t-label text-onsurface">
                      Take-home:{' '}
                      <span className="tabular-nums">{formatIDR(takeHome)}</span>
                    </p>
                  </div>
                </td>
              </tr>
            }
          />
        </CardContent>
      </Card>

      <AssignmentDialog
        open={dialogOpen}
        employeeName={employee.nama}
        employeeInputs={employeeInputs}
        components={SALARY_COMPONENTS.filter((c) => c.status === 'aktif')}
        assignedComponentIds={activeComponentIds}
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSave={saveAssignment}
      />

      <Dialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title="Nonaktifkan Komponen"
        description={`Nonaktifkan ${deactivatingName ?? 'komponen'} untuk ${employee.nama}? Data historis tetap tersimpan.`}
        footer={
          <>
            <Button variant="text" onClick={() => setDeactivating(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDeactivate}>
              Nonaktifkan
            </Button>
          </>
        }
      />
    </AppShell>
  )
}
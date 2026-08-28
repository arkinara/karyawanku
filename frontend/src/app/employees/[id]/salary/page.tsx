'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { ChevronLeft, Pencil, Plus, Power } from 'lucide-react'
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
  ErrorSurface,
  LoadingSurface,
  StatusChip,
  TextField,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { cn } from '@/lib/cn'
import { apiRequest } from '@/lib/api-client'
import { AuthGuard, OWNER_ONLY } from '@/lib/route-guard'
import { formatIDR } from '@/lib/format'

interface Employee {
  id: string
  nama_lengkap: string
}

interface SalaryComponent {
  id: string
  nama_komponen: string
  tipe: 'earning' | 'deduction'
  mode: 'fixed' | 'formula'
  nominal: number | null
  formula: string | null
  aktif: boolean
}

interface Assignment {
  id: string
  employee_id: string
  component_id: string
  override_nominal: number | null
  status: 'aktif' | 'nonaktif'
}

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
  value: 'aktif' | 'nonaktif'
  onChange: (s: 'aktif' | 'nonaktif') => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Status assignment"
      className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface p-1"
    >
      {(['aktif', 'nonaktif'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition',
            value === s
              ? s === 'aktif'
                ? 'bg-success text-success-on'
                : 'bg-surface-3 text-onsurface-variant'
              : 'text-onsurface-variant hover:bg-surface-2',
          )}
        >
          {s === 'aktif' ? 'Aktif' : 'Nonaktif'}
        </button>
      ))}
    </div>
  )
}

interface AssignmentDialogProps {
  open: boolean
  initial: Assignment | null
  components: SalaryComponent[]
  assignedComponentIds: string[]
  employeeName: string
  onClose: () => void
  onSave: (data: { componentId: string; overrideNominal: number | null; status: 'aktif' | 'nonaktif' }) => void
}

function AssignmentDialog({
  open,
  initial,
  components,
  assignedComponentIds,
  employeeName,
  onClose,
  onSave,
}: AssignmentDialogProps) {
  const [componentId, setComponentId] = useState(initial?.component_id ?? '')
  const [overrideNominal, setOverrideNominal] = useState(
    initial?.override_nominal != null ? String(initial.override_nominal) : '',
  )
  const [status, setStatus] = useState<'aktif' | 'nonaktif'>(initial?.status ?? 'aktif')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setComponentId(initial?.component_id ?? '')
    setOverrideNominal(initial?.override_nominal != null ? String(initial.override_nominal) : '')
    setStatus(initial?.status ?? 'aktif')
    setErrors({})
  }, [open, initial])

  const parsedOverride = parseNominalInput(overrideNominal)
  const selectedComponent = components.find((c) => c.id === componentId)
  const isFormula = selectedComponent?.mode === 'formula'

  const handleSelect = (id: string) => {
    setComponentId(id)
    setOverrideNominal('')
  }

  const handleSave = () => {
    const errs: Record<string, string> = {}
    if (!componentId) errs.component = 'Pilih komponen'
    if (!isFormula && overrideNominal.trim() !== '' && parsedOverride === null)
      errs.overrideNominal = 'Nominal harus angka'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSave({
      componentId,
      overrideNominal: overrideNominal.trim() === '' ? null : parsedOverride,
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
                  {c.nama_komponen}
                  {assigned ? ' (sudah di-assign)' : ''}
                </option>
              )
            })}
          </select>
          {errors.component && <p className="text-body-sm text-danger">{errors.component}</p>}
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
            <p className="t-label text-onsurface">Formula (read-only)</p>
            <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-onsurface">
              {selectedComponent.formula}
            </code>
            <p className="t-caption">Override tidak tersedia untuk komponen formula.</p>
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
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [deactivating, setDeactivating] = useState<Assignment | null>(null)

  const reload = async (): Promise<void> => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [empRes, compRes, asgRes] = await Promise.all([
        apiRequest<{ employee: Employee }>(`/api/employees/${id}`),
        apiRequest<{ components: SalaryComponent[] }>('/api/salary-components'),
        apiRequest<{ assignments: Assignment[] }>(`/api/employees/${id}/salary-assignments`),
      ])
      setEmployee(empRes.employee)
      setComponents(compRes.components.filter((c) => c.aktif))
      setAssignments(asgRes.assignments)
    } catch (e) {
      if (e instanceof Error && 'status' in e && (e as { status?: number }).status === 404) {
        notFound()
        return
      }
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const activeAssignments = assignments.filter((a) => a.status === 'aktif')
  const activeComponentIds = activeAssignments.map((a) => a.component_id)

  const componentById = (cid: string) => components.find((c) => c.id === cid)

  type Row = {
    assignment: Assignment
    component: SalaryComponent
    effectiveNominal: number | null
    source: 'default' | 'override'
  }

  const views: Row[] = activeAssignments
    .map((a): Row | null => {
      const component = componentById(a.component_id)
      if (!component) return null
      const effectiveNominal =
        a.override_nominal !== null ? a.override_nominal : component.nominal
      return {
        assignment: a,
        component,
        effectiveNominal,
        source: a.override_nominal !== null ? 'override' : 'default',
      }
    })
    .filter((v): v is Row => v !== null)

  const totalGajiPokok = views
    .filter((v) => v.component.tipe === 'earning' && v.component.nama_komponen.toLowerCase().includes('gaji pokok'))
    .reduce((sum, v) => sum + (v.effectiveNominal ?? 0), 0)
  const totalTunjangan = views
    .filter((v) => v.component.tipe === 'earning' && !v.component.nama_komponen.toLowerCase().includes('gaji pokok'))
    .reduce((sum, v) => sum + (v.effectiveNominal ?? 0), 0)
  const totalPotongan = views
    .filter((v) => v.component.tipe === 'deduction')
    .reduce((sum, v) => sum + (v.effectiveNominal ?? 0), 0)
  const takeHome = totalGajiPokok + totalTunjangan - totalPotongan

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (assignment: Assignment) => {
    setEditing(assignment)
    setDialogOpen(true)
  }

  const save = async (data: {
    componentId: string
    overrideNominal: number | null
    status: 'aktif' | 'nonaktif'
  }) => {
    try {
      if (editing) {
        await apiRequest(`/api/salary-assignments/${editing.id}`, {
          method: 'PATCH',
          body: { override_nominal: data.overrideNominal, status: data.status },
        })
      } else {
        await apiRequest(`/api/employees/${id}/salary-assignments`, {
          method: 'POST',
          body: {
            component_id: data.componentId,
            override_nominal: data.overrideNominal,
            status: data.status,
          },
        })
      }
      setDialogOpen(false)
      setEditing(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const confirmDeactivate = async () => {
    if (!deactivating) return
    try {
      await apiRequest(`/api/salary-assignments/${deactivating.id}`, {
        method: 'PATCH',
        body: { status: 'nonaktif' },
      })
      setDeactivating(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const columns: Array<DataTableColumn<Row>> = [
    {
      key: 'nama',
      label: 'Komponen',
      render: (v) => (
        <div>
          <p className="font-medium text-onsurface">{v.component.nama_komponen}</p>
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
            aria-label={`Edit ${v.component.nama_komponen}`}
            onClick={() => openEdit(v.assignment)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            aria-label={`Nonaktifkan ${v.component.nama_komponen}`}
            onClick={() => setDeactivating(v.assignment)}
          >
            <Power className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <AppShell userRole="owner" activeNav="employees" title="Komponen Gaji Karyawan">
          <LoadingSurface label="Memuat setup gaji…" />
        </AppShell>
      </AuthGuard>
    )
  }

  if (error || !employee) {
    return (
      <AuthGuard requiredRoles={OWNER_ONLY}>
        <AppShell userRole="owner" activeNav="employees" title="Komponen Gaji Karyawan">
          {error && <ErrorSurface error={error} onRetry={reload} />}
        </AppShell>
      </AuthGuard>
    )
  }

  const deactivatingName = deactivating ? componentById(deactivating.component_id)?.nama_komponen : undefined

  return (
    <AuthGuard requiredRoles={OWNER_ONLY}>
      <AppShell
        userRole="owner"
        activeNav="employees"
        title="Komponen Gaji Karyawan"
        subtitle={employee.nama_lengkap}
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
          <Avatar name={employee.nama_lengkap} size="sm" className="mt-0.5" />
          <div>
            <h1 className="t-h1">{employee.nama_lengkap}</h1>
            <p className="t-caption mt-1">Setup gaji untuk {employee.nama_lengkap}</p>
          </div>
        </div>

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Komponen
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Assignment Gaji</CardTitle>
          <CardDescription>
            {activeAssignments.length} komponen gaji di-assign untuk {employee.nama_lengkap}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={views}
            rowKey={(v) => v.assignment.id}
            caption="Daftar assignment"
            emptyState={
              <EmptyState
                title="Belum ada assignment"
                description={`Belum ada komponen gaji yang di-assign untuk ${employee.nama_lengkap}.`}
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Tambah Komponen
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Pratinjau Take-Home Pay</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between">
              <dt className="t-caption">Gaji Pokok</dt>
              <dd className="tabular-nums font-medium">{formatIDR(totalGajiPokok)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="t-caption">Total Tunjangan</dt>
              <dd className="tabular-nums font-medium">{formatIDR(totalTunjangan)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="t-caption">Total Potongan</dt>
              <dd className="tabular-nums font-medium text-danger">- {formatIDR(totalPotongan)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary-container px-3 py-2">
              <dt className="font-medium">Take-Home Pay</dt>
              <dd className="tabular-nums text-lg font-bold text-primary-oncontainer">
                {formatIDR(takeHome)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <AssignmentDialog
        open={dialogOpen}
        initial={editing}
        components={components}
        assignedComponentIds={activeComponentIds}
        employeeName={employee.nama_lengkap}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSave={save}
      />

      <Dialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title="Nonaktifkan Komponen"
        description={`Nonaktifkan ${deactivatingName ?? 'komponen'} untuk ${employee.nama_lengkap}? Data historis tetap tersimpan.`}
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
    </AuthGuard>
  )
}
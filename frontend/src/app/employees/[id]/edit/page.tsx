'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { AppShell, ErrorSurface, LoadingSurface } from '@/components/ui'
import { EmployeeForm, ServerFieldErrors } from '@/components/employees/employee-form'
import type { EmployeeFormValues, FieldErrors } from '@/components/employees/employee-form'
import { ApiError, api, errorMessage } from '@/lib/api-client'
import type { Employee } from '@/lib/api-client'
import { AuthGuard, OWNER_ONLY } from '@/lib/route-guard'

/**
 * /employees/[id]/edit — edit karyawan (ticket #6, wired #53).
 *
 * Prefills from `GET /api/employees/:id` (not the retired mock), submits via
 * `PATCH /api/employees/:id`, and maps BE validation failures back onto the
 * matching form fields. Success navigates to the detail page with a toast.
 */

/** Form fields the BE update schema can reject, keyed by the same names. */
const FORM_FIELD_KEYS: ReadonlySet<string> = new Set([
  'nama_lengkap',
  'tanggal_lahir',
  'jenis_kontrak',
  'tanggal_masuk',
  'alamat',
  'kontak_darurat',
  'no_ktp',
  'npwp',
])

/** Strip an `invalid_` prefix / ignore non-form keys, e.g. `invalid_npwp` → `npwp`. */
function toFormField(key: string): keyof EmployeeFormValues | null {
  const stripped = key.startsWith('invalid_') ? key.slice('invalid_'.length) : key
  return FORM_FIELD_KEYS.has(stripped) ? (stripped as keyof EmployeeFormValues) : null
}

/**
 * Map an `ApiError` into form-field errors.
 *
 * *   409 Conflict → duplicate KTP (the only conflict this endpoint raises)
 * *   4xx with zod `{ fieldErrors }` details → each field gets its message
 * *   otherwise the three known messages are sniffed onto their field
 */
function mapServerErrors(error: ApiError): FieldErrors {
  const errors: FieldErrors = {}

  if (error.status === 409) {
    errors.no_ktp = error.message || 'No KTP sudah terdaftar'
    return errors
  }

  const details = error.details as
    | { fieldErrors?: Record<string, unknown>; formErrors?: unknown[] }
    | undefined
  if (details?.fieldErrors) {
    for (const [key, messages] of Object.entries(details.fieldErrors)) {
      const field = toFormField(key)
      const message = Array.isArray(messages) ? messages[0] : messages
      if (field && typeof message === 'string') errors[field] = message
    }
    if (Object.keys(errors).length > 0) return errors
  }

  const message = error.message.toLowerCase()
  if (/ktp/.test(message) && /(sudah terdaftar|duplikat|duplicate)/.test(message)) {
    errors.no_ktp = error.message
  } else if (/npwp/.test(message)) {
    errors.npwp = error.message
  } else if (/usia minimal 17|umur/.test(message)) {
    errors.tanggal_lahir = error.message
  }

  return errors
}

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await api.get<{ employee: Employee }>(`/api/employees/${id}`)
      setEmployee(res.employee)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        notFound()
        return
      }
      setLoadError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  const handleSubmit = async (values: EmployeeFormValues): Promise<void> => {
    setFormError(null)
    try {
      await api.patch<{ employee: Employee }>(`/api/employees/${id}`, {
        nama_lengkap: values.nama_lengkap,
        no_ktp: values.no_ktp,
        npwp: values.npwp.trim() || null,
        tanggal_lahir: values.tanggal_lahir,
        alamat: values.alamat.trim() || null,
        kontak_darurat: values.kontak_darurat.trim() || null,
        tanggal_masuk: values.tanggal_masuk,
        jenis_kontrak: values.jenis_kontrak.toLowerCase(),
      })
      setToast('Perubahan karyawan berhasil disimpan.')
      redirectTimer.current = setTimeout(() => router.push(`/employees/${id}`), 700)
    } catch (e) {
      const err = e instanceof ApiError ? e : null
      const fieldErrors = err ? mapServerErrors(err) : {}
      if (Object.keys(fieldErrors).length > 0) {
        // Injected into the form so each message lands on its field.
        throw new ServerFieldErrors(fieldErrors, err?.message)
      }
      setFormError(err ? errorMessage(err) : 'Gagal menyimpan perubahan')
    }
  }

  return (
    <AuthGuard requiredRoles={OWNER_ONLY}>
      <AppShell
        userRole="owner"
        activeNav="employees"
        title="Edit Karyawan"
        subtitle={employee?.no_ktp}
      >
      {loading ? (
        <LoadingSurface label="Memuat data karyawan…" />
      ) : loadError || !employee ? (
        loadError && <ErrorSurface error={loadError} onRetry={() => void load()} />
      ) : (
        <>
        <div>
          <h1 className="t-h1">Edit Karyawan</h1>
          <p className="t-caption mt-1">
            Perbarui data pribadi, kontak, dan dokumen {employee.nama_lengkap}.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-danger/40 bg-danger-container/30 px-4 py-3 text-danger"
          >
            {formError}
          </div>
        )}

        <div className="mt-4">
          <EmployeeForm
            initialValues={employee}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/employees/${id}`)}
          />
        </div>
        </>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full bg-success px-5 py-3 text-sm font-medium text-success-on shadow-e4"
        >
          {toast}
        </div>
      )}
    </AppShell>
    </AuthGuard>
  )
}
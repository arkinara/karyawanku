'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { AppShell } from '@/components/ui'
import { EmployeeForm } from '@/components/employees/employee-form'
import type { EmployeeFormValues } from '@/components/employees/employee-form'
import { getEmployeeById } from '@/lib/employees-mock'

/**
 * /employees/[id]/edit — edit karyawan (ticket #6).
 *
 * Same shared `EmployeeForm`, prefilled from mock data via
 * `getEmployeeById`. On valid submit (mock 1s delay) returns to the
 * read-only detail page with a success toast.
 */
export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const employee = getEmployeeById(id)

  const [toast, setToast] = useState<string | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  if (!employee) return notFound()

  const handleSubmit = async (_values: EmployeeFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setToast('Perubahan karyawan berhasil disimpan.')
    redirectTimer.current = setTimeout(() => router.push(`/employees/${id}`), 800)
  }

  return (
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Edit Karyawan"
      subtitle={employee.nik}
    >
      <div>
        <h1 className="t-h1">Edit Karyawan</h1>
        <p className="t-caption mt-1">
          Perbarui data pribadi, kontak, dan dokumen {employee.nama}.
        </p>
      </div>

      <div className="mt-4">
        <EmployeeForm
          initialValues={employee}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/employees/${id}`)}
        />
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
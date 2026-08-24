'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/ui'
import { EmployeeForm } from '@/components/employees/employee-form'
import type { EmployeeFormValues } from '@/components/employees/employee-form'

/**
 * /employees/new — tambah karyawan (ticket #6).
 *
 * Shared `EmployeeForm` with empty values. On valid submit (mock 1s delay)
 * redirects to the new employee's detail page with a success toast.
 */
export default function NewEmployeePage() {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  const handleSubmit = async (_values: EmployeeFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const newId = `new-${Date.now()}`
    setToast('Karyawan berhasil ditambahkan.')
    redirectTimer.current = setTimeout(() => router.push(`/employees/${newId}`), 800)
  }

  return (
    <AppShell
      userRole="owner"
      activeNav="employees"
      title="Tambah Karyawan"
      subtitle="Warung KopiKu"
    >
      <div>
        <h1 className="t-h1">Tambah Karyawan</h1>
        <p className="t-caption mt-1">Lengkapi data pribadi, kontak, dan dokumen karyawan baru.</p>
      </div>

      <div className="mt-4">
        <EmployeeForm onSubmit={handleSubmit} onCancel={() => router.push('/employees')} />
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
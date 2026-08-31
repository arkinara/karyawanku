'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/ui'
import { EmployeeForm } from '@/components/employees/employee-form'
import type { EmployeeFormValues } from '@/components/employees/employee-form'
import { apiRequest } from '@/lib/api-client'
import { AuthGuard, OWNER_ONLY } from '@/lib/route-guard'

/**
 * /employees/new — tambah karyawan (Wiring phase).
 *
 * POSTs to `/api/employees`, then redirects to the new employee detail page.
 * Shows an inline toast on success and a banner error on BE rejection.
 */
export default function NewEmployeePage() {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    },
    [],
  )

  const handleSubmit = async (values: EmployeeFormValues) => {
    setError(null)
    try {
      const res = await apiRequest<{ employee: { id: string } }>('/api/employees', {
        method: 'POST',
        body: {
          nama_lengkap: values.nama_lengkap,
          no_ktp: values.no_ktp,
          npwp: values.npwp || null,
          tanggal_lahir: values.tanggal_lahir,
          jenis_kelamin: 'L',
          alamat: values.alamat || null,
          kontak_darurat: values.kontak_darurat || null,
          tanggal_masuk: values.tanggal_masuk,
          jenis_kontrak: values.jenis_kontrak.toLowerCase(),
          status: 'aktif',
        },
      })
      setToast('Karyawan berhasil ditambahkan.')
      redirectTimer.current = setTimeout(() => router.push(`/employees/${res.employee.id}`), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah karyawan')
    }
  }

  return (
    <AuthGuard requiredRoles={OWNER_ONLY}>
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

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-danger/40 bg-danger-container/30 px-4 py-3 text-danger"
        >
          {error}
        </div>
      )}

      <div className="mt-4">
        <EmployeeForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/employees')}
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
    </AuthGuard>
  )
}
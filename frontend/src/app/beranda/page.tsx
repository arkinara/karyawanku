'use client'

import { AppShell } from '@/components/ui'
import { EmployeeDashboard } from '@/components/dashboard/employee-dashboard'
import { useAuth } from '@/lib/auth-context'
import { AuthGuard, EMPLOYEE_ONLY } from '@/lib/route-guard'

export default function BerandaPage() {
  const { user } = useAuth()
  const greeting = user?.nama ? `Selamat pagi, ${user.nama}` : 'Selamat pagi'

  return (
    <AuthGuard requiredRoles={EMPLOYEE_ONLY}>
      <AppShell
        userRole="employee"
        activeNav="home"
        title={greeting}
        subtitle={user?.nama ?? 'Karyawan'}
      >
        <EmployeeDashboard />
      </AppShell>
    </AuthGuard>
  )
}
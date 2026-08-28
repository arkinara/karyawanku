import { describe, expect, it } from 'vitest'
import { getNavForRole, NAV, roleHome } from '@/lib/nav-config'

describe('NAV model (kk.js NAV map port)', () => {
  it('owner: 5 primary + 1 secondary, settings hanya di secondary', () => {
    expect(NAV.owner.primary).toHaveLength(5)
    expect(NAV.owner.secondary).toHaveLength(1)
    expect(NAV.owner.secondary[0]?.key).toBe('settings')
    expect(NAV.owner.primary.some((i) => i.key === 'settings')).toBe(false)
  })

  // Commit 994beea (M3 bridge) removed the employee settings entry — employee
  // rail has no secondary group now.
  it('employee: primary [home, attendance, leave, payslip], no secondary', () => {
    expect(NAV.employee.primary.map((i) => i.key)).toEqual([
      'home',
      'attendance',
      'leave',
      'payslip',
    ])
    expect(NAV.employee.secondary.map((i) => i.key)).toEqual([])
    expect(NAV.employee.primary.some((i) => i.key === 'settings')).toBe(false)
  })

  it('setiap item primary punya key/label/icon/href yang valid', () => {
    for (const role of ['owner', 'employee'] as const) {
      for (const item of [...NAV[role].primary, ...NAV[role].secondary]) {
        expect(item.key).toBeTruthy()
        expect(item.label).toBeTruthy()
        expect(item.icon).toBeTruthy()
        expect(item.href.startsWith('/')).toBe(true)
      }
    }
  })

  it('badge cuti untuk owner (2) dan employee (1)', () => {
    const ownerLeave = NAV.owner.primary.find((i) => i.key === 'leave')
    const employeeLeave = NAV.employee.primary.find((i) => i.key === 'leave')
    expect(ownerLeave?.badge).toBe(2)
    expect(employeeLeave?.badge).toBe(1)
  })
})

describe('Manager nav (ticket #50)', () => {
  it('manager: 5 primary [dashboard, attendance, leave, shifts, employees], no payroll', () => {
    expect(NAV.manager.primary.map((i) => i.key)).toEqual([
      'dashboard',
      'attendance',
      'leave',
      'shifts',
      'employees',
    ])
    expect(NAV.manager.primary.some((i) => i.key === 'payroll')).toBe(false)
    expect(NAV.manager.secondary.map((i) => i.key)).toEqual([])
  })

  it('manager nav tidak pernah memuat payroll atau settings di surface mana pun', () => {
    for (const item of [...NAV.manager.primary, ...NAV.manager.secondary]) {
      expect(item.href).not.toMatch(/^\/payroll/)
      expect(item.href).not.toMatch(/^\/settings/)
    }
  })

  it('getNavForRole mengembalikan nav yang tepat per role', () => {
    expect(getNavForRole('owner').primary.map((i) => i.key)).toContain('payroll')
    expect(getNavForRole('manager').primary.map((i) => i.key)).toContain('shifts')
    expect(getNavForRole('employee').primary.map((i) => i.key)).toEqual([
      'home',
      'attendance',
      'leave',
      'payslip',
    ])
  })

  it('role tidak dikenal jatuh ke nav employee (paling aman)', () => {
    const nav = getNavForRole('superadmin' as never)
    expect(nav.role).toBe('employee')
    expect(nav.primary.some((i) => i.key === 'payroll')).toBe(false)
  })

  it('roleHome: owner dan manager ke /dashboard, employee ke /beranda', () => {
    expect(roleHome('owner')).toBe('/dashboard')
    expect(roleHome('manager')).toBe('/dashboard')
    expect(roleHome('employee')).toBe('/beranda')
  })
})
import { describe, expect, it } from 'vitest'
import { NAV } from '@/lib/nav-config'

describe('NAV model (kk.js NAV map port)', () => {
  it('owner: 5 primary + 1 secondary, settings hanya di secondary', () => {
    expect(NAV.owner.primary).toHaveLength(5)
    expect(NAV.owner.secondary).toHaveLength(1)
    expect(NAV.owner.secondary[0]?.key).toBe('settings')
    expect(NAV.owner.primary.some((i) => i.key === 'settings')).toBe(false)
  })

  it('employee: primary [home, attendance, leave, payslip] + secondary [settings]', () => {
    expect(NAV.employee.primary.map((i) => i.key)).toEqual([
      'home',
      'attendance',
      'leave',
      'payslip',
    ])
    expect(NAV.employee.secondary.map((i) => i.key)).toEqual(['settings'])
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
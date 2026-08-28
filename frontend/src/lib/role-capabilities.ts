'use client'

import { useAuth } from '@/lib/auth-context'

/**
 * KaryawanKu — frozen capability contract (ticket #50).
 *
 * Drives every UI gate (nav entries, action buttons, view selection) instead
 * of hardcoded `role === 'owner'` branches. The matrix is defined locally for
 * now; once BE ticket #49 (manager role schema / permission matrix) lands,
 * this module is replaced by BE-derived data — the shape below is the frozen
 * contract callers should keep using.
 */

export type Role = 'owner' | 'manager' | 'employee'

export interface RoleCapabilities {
  canViewPayroll: boolean
  canRunPayroll: boolean
  canEditEmployees: boolean
  canViewEmployees: boolean
  canApproveLeave: boolean
  canPublishRoster: boolean
  canEditBusinessProfile: boolean
  canManageUsers: boolean
  /** Salary components (Komponen Gaji) editing — owner only, never manager. */
  canEditSalaryComponents: boolean
}

/** BE role enum (matches `roles` in the backend user schema). */
export const USER_ROLES: readonly Role[] = ['owner', 'manager', 'employee']

/** Bahasa/UI label per role — used by selects and role chips. */
export const USER_ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  employee: 'Employee',
}

/** Owner: every action. */
export const OWNER_CAPABILITIES: RoleCapabilities = {
  canViewPayroll: true,
  canRunPayroll: true,
  canEditEmployees: true,
  canViewEmployees: true,
  canApproveLeave: true,
  canPublishRoster: true,
  canEditBusinessProfile: true,
  canManageUsers: true,
  canEditSalaryComponents: true,
}

/**
 * Manager: day-to-day operations, no payroll, no business profile editing.
 * `canManageUsers` is deliberately "limited" — surfaced only when BE #49 lands;
 * no manager UI consumes it in this ticket.
 */
export const MANAGER_CAPABILITIES: RoleCapabilities = {
  canViewPayroll: false,
  canRunPayroll: false,
  canEditEmployees: false,
  canViewEmployees: true,
  canApproveLeave: true,
  canPublishRoster: true,
  canEditBusinessProfile: false,
  canManageUsers: true,
  canEditSalaryComponents: false,
}

/** Employee: self-service only. */
export const EMPLOYEE_CAPABILITIES: RoleCapabilities = {
  canViewPayroll: false,
  canRunPayroll: false,
  canEditEmployees: false,
  canViewEmployees: false,
  canApproveLeave: false,
  canPublishRoster: false,
  canEditBusinessProfile: false,
  canManageUsers: false,
  canEditSalaryComponents: false,
}

const CAPABILITIES: Record<Role, RoleCapabilities> = {
  owner: OWNER_CAPABILITIES,
  manager: MANAGER_CAPABILITIES,
  employee: EMPLOYEE_CAPABILITIES,
}

/**
 * Map a role to its capability set. Unknown or future role values fall back to
 * the safest set (employee) so the shell never crashes on an unexpected role.
 */
export function capabilitiesForRole(role: Role | null | undefined): RoleCapabilities {
  return CAPABILITIES[role ?? 'employee'] ?? EMPLOYEE_CAPABILITIES
}

/**
 * Read the current session's capability set. Gate actions with
 * `const { canEditEmployees } = useCapabilities()`.
 */
export function useCapabilities(): RoleCapabilities {
  const { user } = useAuth()
  return capabilitiesForRole(user?.role as Role | undefined)
}

/** Pure helper for capability assertions on an explicit role. */
export function can(capability: keyof RoleCapabilities, role: Role): boolean {
  return capabilitiesForRole(role)[capability]
}
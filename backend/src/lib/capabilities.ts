import type { Role } from '../db/schema.js'

/**
 * KaryawanKu — capability matrix (ticket #49).
 *
 * Satu sumber kebenaran untuk otorisasi berbasis peran di sisi server.
 * Tiap capability dipetakan ke peran yang memegangnya; guard rute
 * (`requireCapability`) membaca matriks ini, bukan membandingkan `role`
 * secara langsung di tiap handler.
 */

export const capabilities = [
  'attendance.manage',
  'leave.approve',
  'roster.publish',
  'payroll.run',
  'payroll.approve',
  'employees.write',
  'salary.write',
  'settings.write',
  'users.manage',
  'business.manage',
] as const

export type Capability = (typeof capabilities)[number]

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  owner: capabilities,
  manager: ['attendance.manage', 'leave.approve', 'roster.publish', 'employees.write', 'users.manage'],
  employee: [],
}

export function hasCapability(role: Role, capability: Capability): boolean {
  return (ROLE_CAPABILITIES[role] as readonly Capability[]).includes(capability)
}

/** Capability yang dipegang sebuah peran, sebagai array mutable. */
export function capabilitiesForRole(role: Role): Capability[] {
  return [...ROLE_CAPABILITIES[role]]
}

/**
 * Salinan matriks dalam bentuk yang aman untuk konsumsi frontend (array
 * mutable per peran). Di-expose lewat `GET /api/auth/me` agar FE bisa
 * menurunkan gating-nya dari sumber yang sama.
 */
export const ROLE_CAPABILITIES_FOR_FRONTEND: Record<Role, Capability[]> = Object.fromEntries(
  Object.entries(ROLE_CAPABILITIES).map(([role, caps]) => [role, [...caps]]),
) as Record<Role, Capability[]>

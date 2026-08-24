'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export const WIZARD_STORAGE_KEY = 'kk-onboarding-draft'

export type JenisUsaha = 'fnb' | 'jasa'
export type ComponentType = 'earning' | 'deduction'

export interface SalaryComponent {
  id: string
  name: string
  type: ComponentType
  description: string
  enabled: boolean
}

export interface WizardState {
  /** Zero-based active step index. */
  currentStep: number
  namaBisnis: string
  jenisUsaha: '' | JenisUsaha
  alamat: string
  components: SalaryComponent[]
  completed: boolean
}

/** The 6 default salary components (ticket AC): earnings + BPJS/PPh deductions. */
export const DEFAULT_COMPONENTS: SalaryComponent[] = [
  {
    id: 'gaji-pokok',
    name: 'Gaji pokok',
    type: 'earning',
    description: 'Dasar perhitungan BPJS dan PPh 21',
    enabled: true,
  },
  {
    id: 'tunjangan-transport',
    name: 'Tunjangan transport',
    type: 'earning',
    description: 'Dibayar penuh per bulan',
    enabled: true,
  },
  {
    id: 'tunjangan-makan',
    name: 'Tunjangan makan',
    type: 'earning',
    description: 'Dihitung per hari hadir',
    enabled: true,
  },
  {
    id: 'tunjangan-jabatan',
    name: 'Tunjangan jabatan',
    type: 'earning',
    description: 'Diberikan sesuai level jabatan',
    enabled: true,
  },
  {
    id: 'potongan-bpjs-kesehatan',
    name: 'Potongan BPJS Kesehatan',
    type: 'deduction',
    description: 'Iuran pekerja dari gaji pokok',
    enabled: true,
  },
  {
    id: 'potongan-bpjs-ket',
    name: 'Potongan BPJS Ketenagakerjaan',
    type: 'deduction',
    description: 'Iuran JHT dan JP pekerja',
    enabled: true,
  },
]

export const WIZARD_STEPS: { name: string; key: string }[] = [
  { name: 'Profil usaha', key: 'business-profile' },
  { name: 'Komponen gaji', key: 'salary-components' },
  { name: 'Konfirmasi', key: 'confirmation' },
]

function createInitialState(): WizardState {
  return {
    currentStep: 0,
    namaBisnis: '',
    jenisUsaha: '',
    alamat: '',
    components: DEFAULT_COMPONENTS.map((c) => ({ ...c })),
    completed: false,
  }
}

function loadFromStorage(): WizardState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WizardState>
    const base = createInitialState()
    return {
      ...base,
      ...parsed,
      // Merge saved toggles over the canonical default list so a stale/malformed
      // draft can never invent components we don't know about.
      components: Array.isArray(parsed.components)
        ? DEFAULT_COMPONENTS.map((def) => {
            const saved = parsed.components?.find((c) => c.id === def.id)
            return { ...def, enabled: saved ? saved.enabled : def.enabled }
          })
        : base.components,
    }
  } catch {
    return null
  }
}

function persist(state: WizardState) {
  try {
    window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable — wizard still works in-memory */
  }
}

/**
 * Wizard state machine for the onboarding flow. Everything lives here so the
 * page stays a thin renderer and tests can drive state via DOM interactions.
 *
 * Persistence: state is hydrated from localStorage once on mount, then saved on
 * every change (a reload never loses progress). `complete()` wipes the draft —
 * the persist effect stops saving once `completed` is set, so the clear sticks.
 */
export function useWizard() {
  const [state, setState] = useState<WizardState>(createInitialState)
  const firstRender = useRef(true)

  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) setState(saved)
  }, [])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (state.completed) return
    persist(state)
  }, [state])

  const activeEarnings = useMemo(
    () => state.components.filter((c) => c.enabled && c.type === 'earning').length,
    [state.components],
  )

  /** Per-step validity. Step 2 is always navigable — the all-disabled case is a
   *  non-blocking inline warning, not a gate. */
  const stepValid = useMemo(
    () => [
      state.namaBisnis.trim().length >= 1 &&
        state.jenisUsaha !== '' &&
        state.alamat.trim().length >= 1,
      true,
      true,
    ],
    [state.namaBisnis, state.jenisUsaha, state.alamat],
  )

  const setField = (field: 'namaBisnis' | 'jenisUsaha' | 'alamat', value: string) => {
    setState((s) => {
      if (field === 'namaBisnis') return { ...s, namaBisnis: value }
      if (field === 'jenisUsaha') return { ...s, jenisUsaha: value as '' | JenisUsaha }
      return { ...s, alamat: value }
    })
  }

  const toggleComponent = (id: string) => {
    setState((s) => ({
      ...s,
      components: s.components.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
    }))
  }

  const goNext = () => {
    if (!stepValid[state.currentStep]) return
    setState((s) => ({ ...s, currentStep: Math.min(s.currentStep + 1, WIZARD_STEPS.length - 1) }))
  }

  const goBack = () => {
    setState((s) => ({ ...s, currentStep: Math.max(s.currentStep - 1, 0) }))
  }

  /** "Skip" on step 2 jumps straight to the confirmation step. */
  const skip = () => {
    setState((s) => ({ ...s, currentStep: WIZARD_STEPS.length - 1 }))
  }

  const complete = () => {
    try {
      window.localStorage.removeItem(WIZARD_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, completed: true }))
  }

  return {
    state,
    activeEarnings,
    stepValid,
    setField,
    toggleComponent,
    goNext,
    goBack,
    skip,
    complete,
  }
}

export type WizardApi = ReturnType<typeof useWizard>

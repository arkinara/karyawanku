/**
 * KaryawanKu — payroll domain types + helpers + BE mappers (snake_case → camelCase).
 *
 * The BE payroll-run response shape:
 *   {
 *     run: { id, business_id, periode, status, total_gaji, total_potongan, take_home, ... },
 *     items: [{
 *       id, payroll_run_id, employee_id, employee: { id, nama_lengkap },
 *       gaji_pokok, total_tunjangan, total_bpjs_kesehatan, total_bpjs_tk, pph21,
 *       koreksi, catatan_koreksi, take_home,
 *       detail_breakdown: {
 *         tunjangan: [{ nama, nominal }, ...],
 *         potongan: [{ nama, nominal }, ...],
 *         penyesuaian: number,
 *         catatan: string,
 *       }
 *     }]
 *   }
 *
 * The FE `PayrollItem` shape wants:
 *   { employeeId, nik, nama, jabatan, gajiPokok, tunjangan[], potongan[],
 *     penyesuaian, catatan }
 *
 * The adapter reconstructs the tunjangan/potongan arrays from
 * `detail_breakdown`, and falls back to aggregated rows when the breakdown is
 * missing. Pure domain helpers (`gross`, `potongan`, `takeHome`, `summarize`)
 * live here so no mock module is needed.
 */

export type PayrollRunStatus = 'draft' | 'approved'

export interface PayrollComponentRow {
  /** Component name from the salary catalog, e.g. "Tunjangan Transport". */
  nama: string
  nominal: number
}

export interface PayrollItem {
  employeeId: string
  nik: string
  nama: string
  jabatan: string
  gajiPokok: number
  tunjangan: PayrollComponentRow[]
  potongan: PayrollComponentRow[]
  /** Manual correction (e.g. lembur belum tercatat) — can be negative. */
  penyesuaian: number
  catatan: string
}

export interface PayrollRun {
  period: string
  status: PayrollRunStatus
  items: PayrollItem[]
  generatedAt: string
}

/** Gross pendapatan: gaji pokok + seluruh tunjangan. */
export function gross(item: PayrollItem): number {
  return item.gajiPokok + item.tunjangan.reduce((sum, t) => sum + t.nominal, 0)
}

/** Total potongan: BPJS + PPh 21. */
export function potongan(item: PayrollItem): number {
  return item.potongan.reduce((sum, p) => sum + p.nominal, 0)
}

/** Take-home including any manual correction. */
export function takeHome(item: PayrollItem): number {
  return gross(item) - potongan(item) + item.penyesuaian
}

export interface PayrollSummary {
  count: number
  totalGaji: number
  totalPotongan: number
  totalTakeHome: number
}

export function summarize(run: Pick<PayrollRun, 'items'>): PayrollSummary {
  return run.items.reduce(
    (acc, item) => {
      acc.count += 1
      acc.totalGaji += gross(item)
      acc.totalPotongan += potongan(item)
      acc.totalTakeHome += takeHome(item)
      return acc
    },
    { count: 0, totalGaji: 0, totalPotongan: 0, totalTakeHome: 0 },
  )
}

/* ------------------------------------------------------------------ *
 * BE wire types + mappers
 * ------------------------------------------------------------------ */

export interface BePayrollRun {
  id: string
  business_id: string
  periode: string
  status: 'draft' | 'disetujui' | 'locked'
  total_gaji: number
  total_potongan: number
  take_home: number
  approved_at: string | null
  approved_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface BePayrollItem {
  id: string
  payroll_run_id: string
  employee_id: string
  gaji_pokok: number
  total_tunjangan: number
  total_bpjs_kesehatan: number
  total_bpjs_tk: number
  pph21: number
  koreksi: number
  catatan_koreksi: string | null
  take_home: number
  detail_breakdown: Record<string, unknown> | null
  employee: { id: string; nama_lengkap: string | null }
}

export interface BePayrollRunResponse {
  run: BePayrollRun
  items: BePayrollItem[]
}

export interface BePayrollRunListResponse {
  runs: BePayrollRun[]
}

const STATUS_MAP: Record<BePayrollRun['status'], PayrollRunStatus> = {
  draft: 'draft',
  disetujui: 'approved',
  locked: 'approved',
}

interface BreakdownComponent {
  nama: string
  nominal: number
}

function asComponents(value: unknown): BreakdownComponent[] {
  if (!Array.isArray(value)) return []
  const out: BreakdownComponent[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as { nama?: unknown; nominal?: unknown }
    if (typeof obj.nama !== 'string' || typeof obj.nominal !== 'number') continue
    out.push({ nama: obj.nama, nominal: obj.nominal })
  }
  return out
}

function mapItem(be: BePayrollItem): PayrollItem {
  const breakdown = be.detail_breakdown ?? {}
  const tunjangan = asComponents(breakdown.tunjangan)
  const potongan = asComponents(breakdown.potongan)
  const penyesuaian = typeof breakdown.penyesuaian === 'number' ? (breakdown.penyesuaian as number) : be.koreksi
  const catatan =
    typeof breakdown.catatan === 'string'
      ? (breakdown.catatan as string)
      : (be.catatan_koreksi ?? '')

  // Fallback: if breakdown missing, surface aggregate rows so the FE breakdown
  // panel still renders meaningful content.
  const tunjanganRows = tunjangan.length
    ? tunjangan
    : be.total_tunjangan > 0
      ? [{ nama: 'Tunjangan', nominal: be.total_tunjangan }]
      : []
  const potonganRows =
    potongan.length > 0
      ? potongan
      : be.total_bpjs_kesehatan + be.total_bpjs_tk + be.pph21 > 0
        ? [
            { nama: 'BPJS Kesehatan', nominal: be.total_bpjs_kesehatan },
            { nama: 'BPJS Ketenagakerjaan', nominal: be.total_bpjs_tk },
            { nama: 'PPh 21', nominal: be.pph21 },
          ]
        : []

  return {
    employeeId: be.employee_id,
    nik: '',
    nama: be.employee.nama_lengkap ?? 'Karyawan',
    jabatan: '-',
    gajiPokok: be.gaji_pokok,
    tunjangan: tunjanganRows,
    potongan: potonganRows,
    penyesuaian,
    catatan,
  }
}

export function mapPayrollRun(be: BePayrollRunResponse): PayrollRun {
  return {
    period: be.run.periode,
    status: STATUS_MAP[be.run.status],
    items: be.items.map(mapItem),
    generatedAt: be.run.created_at,
  }
}

/** Build an empty run (used when no run exists yet for the period). */
export function emptyPayrollRun(period: string): PayrollRun {
  return {
    period,
    status: 'draft',
    items: [],
    generatedAt: new Date().toISOString(),
  }
}

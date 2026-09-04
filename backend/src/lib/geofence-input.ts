import { ApiError } from './errors.js'

/**
 * Validasi koordinat dari body clock-in/out (ticket #67).
 *
 * Koordinat dicatat **persis seperti dilaporkan klien** — tidak pernah
 * diinferensikan dari IP. Nilai tidak sah (NaN, Infinity, di luar rentang,
 * negatif) ditolak 422. Tanpa koordinat sama sekali → `null` (jalur lama);
 * lat tanpa lon (atau sebaliknya) dianggap data cacat dan ditolak.
 */

export interface ParsedCoordinates {
  lat: number
  lon: number
  /** Akurasi GPS dalam meter; null bila klien tidak mengirimkannya. */
  accuracy: number | null
}

export interface RawGeofenceInput {
  latitude?: unknown
  longitude?: unknown
  lat?: unknown
  lng?: unknown
  accuracy_m?: unknown
}

/** Terima angka, string numerik, null/undefined (kosong); tolak NaN/Infinity. */
function toFiniteNumber(raw: unknown, label: string): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw))
  if (!Number.isFinite(n)) throw new ApiError(422, `${label} tidak valid`)
  return n
}

/**
 * Parse koordinat dari body. Kedua nama field diterima: `latitude`/`longitude`
 * (kontrak #67) dan `lat`/`lng` (payload yang dikirim mobile #68).
 */
export function parseCoordinates(input: RawGeofenceInput): ParsedCoordinates | null {
  const lat = toFiniteNumber(input.lat ?? input.latitude, 'latitude')
  const lon = toFiniteNumber(input.lng ?? input.longitude, 'longitude')

  if (lat === null && lon === null) return null
  if (lat === null || lon === null) {
    throw new ApiError(422, 'latitude dan longitude wajib dikirim bersama')
  }

  if (lat < -90 || lat > 90) throw new ApiError(422, 'latitude di luar rentang [-90, 90]')
  if (lon < -180 || lon > 180) throw new ApiError(422, 'longitude di luar rentang [-180, 180]')

  const accuracy = toFiniteNumber(input.accuracy_m, 'accuracy_m')
  if (accuracy !== null && accuracy < 0) {
    throw new ApiError(422, 'accuracy_m tidak boleh negatif')
  }

  return { lat, lon, accuracy }
}
/**
 * Geofence service (ticket #67).
 *
 * Evaluasi jarak dilakukan murni **server-side**: koordinat dilaporkan klien
 * apa adanya, jarak dihitung BE, dan verdict (`on_site` / `off_site` /
 * `poor_accuracy` / `unknown`) ditentukan di sini — klien tidak bisa
 * meng-override statusnya sendiri. Bisnis tanpa lokasi yang dikonfigurasi
 * menghasilkan `unknown` (perilaku lama, tanpa flag, tanpa blok).
 */

export type GeofenceStatus = 'on_site' | 'off_site' | 'poor_accuracy' | 'unknown'

export interface GeofencePoint {
  lat: number | null
  lon: number | null
  accuracyM: number | null
}

export interface GeofenceConfig {
  workLat: number | null
  workLon: number | null
  radiusM: number | null
  mode: 'flag_only' | 'block_in_radius'
}

export interface GeofenceVerdict {
  status: GeofenceStatus
  distanceM: number | null
}

/** Jari-jari Bumi (meter) untuk perhitungan great-circle. */
const EARTH_RADIUS_METERS = 6371000

/**
 * Jarak great-circle (haversine) antara dua koordinat, dalam meter.
 * Presisi submeter cukup untuk radius kerja sekecil 20 m.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/**
 * Evaluasi posisi klien terhadap geofence bisnis.
 *
 * - Input tidak lengkap (koordinat / akurasi / lokasi kerja / radius null) →
 *   `unknown`, jarak null. Bisnis tanpa lokasi tidak pernah memunculkan flag.
 * - Akurasi <= 0 (platform tidak punya estimasi) atau akurasi > radius →
 *   `poor_accuracy` (GPS jelek ≠ di lokasi), jarak tetap dicatat.
 * - Selain itu `on_site` bila `jarak <= radius`, `off_site` bila lebih.
 */
export function evaluateGeofence(
  point: GeofencePoint,
  config: GeofenceConfig,
): GeofenceVerdict {
  if (
    point.lat == null ||
    point.lon == null ||
    point.accuracyM == null ||
    config.workLat == null ||
    config.workLon == null ||
    config.radiusM == null
  ) {
    return { status: 'unknown', distanceM: null }
  }

  const distanceM = haversineDistanceMeters(
    point.lat,
    point.lon,
    config.workLat,
    config.workLon,
  )

  // `accuracy <= 0` is not a perfect fix — it is the platform saying it has no
  // accuracy estimate (Android reports 0, iOS reports negative). Trusting it
  // would let the weakest fix claim the strongest verdict. Mirrors the mobile
  // guard in `location_service.dart` (`user.accuracy <= 0` → lowAccuracy).
  if (point.accuracyM <= 0 || point.accuracyM > config.radiusM) {
    return { status: 'poor_accuracy', distanceM }
  }

  return distanceM <= config.radiusM
    ? { status: 'on_site', distanceM }
    : { status: 'off_site', distanceM }
}
import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { businesses, employees, users } from '../src/db/schema.js'
import { evaluateGeofence, haversineDistanceMeters } from '../src/lib/geofence.js'
import { parseCoordinates } from '../src/lib/geofence-input.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

let ktpCounter = 0
function makeNoKtp(): string {
  ktpCounter += 1
  return '1122334455' + String(700000 + ktpCounter)
}

function at(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0).toISOString()
}

async function seedEmployee(name = 'Siti'): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function linkEmployeeUser(employeeId: string) {
  ctx.db.db
    .update(users)
    .set({ employee_id: employeeId })
    .where(eq(users.email, 'siti@demo.com'))
    .run()
}

// Work location dummy: Jakarta. Offset jarak dilakukan sepanjang latitude
// (1° lat ≈ 111320 m) agar deterministik dan bebas efek cos(lat) longitude.
const WORK_LAT = -6.2088
const WORK_LON = 106.8456
const M_PER_DEG_LAT = 111320

function coordAt(distanceM: number, accuracyM = 5): { latitude: number; longitude: number; accuracy_m: number } {
  return { latitude: WORK_LAT + distanceM / M_PER_DEG_LAT, longitude: WORK_LON, accuracy_m: accuracyM }
}

async function configureGeofence(overrides: Record<string, unknown> = {}) {
  ctx.db.db
    .update(businesses)
    .set({
      work_latitude: WORK_LAT,
      work_longitude: WORK_LON,
      work_radius_m: 100,
      geofence_mode: 'flag_only',
      ...overrides,
    })
    .where(eq(businesses.id, ctx.businessId))
    .run()
}

async function clockIn(payload: Record<string, unknown>, token = ctx.employeeToken) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/attendance/clock-in',
    headers: { ...auth(token), 'Idempotency-Key': randomUUID() },
    payload,
  })
}

function recordCount(): number {
  return (ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM attendance_records').get() as { n: number }).n
}

describe('haversineDistanceMeters', () => {
  it('titik yang sama → 0 meter', () => {
    expect(haversineDistanceMeters(-6.2088, 106.8456, -6.2088, 106.8456)).toBe(0)
  })

  it('Jakarta–Bandung ≈ 110 km', () => {
    const d = haversineDistanceMeters(-6.2088, 106.8456, -6.9175, 107.6191)
    expect(d).toBeGreaterThan(100000)
    expect(d).toBeLessThan(125000)
  })

  it('offset 50 m sepanjang latitude ≈ 50 m', () => {
    const d = haversineDistanceMeters(WORK_LAT, WORK_LON, WORK_LAT + 50 / M_PER_DEG_LAT, WORK_LON)
    expect(d).toBeGreaterThan(45)
    expect(d).toBeLessThan(55)
  })
})

describe('evaluateGeofence', () => {
  it('lokasi kerja tidak dikonfigurasi → unknown, jarak null', () => {
    const v = evaluateGeofence(
      { lat: 0, lon: 0, accuracyM: 5 },
      { workLat: null, workLon: null, radiusM: null, mode: 'flag_only' },
    )
    expect(v).toEqual({ status: 'unknown', distanceM: null })
  })

  it('50 m di dalam radius 100 m, akurasi 5 m → on_site + jarak ≈ 50', () => {
    const v = evaluateGeofence(
      { lat: WORK_LAT + 50 / M_PER_DEG_LAT, lon: WORK_LON, accuracyM: 5 },
      { workLat: WORK_LAT, workLon: WORK_LON, radiusM: 100, mode: 'flag_only' },
    )
    expect(v.status).toBe('on_site')
    expect(v.distanceM).toBeGreaterThan(45)
    expect(v.distanceM).toBeLessThan(55)
  })

  it('250 m di luar radius 100 m, akurasi 5 m → off_site + jarak ≈ 250', () => {
    const v = evaluateGeofence(
      { lat: WORK_LAT + 250 / M_PER_DEG_LAT, lon: WORK_LON, accuracyM: 5 },
      { workLat: WORK_LAT, workLon: WORK_LON, radiusM: 100, mode: 'flag_only' },
    )
    expect(v.status).toBe('off_site')
    expect(v.distanceM).toBeGreaterThan(240)
    expect(v.distanceM).toBeLessThan(260)
  })

  it('50 m di dalam radius tetapi akurasi 250 m → poor_accuracy (bukan on-site)', () => {
    const v = evaluateGeofence(
      { lat: WORK_LAT + 50 / M_PER_DEG_LAT, lon: WORK_LON, accuracyM: 250 },
      { workLat: WORK_LAT, workLon: WORK_LON, radiusM: 100, mode: 'block_in_radius' },
    )
    expect(v.status).toBe('poor_accuracy')
    expect(v.distanceM).toBeGreaterThan(45)
    expect(v.distanceM).toBeLessThan(55)
  })

  it('work lat/lon null → unknown', () => {
    const v = evaluateGeofence(
      { lat: WORK_LAT, lon: WORK_LON, accuracyM: 5 },
      { workLat: null, workLon: null, radiusM: 100, mode: 'block_in_radius' },
    )
    expect(v).toEqual({ status: 'unknown', distanceM: null })
  })

  it('akurasi 0 (platform tanpa estimasi) → poor_accuracy, bukan on_site', () => {
    const v = evaluateGeofence(
      { lat: WORK_LAT, lon: WORK_LON, accuracyM: 0 },
      { workLat: WORK_LAT, workLon: WORK_LON, radiusM: 100, mode: 'flag_only' },
    )
    expect(v.status).toBe('poor_accuracy')
  })

  it('akurasi null → unknown (tidak pernah menganggap on-site tanpa akurasi)', () => {
    const v = evaluateGeofence(
      { lat: WORK_LAT, lon: WORK_LON, accuracyM: null },
      { workLat: WORK_LAT, workLon: WORK_LON, radiusM: 100, mode: 'flag_only' },
    )
    expect(v).toEqual({ status: 'unknown', distanceM: null })
  })
})

describe('parseCoordinates', () => {
  it('koordinat valid → parsed', () => {
    expect(parseCoordinates({ latitude: -6.2, longitude: 106.8, accuracy_m: 5 })).toEqual({
      lat: -6.2,
      lon: 106.8,
      accuracy: 5,
    })
  })

  it('string numerik diterima', () => {
    expect(parseCoordinates({ latitude: '-6.2', longitude: '106.8' })).toEqual({
      lat: -6.2,
      lon: 106.8,
      accuracy: null,
    })
  })

  it('tanpa koordinat → null', () => {
    expect(parseCoordinates({})).toBeNull()
    expect(parseCoordinates({ latitude: null, longitude: null })).toBeNull()
  })

  it('lat di luar rentang → 422', () => {
    expect(() => parseCoordinates({ latitude: 91, longitude: 106.8, accuracy_m: 5 })).toThrow(/latitude/)
  })

  it('lon di luar rentang → 422', () => {
    expect(() => parseCoordinates({ latitude: -6.2, longitude: 181, accuracy_m: 5 })).toThrow(/longitude/)
  })

  it('accuracy negatif → 422', () => {
    expect(() => parseCoordinates({ latitude: -6.2, longitude: 106.8, accuracy_m: -1 })).toThrow(/accuracy/)
  })

  it('NaN/Infinity → 422', () => {
    expect(() => parseCoordinates({ latitude: NaN, longitude: 106.8 })).toThrow(/latitude/)
    expect(() => parseCoordinates({ latitude: Infinity, longitude: 106.8 })).toThrow(/latitude/)
  })

  it('hanya lat tanpa lon → 422', () => {
    expect(() => parseCoordinates({ latitude: -6.2 })).toThrow(/latitude/)
  })
})

describe('POST /api/attendance/clock-in — geofence', () => {
  it('di dalam radius, bisnis flag_only → 201 on_site + jarak tercatat', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'flag_only' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-02', '07:45'),
      ...coordAt(50),
    })
    expect(res.statusCode).toBe(201)
    const record = res.json().record
    expect(record.geofence_status).toBe('on_site')
    expect(record.clock_in_distance_m).toBeGreaterThan(40)
    expect(record.clock_in_distance_m).toBeLessThan(60)
    expect(record.clock_in_latitude).toBeCloseTo(WORK_LAT + 50 / M_PER_DEG_LAT, 5)
  })

  it('di dalam radius, bisnis block_in_radius → 201 on_site', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-03', '07:45'),
      ...coordAt(50),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().record.geofence_status).toBe('on_site')
  })

  it('di luar radius, bisnis flag_only → 201 off_site + jarak tercatat', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'flag_only' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-04', '07:45'),
      ...coordAt(250),
    })
    expect(res.statusCode).toBe(201)
    const record = res.json().record
    expect(record.geofence_status).toBe('off_site')
    expect(record.clock_in_distance_m).toBeGreaterThan(240)
    expect(record.clock_in_distance_m).toBeLessThan(260)
  })

  it('di luar radius, bisnis block_in_radius → 422 outside_geofence, tanpa record', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-05', '07:45'),
      ...coordAt(250),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toBe('outside_geofence')
    expect(res.json().error.details.distance_m).toBeGreaterThan(240)
    expect(res.json().error.details.radius_m).toBe(100)
    expect(res.json().error.details.business_id).toBe(ctx.businessId)
    expect(recordCount()).toBe(0)
  })

  it('akurasi 0 di dalam radius, bisnis block_in_radius → 422 accuracy_too_poor', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    // accuracy_m = 0 berarti "platform tidak punya estimasi", bukan fix sempurna.
    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-08', '07:45'),
      ...coordAt(10, 0),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toBe('accuracy_too_poor')
    expect(recordCount()).toBe(0)
  })

  it('off-site tanpa accuracy_m, bisnis block_in_radius → 422, tanpa record', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    // Menghilangkan `accuracy_m` tidak boleh menjadi jalan keluar dari geofence.
    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-07', '07:45'),
      latitude: WORK_LAT + 250 / M_PER_DEG_LAT,
      longitude: WORK_LON,
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toBe('accuracy_required_for_blocking_business')
    expect(res.json().error.details.radius_m).toBe(100)
    expect(recordCount()).toBe(0)
  })

  it('akurasi > radius, bisnis block_in_radius → 422 accuracy_too_poor, tanpa record', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-06', '07:45'),
      ...coordAt(50, 250),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toBe('accuracy_too_poor')
    expect(res.json().error.details.accuracy_m).toBe(250)
    expect(res.json().error.details.radius_m).toBe(100)
    expect(recordCount()).toBe(0)
  })

  it('tanpa koordinat, bisnis block_in_radius → 422 coordinates_required, tanpa record', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-07', '07:45'),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toBe('coordinates_required_for_blocking_business')
    expect(recordCount()).toBe(0)
  })

  it('tanpa koordinat, bisnis flag_only → 201 unknown, tanpa jarak', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'flag_only' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-08', '07:45'),
    })
    expect(res.statusCode).toBe(201)
    const record = res.json().record
    expect(record.geofence_status).toBe('unknown')
    expect(record.clock_in_distance_m).toBeNull()
  })

  it('bisnis tanpa lokasi → 201 unknown, tanpa jarak (perilaku lama tidak berubah)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-09', '07:45'),
      ...coordAt(50),
    })
    expect(res.statusCode).toBe(201)
    const record = res.json().record
    expect(record.geofence_status).toBe('unknown')
    expect(record.clock_in_distance_m).toBeNull()
  })

  it('mode block_in_radius tanpa radius diset → tidak menurun diam-diam ke flag, perilaku lama', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'block_in_radius', work_radius_m: null })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-10', '07:45'),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().record.geofence_status).toBe('unknown')
  })

  it('clock-out mengevaluasi geofence dan menyimpan clock_out_distance_m', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'flag_only' })
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-08-11', '07:45'),
      ...coordAt(50),
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-out',
      headers: auth(ctx.employeeToken),
      payload: {
        submission_method: 'offline_queue',
        client_timestamp: at('2026-08-11', '17:00'),
        ...coordAt(50),
      },
    })
    expect(res.statusCode).toBe(200)
    const record = res.json().record
    expect(record.geofence_status).toBe('on_site')
    expect(record.clock_out_distance_m).toBeGreaterThan(40)
    expect(record.clock_out_distance_m).toBeLessThan(60)
  })
})

describe('PATCH /api/businesses/:id/work-location', () => {
  it('owner menyetel radius valid (100 m) → 200, tersimpan', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
      payload: { work_latitude: WORK_LAT, work_longitude: WORK_LON, work_radius_m: 100, geofence_mode: 'flag_only' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().work_radius_m).toBe(100)
    expect(res.json().work_latitude).toBe(WORK_LAT)
    expect(res.json().geofence_mode).toBe('flag_only')

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
    })
    expect(get.statusCode).toBe(200)
    expect(get.json().work_radius_m).toBe(100)
  })

  it('radius di bawah minimum (10 m) → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
      payload: { work_radius_m: 10 },
    })
    expect(res.statusCode).toBe(422)
  })

  it('radius di atas maksimum (10000 m) → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
      payload: { work_radius_m: 10000 },
    })
    expect(res.statusCode).toBe(422)
  })

  it('non-owner (employee) → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.employeeToken),
      payload: { work_radius_m: 100 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('owner menghapus lat/lon (null) → 200, work-location nonaktif (GET 404)', async () => {
    ctx = await setupTest()
    await configureGeofence({ geofence_mode: 'flag_only' })

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
      payload: { work_latitude: null, work_longitude: null },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().work_latitude).toBeNull()
    expect(res.json().work_longitude).toBeNull()

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
    })
    expect(get.statusCode).toBe(404)
    expect(get.json().error.message).toBe('not_configured')
  })

  it('GET work-location belum dikonfigurasi → 404 not_configured', async () => {
    ctx = await setupTest()
    const get = await ctx.app.inject({
      method: 'GET',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.employeeToken),
    })
    expect(get.statusCode).toBe(404)
    expect(get.json().error.message).toBe('not_configured')
  })

  it('hanya salah satu dari lat/lon dikirim → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}/work-location`,
      headers: auth(ctx.ownerToken),
      payload: { work_latitude: WORK_LAT },
    })
    expect(res.statusCode).toBe(422)
  })
})